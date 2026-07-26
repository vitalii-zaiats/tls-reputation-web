/**
 * A second HTTP boundary, deliberately outside the apiBase client in http.ts:
 * this one talks to Cloudflare's public resolver, not to us. Keeping it here
 * rather than adding a foreign origin to `useHttp` is the point — that client
 * documents itself as everything-goes-through-apiBase, and it should stay true.
 *
 * Browser-only by design. Where a name points *today* is not corpus data — the
 * corpus stores (fingerprint, domain, counter) and nothing about DNS — so this
 * is decoration layered on top, and it must not sit in the SSR path where it
 * would make every render wait on a third party and route the worker's egress
 * through a crawl.
 *
 * one.one.one.one answers DNS-over-HTTPS with `access-control-allow-origin: *`,
 * so the browser queries it directly.
 */

const ENDPOINT = "https://one.one.one.one/dns-query"

/** RR type numbers, as they appear in the JSON `Answer` entries. */
const T_A = 1
const T_CNAME = 5
const T_TXT = 16
const T_AAAA = 28

/**
 * Team Cymru answers "who announces this address" over DNS, as TXT. That is
 * why the origin lookup below adds no new dependency: it is another question
 * for the resolver we are already talking to — no key, no CORS to negotiate,
 * no third party in the CSP, and answers the resolver caches for hours.
 *
 * Deliberately ASN and prefix rather than a city. Most addresses a name in this
 * corpus resolves to are anycast CDN edges, where a city says which PoP *this
 * visitor* was routed to — it would change from reader to reader. The
 * announcing AS and its BGP prefix are a fact about the infrastructure instead.
 */
const CYMRU_V4 = "origin.asn.cymru.com"
const CYMRU_V6 = "origin6.asn.cymru.com"
const CYMRU_AS = "asn.cymru.com"

/** RCODEs worth naming. */
export const RCODE_NOERROR = 0
export const RCODE_NXDOMAIN = 3

export interface DnsRecord {
  data: string
  ttl: number
}

export interface DnsAnswer {
  a: DnsRecord[]
  aaaa: DnsRecord[]
  /** The alias chain, in the order the resolver walked it. */
  cname: string[]
  status: number
}

interface DohEntry {
  name: string
  type: number
  TTL: number
  data: string
}

interface DohResponse {
  Status: number
  Answer?: DohEntry[]
}

/** Trailing dot: correct on the wire, noise on screen. */
const strip = (s: string) => s.replace(/\.$/, "")

function query(name: string, type: "A" | "AAAA" | "TXT"): Promise<DohResponse> {
  return $fetch<DohResponse>(ENDPOINT, {
    query: { name, type },
    headers: { accept: "application/dns-json" },

    // Forced, not detected. The resolver answers `application/dns-json`, and
    // ofetch's JSON test only accepts `application/json` or an explicit `+json`
    // suffix — so left to itself it would hand back a Blob and every field
    // below would read undefined.
    responseType: "json",

    // A resolver that is slow is a resolver we do without: the page is fully
    // rendered before this runs, so the only cost of giving up is a blank panel.
    signal: AbortSignal.timeout(6000),
  })
}

const pick = (r: DohResponse, t: number): DnsRecord[] =>
  (r.Answer || []).filter((e) => e.type === t).map((e) => ({ data: strip(e.data), ttl: e.TTL }))

/** Cymru's answer, one address's worth. */
export interface Origin {
  ip: string
  asn: string
  /** The BGP prefix the address falls in. */
  prefix: string
  /** The registry's country for the allocation — not a geolocation. */
  cc: string
  registry: string
  /** Filled by a second lookup keyed on the ASN. */
  name?: string
}

/**
 * A group of addresses that share one announcing AS.
 *
 * `prefixes` is a list, not a single value: a name that round-robins across a
 * provider's range lands in several /24s under the same AS — www.google.com
 * returns eight addresses spanning several — and quoting the first one as
 * though it covered them all would be a quiet lie.
 */
export interface OriginGroup {
  asn: string
  prefixes: string[]
  cc: string
  registry: string
  ips: string[]
  name?: string
}

/** Reverse the octets: 157.240.224.174 → 174.224.240.157. */
function v4Label(ip: string): string | null {
  const parts = ip.split(".")
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)) return null
  return parts.reverse().join(".")
}

/**
 * Expand to all 32 nibbles and reverse them, the way ip6.arpa does:
 * 2a03:2880::1 → 1.0.0.0.…​.3.0.a.2
 */
function v6Label(ip: string): string | null {
  const clean = (ip.replace(/^\[|\]$/g, "").split("%")[0] ?? "").toLowerCase()
  const [head, tail] = clean.split("::")
  const left = head ? head.split(":") : []
  const right = tail ? tail.split(":") : []
  // No "::" means every group must be written out.
  if (tail === undefined && left.length !== 8) return null
  const fill = 8 - left.length - right.length
  if (fill < 0) return null
  const groups = [...left, ...(tail === undefined ? [] : Array<string>(fill).fill("0")), ...right]
  if (groups.length !== 8) return null

  let nibbles = ""
  for (const g of groups) {
    // An IPv4-mapped group lands here and is rejected — no lookup beats a wrong
    // one, and these do not appear in AAAA answers in practice.
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    nibbles += g.padStart(4, "0")
  }
  return nibbles.split("").reverse().join(".")
}

/** TXT payloads arrive wrapped in the quotes they carry on the wire. */
const txt = (r: DohResponse): string[] =>
  (r.Answer || []).filter((e) => e.type === T_TXT).map((e) => e.data.replace(/^"|"$/g, ""))

async function lookupOrigin(ip: string): Promise<Origin | null> {
  const v6 = ip.includes(":")
  const label = v6 ? v6Label(ip) : v4Label(ip)
  if (!label) return null

  const r = await query(`${label}.${v6 ? CYMRU_V6 : CYMRU_V4}`, "TXT")
  const line = txt(r)[0]
  if (!line) return null

  // "32934 | 157.240.192.0/18 | US | arin | 2015-05-14"
  const [asn = "", prefix = "", cc = "", registry = ""] = line.split("|").map((s) => s.trim())
  // A prefix announced by more than one AS lists them space-separated; the
  // first is enough for a label, and naming all of them would say less.
  const first = asn.split(/\s+/)[0] ?? ""
  return first ? { ip, asn: first, prefix, cc, registry } : null
}

async function lookupAsName(asn: string): Promise<string | undefined> {
  const r = await query(`AS${asn}.${CYMRU_AS}`, "TXT")
  const line = txt(r)[0]
  if (!line) return undefined
  // "32934 | US | arin | 2004-08-24 | FACEBOOK - Facebook, Inc., US"
  const name = line.split("|")[4]?.trim()
  // Cymru suffixes the country; the registry country is already its own field.
  return name ? name.replace(/,\s*[A-Z]{2}$/, "") : undefined
}

/**
 * Who announces these addresses, grouped by AS. Grouped rather than listed
 * per address because the AS is a property of the prefix: five A records for
 * one Google name are one origin, not five.
 *
 * Bounded — a handful of round-robin addresses is a fair question to ask a
 * courtesy service, a hundred is not.
 */
const MAX_LOOKUPS = 8

export async function resolveOrigins(ips: string[]): Promise<OriginGroup[]> {
  const found = await Promise.all(
    ips.slice(0, MAX_LOOKUPS).map((ip) => lookupOrigin(ip).catch(() => null)),
  )

  const groups = new Map<string, OriginGroup>()
  for (const o of found) {
    if (!o) continue
    const g = groups.get(o.asn)
    if (g) {
      g.ips.push(o.ip)
      if (o.prefix && !g.prefixes.includes(o.prefix)) g.prefixes.push(o.prefix)
    } else {
      groups.set(o.asn, {
        asn: o.asn,
        prefixes: o.prefix ? [o.prefix] : [],
        cc: o.cc,
        registry: o.registry,
        ips: [o.ip],
      })
    }
  }

  // One name lookup per distinct AS, not per address.
  await Promise.all(
    [...groups.values()].map(async (g) => {
      g.name = await lookupAsName(g.asn).catch(() => undefined)
    }),
  )

  return [...groups.values()].sort((a, b) => b.ips.length - a.ips.length)
}

export async function resolveName(name: string): Promise<DnsAnswer> {
  // AAAA is allowed to fail on its own: a name with no IPv6 is ordinary, and
  // losing that half should not cost us the A records we did get.
  const [v4, v6] = await Promise.all([
    query(name, "A"),
    query(name, "AAAA").catch(() => ({ Status: RCODE_NOERROR }) as DohResponse),
  ])

  return {
    a: pick(v4, T_A),
    aaaa: pick(v6, T_AAAA),
    // Read once from the A answer — both queries walk the same aliases.
    cname: (v4.Answer || []).filter((e) => e.type === T_CNAME).map((e) => strip(e.data)),
    status: v4.Status,
  }
}

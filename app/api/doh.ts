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
const T_AAAA = 28

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

function query(name: string, type: "A" | "AAAA"): Promise<DohResponse> {
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

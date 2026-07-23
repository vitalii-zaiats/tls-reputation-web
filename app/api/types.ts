/**
 * The tls-reputation API wire types. These mirror the FastAPI response shapes
 * exactly (see backend tlsrep/routers/public.py). One source of truth for both
 * resources and the views that consume them.
 */

export type IsoDate = string
export type SortDir = "asc" | "desc"

/** A curated catalogue label for a fingerprint, when one matches. */
export interface Known {
  name: string
  env?: string
  label?: string
}

export type StabilityClass = "fixed" | "randomizing" | "multi_build" | "unknown"

/** Whether a client stack randomises its own ClientHello. */
export interface Stability {
  class: StabilityClass
  novelty?: number
  variants?: number
  variants_capped?: boolean
  observations?: number
  explanation?: string
  dominant_variant_share?: number
}

/** A u16 paired with its human name, from the backend's decorate(). */
export interface DecodedValue {
  value: string // "0x1301"
  name: string
}

// ────────────────────────────── fingerprints ──────────────────────────────

export interface FingerprintSummary {
  ja4: string
  /** null when the client permutes — no single JA3 represents it. */
  ja3: string | null
  tls_version: string
  alpn: string[]
  observations: number
  unique_snis: number
  spread: number
  stability: Stability
  known: Known | null
  first_seen: IsoDate | null
  last_seen: IsoDate | null
}

export interface Ja3Variant {
  ja3: string
  ja3_raw: string
  observations: number
}

export interface Ja3Variants {
  total: number
  capped: boolean
  truncated: boolean
  returned: number
  items: Ja3Variant[]
}

/** One (domain, count) edge — used both for a fingerprint's reach and its tail. */
export interface DomainReach {
  sni: string
  count: number
  share: number
  first_seen: IsoDate | null
  last_seen: IsoDate | null
}

export interface MatchedJa3 {
  ja3: string
  /** the JA4 this JA3 resolved to; null when the resolution is ambiguous. */
  canonical: string | null
  also_seen_under: { ja4: string; observations: number }[]
}

export interface FingerprintDetail extends FingerprintSummary {
  ja3_raw: string | null
  ja4_r: string
  cipher_suites: DecodedValue[]
  extensions: DecodedValue[]
  extensions_sorted: boolean
  curves: DecodedValue[]
  sig_algs: DecodedValue[]
  point_formats: string[]
  ja3_variants: Ja3Variants
  top_snis: DomainReach[]
  /** present only on the /ja3 route. */
  matched_ja3?: MatchedJa3
}

export interface FingerprintList {
  items: FingerprintSummary[]
  total: number
}

export interface FingerprintReach {
  ja3: string | null
  ja4: string
  total: number
  items: DomainReach[]
}

// ──────────────────────────────── domains ─────────────────────────────────

export interface DomainClient {
  ja3: string | null
  ja4: string
  stability: Stability
  known: Known | null
  count: number
  share: number
  first_seen: IsoDate | null
  last_seen: IsoDate | null
}

export interface DomainDetail {
  sni: string
  observations: number
  unique_fingerprints: number
  /** a name-based hint (e.g. "auth"), not a verdict; null when none. */
  category: string | null
  spread: number
  first_seen: IsoDate | null
  last_seen: IsoDate | null
  top_fingerprints: DomainClient[]
}

export interface DomainSummary {
  sni: string
  observations: number
  unique_fingerprints: number
  spread: number
  category: string | null
  first_seen: IsoDate | null
  last_seen: IsoDate | null
}

export interface DomainList {
  items: DomainSummary[]
  total: number
}

// ────────────────────────────── catalog / meta ────────────────────────────

export interface Stats {
  fingerprints: number
  snis: number
  observations: number
  first_seen: IsoDate
  last_seen: IsoDate
}

export interface AlpnClient {
  /** null for the aggregated unknown-clients bucket (paired with known:false). */
  name: string | null
  known: boolean
  fingerprints: number
  observations: number
}

export interface AlpnOffer {
  alpn: string[]
  /** null for the no-ALPN bucket (when alpn is []). */
  label: string | null
  fingerprints: number
  observations: number
  share_of_fingerprints: number
  share_of_observations: number
  unique_snis: number
  share_of_snis: number
  clients: AlpnClient[]
  known_fingerprints: number
  known_observations: number
}

export interface AlpnReport {
  total_fingerprints: number
  total_observations: number
  total_snis: number
  sni_counts_overlap: boolean
  known_fingerprints: number
  known_observations: number
  items: AlpnOffer[]
}

export type SearchKind = "ja4" | "ja3" | "sni" | "unknown"

export interface SearchResult {
  kind: SearchKind
  match: FingerprintDetail | DomainDetail | null
}

export interface GraphNode {
  id: string // "f:<ja4>" | "s:<sni>"
  t: "f" | "s"
  l: string
  d: number
  o: number
}

export interface GraphEdge {
  s: string
  t: string
  w: number
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ──────────────────────────────── query params ────────────────────────────

export interface PageParams {
  limit?: number
  offset?: number
}

export interface FingerprintListParams extends PageParams {
  sort?: string
  dir?: SortDir
  /** exact ALPN offer list, comma-joined and in order (e.g. "h2,http/1.1"). */
  alpn?: string
}

export interface DomainListParams extends PageParams {
  sort?: string
  dir?: SortDir
  category?: string
}

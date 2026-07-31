/** Typed bindings for the corpus-wide / lookup endpoints. */
import type { HttpClient } from "../http"
import type { AlpnReport, Graph, Insights, SearchResult, Stats } from "../types"

export function catalogResource(http: HttpClient) {
  return {
    stats: () => http.get<Stats>("/stats"),

    alpn: () => http.get<AlpnReport>("/alpn"),

    /** Detect the input type (ja4/ja3/sni) and resolve it, or kind:"unknown". */
    search: (q: string) => http.get<SearchResult>("/search", { q }),

    /** The whole fingerprint↔domain graph as nodes + edges. */
    graph: () => http.get<Graph>("/graph"),

    /** Corpus-wide shapes: the JA4 collapse, flattest and most concentrated
     *  endpoints, and the cipher-list mix. */
    insights: (limit = 10) => http.get<Insights>("/insights", { limit }),
  }
}

export type CatalogResource = ReturnType<typeof catalogResource>

/** Typed bindings for the corpus-wide / lookup endpoints. */
import type { HttpClient } from "../http"
import type { AlpnReport, Graph, SearchResult, Stats } from "../types"

export function catalogResource(http: HttpClient) {
  return {
    stats: () => http.get<Stats>("/stats"),

    alpn: () => http.get<AlpnReport>("/alpn"),

    /** Detect the input type (ja4/ja3/sni) and resolve it, or kind:"unknown". */
    search: (q: string) => http.get<SearchResult>("/search", { q }),

    /** The whole fingerprint↔domain graph as nodes + edges. */
    graph: () => http.get<Graph>("/graph"),
  }
}

export type CatalogResource = ReturnType<typeof catalogResource>

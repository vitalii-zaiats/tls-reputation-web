/** View-facing corpus-wide / lookup operations (stats, ALPN, search, graph). */
import { useHttp } from "../http"
import { catalogResource } from "../resources/catalog"

export function useCatalogService() {
  const res = catalogResource(useHttp())

  return {
    stats: res.stats,
    alpn: res.alpn,
    search: res.search,
    graph: res.graph,
  }
}

export type CatalogService = ReturnType<typeof useCatalogService>

/** Typed bindings for the registrable-domain rollup endpoints. Pure — takes an HttpClient. */
import type { HttpClient } from "../http"
import type { PageParams, RootHostnameList, RootList, RootListParams } from "../types"

export function rootResource(http: HttpClient) {
  return {
    list: (params: RootListParams = {}) => http.get<RootList>("/roots", params),

    hostnames: (domain: string, params: PageParams = {}) =>
      http.get<RootHostnameList>(`/roots/${encodeURIComponent(domain)}/hostnames`, params),
  }
}

export type RootResource = ReturnType<typeof rootResource>

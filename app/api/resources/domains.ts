/** Typed bindings for the domain (SNI) endpoints. Pure — takes an HttpClient. */
import type { HttpClient } from "../http"
import type { DomainDetail, DomainList, DomainListParams, PageParams } from "../types"

export function domainResource(http: HttpClient) {
  return {
    get: (name: string, params: PageParams = {}) =>
      http.get<DomainDetail>(`/sni/${encodeURIComponent(name)}`, params),

    list: (params: DomainListParams = {}) => http.get<DomainList>("/snis", params),
  }
}

export type DomainResource = ReturnType<typeof domainResource>

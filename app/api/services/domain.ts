/** View-facing domain (SNI) operations. */
import { useHttp } from "../http"
import { domainResource } from "../resources/domains"
import type { DomainListParams, PageParams } from "../types"

export function useDomainService() {
  const res = domainResource(useHttp())

  return {
    detail: (name: string, params?: PageParams) => res.get(name, params),
    list: (params?: DomainListParams) => res.list(params),
  }
}

export type DomainService = ReturnType<typeof useDomainService>

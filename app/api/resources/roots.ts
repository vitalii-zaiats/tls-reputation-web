/** Typed binding for the registrable-domain rollup endpoint. Pure — takes an HttpClient. */
import type { HttpClient } from "../http"
import type { RootList, RootListParams } from "../types"

export function rootResource(http: HttpClient) {
  return {
    list: (params: RootListParams = {}) => http.get<RootList>("/roots", params),
  }
}

export type RootResource = ReturnType<typeof rootResource>

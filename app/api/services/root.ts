/** View-facing registrable-domain (rollup) operations. */
import { useHttp } from "../http"
import { rootResource } from "../resources/roots"
import type { RootListParams } from "../types"

export function useRootService() {
  const res = rootResource(useHttp())
  return {
    list: (params?: RootListParams) => res.list(params),
  }
}

export type RootService = ReturnType<typeof useRootService>

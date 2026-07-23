/** Typed bindings for the fingerprint endpoints. Pure — takes an HttpClient. */
import type { HttpClient } from "../http"
import type {
  FingerprintDetail,
  FingerprintList,
  FingerprintListParams,
  FingerprintReach,
  PageParams,
} from "../types"

export function fingerprintResource(http: HttpClient) {
  return {
    getByJa4: (ja4: string) => http.get<FingerprintDetail>(`/ja4/${encodeURIComponent(ja4)}`),

    getByJa3: (ja3: string) => http.get<FingerprintDetail>(`/ja3/${encodeURIComponent(ja3)}`),

    list: (params: FingerprintListParams = {}) => http.get<FingerprintList>("/fingerprints", params),

    /** Every domain a fingerprint reached, paginated (accepts a JA3 or JA4). */
    reach: (value: string, params: PageParams = {}) =>
      http.get<FingerprintReach>(`/fingerprint/${encodeURIComponent(value)}/snis`, params),
  }
}

export type FingerprintResource = ReturnType<typeof fingerprintResource>

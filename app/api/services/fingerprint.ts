/**
 * View-facing fingerprint operations. Owns the JA3-vs-JA4 routing so pages don't
 * repeat the regex, and hands back the typed resource calls for lists and reach.
 */
import { useHttp } from "../http"
import { fingerprintResource } from "../resources/fingerprints"
import type { FingerprintListParams, PageParams } from "../types"

const JA3_RE = /^[0-9a-f]{32}$/i

export const isJa3 = (hash: string) => JA3_RE.test(hash)

export function useFingerprintService() {
  const res = fingerprintResource(useHttp())

  return {
    /** Route a raw hash: a 32-hex md5 is a JA3, anything else a JA4 string. */
    detail: (hash: string) => (isJa3(hash) ? res.getByJa3(hash) : res.getByJa4(hash)),
    byJa4: res.getByJa4,
    byJa3: res.getByJa3,
    list: (params?: FingerprintListParams) => res.list(params),
    reach: (value: string, params?: PageParams) => res.reach(value, params),
  }
}

export type FingerprintService = ReturnType<typeof useFingerprintService>

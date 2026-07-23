/**
 * The single HTTP boundary for the API layer. Everything goes through one typed
 * client bound to `apiBase` (/api/v1, which nuxt.config proxies to the backend —
 * so no CORS, in dev or prod). Resources are built on top of this; nothing else
 * calls $fetch directly.
 *
 * $fetch throws a FetchError on non-2xx; callers read `err.statusCode`. A 404 is
 * a real answer ("never observed"), not a fault.
 */
import { useRuntimeConfig } from "#imports"

export interface HttpClient {
  get<T>(path: string, query?: object): Promise<T>
}

export function useHttp(): HttpClient {
  const {
    public: { apiBase },
  } = useRuntimeConfig()

  return {
    get: <T>(path: string, query?: object) =>
      $fetch<T>(`${apiBase}${path}`, { query: query as Record<string, unknown> }),
  }
}

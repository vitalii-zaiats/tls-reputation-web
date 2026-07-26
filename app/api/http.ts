/**
 * The single HTTP boundary for the API layer. Everything goes through one typed
 * client bound to `apiBase` (https://api.tls-reputation.com/api/v1 — the public,
 * CORS-open API subdomain the browser and SSR worker both call directly).
 * Resources are built on top of this; nothing else calls $fetch directly.
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
    // The assertion is the whole reason this boundary exists in one file.
    //
    // Nuxt's $fetch returns `TypedInternalResponse<R, T, M>`, which maps a
    // *Nitro route path* to that handler's return type and only falls through
    // to `T` otherwise. Its first branch — `T extends string | boolean |
    // number | null | void | object ? T : …` — is a distributive conditional
    // over a naked type parameter, so TypeScript defers it for as long as `T`
    // is generic and never reduces it to `T`. Constraining `T` does not help;
    // distribution needs a concrete instantiation, not a provable constraint.
    //
    // Every caller is a resource module that names the shape it expects, and
    // the request is an absolute URL to another origin that Nitro's route map
    // could never describe. So the assertion states what the call site has
    // already declared, once, here — rather than at each of the four
    // resources, or by swapping the transport to dodge a type.
    get: <T>(path: string, query?: object) =>
      $fetch<T>(`${apiBase}${path}`, { query: query as Record<string, unknown> }) as Promise<T>,
  }
}

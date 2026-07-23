# tls-reputation-web

The [tls-reputation.com](https://tls-reputation.com) frontend, on Nuxt 4 (SSR).
Split out of the monorepo; intended for Cloudflare Pages. TypeScript throughout,
with a typed API layer and all styles in SCSS.

## Develop

```sh
npm install
npm run dev            # http://localhost:3000, API proxied to production
```

Every call goes through one client (`app/api/http.ts`) at the base URL in
`runtimeConfig.public.apiBase` — `/api/v1` by default, which `nuxt.config.ts`
proxies same-origin to the real backend (so there is never a CORS hop).

Point it elsewhere with either:

```sh
# proxy to a local backend (keeps the same-origin /api/v1):
NUXT_API_ORIGIN=http://localhost:8000 npm run dev

# or call an API origin directly (the backend must then send CORS headers):
NUXT_PUBLIC_API_BASE=https://api.tls-reputation.com/api/v1 npm run dev
```

## Type-check & build

```sh
npx nuxt typecheck     # vue-tsc — kept clean
npm run build          # server build (node preset)
```

For **Cloudflare Pages** (SSR as a Pages Function), build with the cloudflare
preset and point the app straight at the API subdomain:

```sh
NITRO_PRESET=cloudflare-pages \
NUXT_PUBLIC_API_BASE=https://api.tls-reputation.com/api/v1 \
npm run build
```

## Layout

- `app/api/` — the typed API layer: `http.ts` (the single `$fetch` client),
  `resources/` (typed endpoint bindings), `services/` (view-facing composables:
  `useFingerprintService` / `useDomainService` / `useCatalogService`), `types.ts`
  (the wire types).
- `app/styles/` — all SCSS: `base/` (`tokens`, `fonts`, `scaffold` — loaded
  globally via `nuxt.config`), plus `components/`, `pages/`, `layouts/`. Each SFC
  references its file with `<style scoped lang="scss" src="~/styles/…">`.
- `app/components/` — the primitives (`SpreadBar`, `ShareBarList`, `VerdictChip`,
  `SignalRow`, `StabilityBadge`, `AnatomyColumn`, `CopyText`), the ALPN / donut
  charts, and the force-directed `GraphCanvas` (sigma.js + graphology).
- `app/pages/` — `index`, `browse`, `fp/[hash]`, `sni/[name]`, `docs`, `graph`.
- `app/layouts/` — `default` (masthead / footer / theme toggle) and `embed`.
- `app/utils/` — `format.ts` and `verdict.ts` (pure view-model derivations).

Design system: dark-primary / light-alternate via `[data-theme]`, oklch tokens,
one amber accent, self-hosted IBM Plex (`public/fonts/`).

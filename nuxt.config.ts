// tls-reputation.com — Nuxt frontend.
//
// The app calls the API directly at api.tls-reputation.com — a public,
// CORS-open read API — from the browser and the SSR worker alike, in dev and
// in production. Override the base for a local backend with
// NUXT_PUBLIC_API_BASE=http://localhost:8000/api/v1.

// Runs before first paint on the client to avoid a theme flash: reassert the
// remembered theme onto <html> before Vue hydrates. SSR has no localStorage, so
// server render falls back to the dark-primary default in base.css.
const THEME_INIT =
  "(function(){try{var t=localStorage.getItem('tlsrep-theme');" +
  "if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();"

export default defineNuxtConfig({
  compatibilityDate: "2026-07-01",
  devtools: { enabled: true },

  // Fonts first: tokens.scss names the families, fonts.scss defines them;
  // scaffold.scss layers the shared table/bar utilities on top.
  css: ["~/styles/base/fonts.scss", "~/styles/base/tokens.scss", "~/styles/base/scaffold.scss"],

  runtimeConfig: {
    public: {
      // The API lives on its own subdomain, Cloudflare-proxied and CORS-open,
      // so the browser and the SSR worker both call it directly — no
      // same-origin proxy hop. Override with NUXT_PUBLIC_API_BASE to point at
      // a local backend.
      apiBase: "https://api.tls-reputation.com/api/v1",
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: "en" },
      title: "tls-reputation.com — TLS fingerprint reputation",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content:
            "A public reputation database of TLS client fingerprints (JA3/JA4): what software opened a connection, and how it behaves across the domains it reaches.",
        },
        { name: "color-scheme", content: "dark light" },
      ],
      script: [{ innerHTML: THEME_INIT, tagPosition: "head" }],
    },
  },
})

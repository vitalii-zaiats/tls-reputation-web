// tls-reputation.com — Nuxt frontend.
//
// The app calls its API same-origin at /api/v1; the routeRules proxy below
// forwards that to the real backend, so there is never a CORS hop — in dev or
// in production. Point NUXT_API_ORIGIN at a local backend for development.

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
      apiBase: "/api/v1",
    },
  },

  routeRules: {
    // Same-origin API proxy. Defaults to the live API so a fresh checkout
    // renders real data out of the box; set NUXT_API_ORIGIN=http://localhost:8000
    // to develop against a local backend.
    "/api/**": {
      proxy: `${process.env.NUXT_API_ORIGIN || "https://tls-reputation.com"}/api/**`,
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

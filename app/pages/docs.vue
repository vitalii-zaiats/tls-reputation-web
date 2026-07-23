<script setup lang="ts">
interface Endpoint {
  sig: string
  desc: string
}
const ENDPOINTS: Endpoint[] = [
  { sig: "GET /api/v1/ja4/{ja4}", desc: "Reputation for a JA4 string." },
  { sig: "GET /api/v1/ja3/{md5}", desc: "Resolve a JA3 md5 to its fingerprint." },
  { sig: "GET /api/v1/sni/{domain}?limit=&offset=", desc: "Clients that reached a domain." },
  { sig: "GET /api/v1/fingerprints?sort=&limit=&offset=", desc: "Browse fingerprints." },
  { sig: "GET /api/v1/snis?sort=&limit=&offset=", desc: "Browse domains." },
  { sig: "GET /api/v1/alpn", desc: "ALPN offer distribution across the corpus." },
  { sig: "GET /api/v1/search?q=", desc: "Detect input type (JA4 / JA3 / domain) and resolve it." },
  { sig: "GET /api/v1/stats", desc: "Corpus size." },
]
useHead({ title: "API documentation — tls-reputation.com" })
</script>

<template>
  <h1>API</h1>
  <p class="lede">
    Public, free, JSON — the same shapes the site renders. Base
    <code>https://tls-reputation.com/api/v1</code>. Interactive OpenAPI spec at
    <a href="/api/docs">/api/docs</a>.
  </p>

  <section class="section">
    <h2>Endpoints</h2>
    <dl class="endpoints">
      <template v-for="e in ENDPOINTS" :key="e.sig">
        <dt class="mono">{{ e.sig }}</dt>
        <dd class="muted">{{ e.desc }}</dd>
      </template>
    </dl>
  </section>
</template>

<style scoped lang="scss" src="~/styles/pages/docs.scss"></style>

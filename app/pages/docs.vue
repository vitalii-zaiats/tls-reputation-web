<script setup lang="ts">
// The interactive reference is the API's own Swagger UI, embedded live, so it
// never drifts from what the backend actually serves. It must be the /api/docs
// path (not the bare /docs): only /api/docs is served without
// X-Frame-Options/CSP, so only it can be framed.
const API_BASE = "https://api.tls-reputation.com/api/v1"
const SWAGGER = "https://api.tls-reputation.com/api/docs"
const OPENAPI = "https://api.tls-reputation.com/openapi.json"
useHead({ title: "API documentation — tls-reputation.com" })
</script>

<template>
  <h1>API</h1>
  <p class="lede">
    Public, free, JSON — the same shapes the site renders. Base
    <code>{{ API_BASE }}</code>. The interactive reference below is the live
    OpenAPI spec served by the API itself; the raw document is at
    <a :href="OPENAPI" target="_blank" rel="noopener">openapi.json</a>.
  </p>

  <section class="section">
    <iframe
      class="swagger"
      :src="SWAGGER"
      title="Interactive API reference — OpenAPI / Swagger UI"
      loading="lazy"
    />
  </section>
</template>

<style scoped lang="scss" src="~/styles/pages/docs.scss"></style>

<style scoped>
.swagger {
  display: block;
  width: 100%;
  min-height: 80vh;
  border: 1px solid var(--border);
  border-radius: 10px;
  /* Swagger UI is light-themed; give it a white canvas so it reads cleanly
     inside the dark-primary site instead of flashing transparent on load. */
  background: #fff;
}
</style>

<script setup lang="ts">
// A canonical link to the apex on every page. The same app answers on the
// Cloudflare Pages preview hosts (*.pages.dev, dev.tls-reputation.com) and on
// www, so without this Google could index those as duplicate content.
// route.path drops the query string, consolidating filtered /browse variants
// onto a single canonical URL.
const route = useRoute()
const SITE_URL = "https://tls-reputation.com"
useHead(() => ({
  link: [{ rel: "canonical", href: SITE_URL + route.path }],
}))
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

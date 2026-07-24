<script setup lang="ts">
const route = useRoute()
// The home page has its own large lookup box; don't duplicate it in the header.
const showHeaderLookup = computed(() => route.name !== "index")
</script>

<template>
  <NuxtLoadingIndicator color="#e8a23c" :height="2" />
  <a class="skip" href="#main">Skip to content</a>

  <header class="masthead">
    <div class="masthead-inner">
      <div class="brand">
        <NuxtLink to="/" class="wordmark">tls-<span class="accent">reputation</span>.com</NuxtLink>
        <span class="tagline">TLS fingerprint reputation</span>
      </div>

      <nav class="nav" aria-label="Main">
        <NuxtLink to="/browse">browse</NuxtLink>
        <NuxtLink to="/roots">roots</NuxtLink>
        <NuxtLink to="/graph">graph</NuxtLink>
        <NuxtLink to="/fingerprint">your fingerprint</NuxtLink>
        <NuxtLink to="/use-case">use case</NuxtLink>
        <NuxtLink to="/docs">docs</NuxtLink>
      </nav>

      <ThemeToggle />
    </div>

    <div v-if="showHeaderLookup" class="header-lookup">
      <LookupInput size="sm" />
    </div>
  </header>

  <main id="main" class="page">
    <slot />
  </main>

  <footer class="footer">
    <div class="footer-inner">
      <p class="line">
        Public, free and open. Data licensed
        <a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener">CC&nbsp;BY&nbsp;4.0</a>.
        No authentication, no rate limit beyond fair use.
      </p>
      <p class="line faint">
        Fingerprints are observations of TLS ClientHello messages. They identify software, not people.
      </p>
    </div>
  </footer>
</template>

<style scoped lang="scss" src="~/styles/layouts/default.scss"></style>

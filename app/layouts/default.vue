<script setup lang="ts">
const route = useRoute()
// The home page has its own large lookup box; don't duplicate it in the header.
const showHeaderLookup = computed(() => route.name !== "index")

// Below the nav's natural width the links collapse behind a disclosure button.
// Watching fullPath rather than the click closes it on every navigation,
// including a back-button pop; tapping the already-active link leaves the route
// unchanged, so that one case is closed on the click handler instead.
const menuOpen = ref(false)
watch(() => route.fullPath, () => (menuOpen.value = false))
</script>

<template>
  <NuxtLoadingIndicator color="#e8a23c" :height="2" />
  <a class="skip" href="#main">Skip to content</a>

  <!-- Escape closes the menu. Scoped to the header rather than a global
       listener: opening it leaves focus on the button, so that is where the
       key will land. -->
  <header class="masthead" @keydown.esc="menuOpen = false">
    <div class="masthead-inner">
      <div class="brand">
        <NuxtLink to="/" class="wordmark">tls-<span class="accent">reputation</span>.com</NuxtLink>
        <span class="tagline">TLS fingerprint reputation</span>
      </div>

      <button
        class="nav-toggle"
        type="button"
        aria-controls="site-nav"
        :aria-expanded="menuOpen"
        @click="menuOpen = !menuOpen"
      >
        <span class="visually-hidden">{{ menuOpen ? "Close menu" : "Open menu" }}</span>
        <span class="bars" aria-hidden="true"></span>
      </button>

      <nav
        id="site-nav"
        class="nav"
        :class="{ 'is-open': menuOpen }"
        aria-label="Main"
        @click="menuOpen = false"
      >
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

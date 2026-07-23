<script setup lang="ts">
/**
 * The one input on the site. Classifies what you typed and routes to the right
 * detail page — a JA3 md5 or a JA4 both resolve to a fingerprint, anything else
 * is treated as a domain. The backend's /search does the same detection;
 * doing it client-side keeps the box instant and needs no round-trip.
 */
interface Props {
  size?: string // "lg" (hero) | "sm" (header)
}
withDefaults(defineProps<Props>(), { size: "lg" })

const q = ref("")

function target(value: string) {
  const s = value.trim()
  if (!s) return null
  if (/^[0-9a-f]{32}$/i.test(s)) return `/fp/${encodeURIComponent(s)}` // JA3 md5
  if (/^t\d{2}[di]/i.test(s) || s.includes("_")) return `/fp/${encodeURIComponent(s)}` // JA4
  return `/sni/${encodeURIComponent(s.toLowerCase())}` // domain
}

function submit() {
  const to = target(q.value)
  if (to) navigateTo(to)
}

const EXAMPLES = [
  { label: "a Chrome JA4", to: "/fp/t13d1516h2_8daaf6152771_02713d6af862" },
  { label: "www.google.com", to: "/sni/www.google.com" },
  { label: "www.facebook.com", to: "/sni/www.facebook.com" },
]
</script>

<template>
  <div class="lookup" :class="`lookup--${size}`">
    <form class="row" role="search" @submit.prevent="submit">
      <div class="field-wrap">
        <span class="prompt mono" aria-hidden="true">&gt;</span>
        <input
          v-model="q"
          class="field mono"
          type="text"
          name="q"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :placeholder="size === 'sm' ? 'JA4 · JA3 · domain' : 'JA3 md5, JA4 string, or domain'"
          aria-label="Look up a fingerprint or a domain"
        />
      </div>
      <button class="go mono" type="submit">look up</button>
    </form>

    <div v-if="size !== 'sm'" class="examples">
      <span class="try mono">try</span>
      <NuxtLink v-for="ex in EXAMPLES" :key="ex.to" class="chip mono" :to="ex.to">{{ ex.label }}</NuxtLink>
    </div>
  </div>
</template>

<style scoped lang="scss" src="~/styles/components/lookup-input.scss"></style>

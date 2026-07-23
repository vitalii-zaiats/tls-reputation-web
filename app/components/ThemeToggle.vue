<script setup lang="ts">
/**
 * Three-state theme control: auto (follow the OS) / light / dark.
 * Choice persists in localStorage; `auto` clears the override so
 * prefers-color-scheme takes back over. localStorage/window are touched only
 * after mount, so this is safe under SSR — the inline head script in
 * nuxt.config already reasserts the theme before first paint.
 */
type Theme = "auto" | "light" | "dark"

const STORAGE_KEY = "tlsrep-theme"
const MODES: { value: Theme; label: string }[] = [
  { value: "auto", label: "auto" },
  { value: "light", label: "light" },
  { value: "dark", label: "dark" },
]

const mode = ref<Theme>("auto")

function apply(next: Theme) {
  mode.value = next
  const root = document.documentElement
  if (next === "auto") root.removeAttribute("data-theme")
  else root.setAttribute("data-theme", next)
  try {
    if (next === "auto") localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)
  } catch (e) {
    /* private mode / storage disabled — the in-page choice still applies */
  }
}

function stored(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === "light" || value === "dark" ? value : "auto"
  } catch {
    return "auto"
  }
}

function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY) apply(stored())
}
function onPageshow(event: PageTransitionEvent) {
  if (event.persisted) apply(stored())
}

onMounted(() => {
  apply(stored())
  window.addEventListener("storage", onStorage)
  window.addEventListener("pageshow", onPageshow)
})
onBeforeUnmount(() => {
  window.removeEventListener("storage", onStorage)
  window.removeEventListener("pageshow", onPageshow)
})
</script>

<template>
  <div class="theme" role="group" aria-label="Colour theme">
    <button
      v-for="m in MODES"
      :key="m.value"
      type="button"
      class="control opt"
      :aria-pressed="mode === m.value"
      @click="apply(m.value)"
    >
      {{ m.label }}
    </button>
  </div>
</template>

<style scoped lang="scss" src="~/styles/components/theme-toggle.scss"></style>

<script setup lang="ts">
/**
 * Three-state theme control: auto (follow the OS) / light / dark, as a compact
 * icon segment. Choice persists in localStorage; `auto` clears the override so
 * prefers-color-scheme takes back over. localStorage/window are touched only
 * after mount, so this is safe under SSR — the inline head script in
 * nuxt.config already reasserts the theme before first paint.
 */
type Theme = "auto" | "light" | "dark"

const STORAGE_KEY = "tlsrep-theme"
const mode = ref<Theme>("auto")

function apply(next: Theme) {
  mode.value = next
  const root = document.documentElement
  if (next === "auto") root.removeAttribute("data-theme")
  else root.setAttribute("data-theme", next)
  try {
    if (next === "auto") localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)
  } catch {
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
      type="button"
      class="opt"
      :class="{ on: mode === 'auto' }"
      :aria-pressed="mode === 'auto'"
      title="System theme"
      aria-label="System theme"
      @click="apply('auto')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    </button>
    <button
      type="button"
      class="opt"
      :class="{ on: mode === 'light' }"
      :aria-pressed="mode === 'light'"
      title="Light theme"
      aria-label="Light theme"
      @click="apply('light')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </svg>
    </button>
    <button
      type="button"
      class="opt"
      :class="{ on: mode === 'dark' }"
      :aria-pressed="mode === 'dark'"
      title="Dark theme"
      aria-label="Dark theme"
      @click="apply('dark')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.theme {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.opt {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 24px;
  padding: 0;
  color: var(--muted);
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 6px;
}
.opt:hover {
  color: var(--text);
}
.opt.on {
  color: var(--text);
  background: var(--panel, rgba(127, 127, 127, 0.14));
}
.opt svg {
  width: 15px;
  height: 15px;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>

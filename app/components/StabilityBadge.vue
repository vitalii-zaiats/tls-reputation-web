<script setup lang="ts">
import type { Stability, StabilityClass } from "~/api/types"

/**
 * The self-randomisation class of a fingerprint, as a chip. `fixed` carries the
 * one amber accent: a deterministic stack is the notable case (a library, or a
 * single client hammering an auth endpoint). Randomising is just a browser being
 * a browser, so it reads neutral. The full explanation rides in the title.
 */
interface Props {
  stability?: Stability
  showVariants?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  stability: () => ({ class: "unknown" }),
  showVariants: false,
})

const LABELS: Record<StabilityClass, string> = {
  fixed: "fixed",
  randomizing: "randomising",
  multi_build: "multi-build",
  unknown: "unclassified",
}

const klass = computed(() => props.stability?.class || "unknown")
const label = computed(() => {
  const base = LABELS[klass.value] || klass.value
  const n = props.stability?.variants
  if (props.showVariants && n && n > 1) {
    return `${base} · ${formatNum(n)}${props.stability?.variants_capped ? "+" : ""} JA3`
  }
  return base
})
</script>

<template>
  <span class="stab" :class="`stab--${klass}`" :title="stability?.explanation || ''">
    <span class="stab-dot" aria-hidden="true"></span>{{ label }}
  </span>
</template>

<style scoped lang="scss" src="~/styles/components/stability-badge.scss"></style>

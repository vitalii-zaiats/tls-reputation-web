<script setup lang="ts">
/**
 * One row of the "Read": a labelled signal turned into a sentence. Left column
 * is a tone marker + mono label (on the same 12rem grid as .kv); the slot holds
 * sans prose that may embed a SpreadBar or StabilityBadge inline. Tones:
 *   strong — the signal is present and salient (amber marker)
 *   neutral — ordinary
 *   absent — the signal is missing (hollow, dashed marker)
 */
interface Props {
  label: string
  tone?: "strong" | "neutral" | "absent"
}
withDefaults(defineProps<Props>(), { tone: "neutral" })
</script>

<template>
  <div class="signal">
    <div class="signal-key">
      <span class="mark" :class="`mark--${tone}`" aria-hidden="true"></span>
      <span class="mono lbl">{{ label }}</span>
    </div>
    <div class="signal-body"><slot /></div>
  </div>
</template>

<style scoped lang="scss" src="~/styles/components/signal-row.scss"></style>

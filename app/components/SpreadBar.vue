<script setup lang="ts">
/**
 * A thin amber meter for a 0..1 spread (or any normalised) value, with the
 * numeric readout beside it. The bar is 3:1 amber-on-panel; the accent is a
 * fill, never text, per the design system.
 */
interface Props {
  value?: number
  width?: string
}
const props = withDefaults(defineProps<Props>(), { value: 0, width: "8rem" })

const pct = computed(() => Math.max(0, Math.min(1, props.value || 0)) * 100)
</script>

<template>
  <span class="spread">
    <span class="track" :style="{ width }">
      <span class="fill" :style="{ width: pct + '%' }"></span>
    </span>
    <span class="val nums">{{ formatSpread(value) }}</span>
  </span>
</template>

<style scoped lang="scss" src="~/styles/components/spread-bar.scss"></style>

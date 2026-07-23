<script setup lang="ts">
/**
 * A minimal donut: one SVG circle per slice, drawn with stroke-dasharray so
 * there's no arc trig. Slice colours are passed in (as `var(--…)` strings) and
 * applied via inline style, since CSS custom properties don't resolve in SVG
 * presentation attributes. A small gap after each slice keeps them legible.
 */
export interface DonutSlice {
  label: string
  value: number
  color: string
}
interface Props {
  items: DonutSlice[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerSub?: string
}
const props = withDefaults(defineProps<Props>(), {
  size: 150,
  thickness: 20,
  centerLabel: "",
  centerSub: "",
})

const C = computed(() => props.size / 2)
const R = computed(() => (props.size - props.thickness) / 2)
// Centre text scales with the donut, so small instances stay in proportion.
const numFs = computed(() => Math.round(props.size * 0.165))
const subFs = computed(() => Math.max(9, Math.round(props.size * 0.068)))
const circ = computed(() => 2 * Math.PI * R.value)
const total = computed(() => props.items.reduce((sum, i) => sum + (i.value || 0), 0) || 1)

const segments = computed(() => {
  const live = props.items.filter((i) => i.value > 0)
  const gap = live.length > 1 ? 3 : 0
  let acc = 0
  return live.map((i) => {
    const full = (i.value / total.value) * circ.value
    const dash = Math.max(0.5, full - gap)
    const seg = { color: i.color, dasharray: `${dash} ${circ.value - dash}`, offset: -acc }
    acc += full
    return seg
  })
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="`0 0 ${size} ${size}`"
    class="donut"
    role="img"
    :aria-label="`${centerLabel} ${centerSub}`.trim()"
  >
    <g :transform="`rotate(-90 ${C} ${C})`">
      <circle class="track" :cx="C" :cy="C" :r="R" :style="{ strokeWidth: thickness + 'px' }" />
      <circle
        v-for="(seg, k) in segments"
        :key="k"
        class="seg"
        :cx="C"
        :cy="C"
        :r="R"
        :style="{
          stroke: seg.color,
          strokeWidth: thickness + 'px',
          strokeDasharray: seg.dasharray,
          strokeDashoffset: seg.offset,
        }"
      />
    </g>
    <text
      v-if="centerLabel"
      class="c-num"
      :x="C"
      :y="centerSub ? C - subFs * 0.55 : C"
      text-anchor="middle"
      dominant-baseline="middle"
      :style="{ fontSize: numFs + 'px' }"
    >
      {{ centerLabel }}
    </text>
    <text
      v-if="centerSub"
      class="c-sub"
      :x="C"
      :y="C + numFs * 0.62"
      text-anchor="middle"
      dominant-baseline="middle"
      :style="{ fontSize: subFs + 'px' }"
    >
      {{ centerSub }}
    </text>
  </svg>
</template>

<style scoped lang="scss" src="~/styles/components/donut-chart.scss"></style>

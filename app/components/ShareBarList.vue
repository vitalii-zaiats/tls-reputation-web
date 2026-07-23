<script lang="ts">
/** The row shape ShareBarList renders; callers may add extra fields (a generic T). */
export interface ShareBarItem {
  key: string | number
  label: string
  value: number
  share?: number
  to?: string
  count?: number
}
</script>

<script setup lang="ts" generic="T extends ShareBarItem">
/**
 * A ranked list of single-amber magnitude bars — the primary visualisation on
 * both detail pages, because reach and client-mix are long-tailed: a bar reads
 * rank + magnitude + head/tail shape at a glance where a donut collapses past a
 * few slices and a bare table shows no magnitude. Strictly monochrome; length
 * is the only encoding.
 *
 * value drives the bar length; share is the right-aligned readout (falls back to
 * the #value slot); to is an optional route for the label link. The item type is
 * generic so callers can smuggle extra fields for their slots.
 * Slots: #label({ item }), #meta({ item }), #value({ item }).
 */
interface Props {
  items?: T[]
  max?: number
  scale?: "max" | "sum"
  tailLabel?: string | ((n: number) => string)
  emptyText?: string
}
const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  max: 15,
  scale: "max",
  tailLabel: (n: number) => `+${formatNum(n)} more`,
  emptyText: "Nothing recorded.",
})

const shown = computed(() => props.items.slice(0, props.max))
const tail = computed(() => props.items.slice(props.max))

const denom = computed(() => {
  if (!shown.value.length) return 1
  if (props.scale === "sum") return props.items.reduce((s, i) => s + (i.value || 0), 0) || 1
  return Math.max(...shown.value.map((i) => i.value || 0)) || 1
})

const width = (v: number) => `${Math.max(2, ((v || 0) / denom.value) * 100)}%`

const tailText = computed(() =>
  typeof props.tailLabel === "function" ? props.tailLabel(tail.value.length) : props.tailLabel,
)
const tailShare = computed(() => tail.value.reduce((s, i) => s + (i.share || 0), 0))
</script>

<template>
  <div v-if="!items.length" class="status">{{ emptyText }}</div>
  <ul v-else class="sbl">
    <li v-for="item in shown" :key="item.key" class="row">
      <div class="label">
        <slot name="label" :item="item">
          <NuxtLink v-if="item.to" :to="item.to" class="mono lk">{{ item.label }}</NuxtLink>
          <span v-else class="mono">{{ item.label }}</span>
        </slot>
        <slot name="meta" :item="item" />
      </div>
      <div class="track"><span class="fill" :style="{ width: width(item.value) }"></span></div>
      <div class="value nums">
        <slot name="value" :item="item">{{ formatShare(item.share) }}</slot>
      </div>
    </li>
    <li v-if="tail.length" class="row row--tail">
      <div class="label mono faint">{{ tailText }}</div>
      <div class="track"></div>
      <div class="value nums faint">{{ formatShare(tailShare) }}</div>
    </li>
  </ul>
</template>

<style scoped lang="scss" src="~/styles/components/share-bar-list.scss"></style>

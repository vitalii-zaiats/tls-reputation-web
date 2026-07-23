<script setup lang="ts">
// A shimmering placeholder. `lines` stacks several blocks; `width` accepts one
// value or a per-line array so a paragraph can taper. Respects reduced-motion.
interface Props {
  lines?: number
  height?: string
  width?: string | string[]
  rounded?: string
  gap?: string
}
const props = withDefaults(defineProps<Props>(), {
  lines: 1,
  height: "1rem",
  width: "100%",
  rounded: "6px",
  gap: "0.6rem",
})

const widthAt = (i: number): string =>
  Array.isArray(props.width) ? (props.width[i] ?? props.width[props.width.length - 1] ?? "100%") : props.width
</script>

<template>
  <div class="sk" :style="{ gap }" role="status" aria-label="Loading">
    <span
      v-for="i in lines"
      :key="i"
      class="sk-block"
      :style="{ height, width: widthAt(i - 1), borderRadius: rounded }"
    />
  </div>
</template>

<style scoped>
.sk {
  display: flex;
  flex-direction: column;
}
.sk-block {
  display: block;
  background: linear-gradient(
    90deg,
    var(--panel, rgba(127, 127, 127, 0.06)) 25%,
    var(--border, rgba(127, 127, 127, 0.16)) 50%,
    var(--panel, rgba(127, 127, 127, 0.06)) 75%
  );
  background-size: 200% 100%;
  animation: sk-shimmer 1.3s ease-in-out infinite;
}
@keyframes sk-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sk-block {
    animation: none;
    opacity: 0.65;
  }
}
</style>

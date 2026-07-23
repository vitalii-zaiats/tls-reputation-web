<script setup lang="ts">
export interface StatItem {
  value: string | number
  label: string
  hint?: string
}
interface Props {
  items?: StatItem[]
}
withDefaults(defineProps<Props>(), { items: () => [] })
</script>

<template>
  <div class="stat-grid">
    <div v-for="s in items" :key="s.label" class="stat panel">
      <div class="value nums">{{ s.value }}</div>
      <div class="label">{{ s.label }}</div>
      <div v-if="s.hint" class="hint">{{ s.hint }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss" src="~/styles/components/stat-grid.scss"></style>

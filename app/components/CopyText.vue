<script setup lang="ts">
/**
 * A mono value that copies itself on click. `display` lets the visible text be
 * truncated while the full `text` is what lands on the clipboard (and in the
 * title). Used for the pasteable fingerprint strings — ja4_r, ja3_raw — and the
 * domain identifier.
 */
interface Props {
  text?: string
  display?: string
  title?: string
}
const props = withDefaults(defineProps<Props>(), { text: "", display: "", title: "" })

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  try {
    await navigator.clipboard.writeText(props.text)
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* clipboard denied — nothing to do */
  }
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <button type="button" class="copy" :title="title || text" @click="copy">
    <span class="copy-text mono">{{ display || text }}</span>
    <span class="copy-ico" :class="{ ok: copied }" aria-hidden="true">{{ copied ? "✓" : "⧉" }}</span>
    <span class="visually-hidden">{{ copied ? "copied" : "copy to clipboard" }}</span>
  </button>
</template>

<style scoped lang="scss" src="~/styles/components/copy-text.scss"></style>

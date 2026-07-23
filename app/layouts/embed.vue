<script setup lang="ts">
// Embeddable widgets are iframe fragments, not standalone pages — keep them out
// of the search index so they don't compete with the real pages.
useHead({ meta: [{ name: "robots", content: "noindex" }] })
</script>

<template>
  <!-- Chrome-less: an embedded view owns the whole frame. -->
  <slot />
</template>

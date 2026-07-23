<script setup lang="ts">
import { useDomainService } from "~/api/services/domain"
import type { GraphCanvasEdge, GraphCanvasNode } from "~/components/GraphCanvas.vue"

definePageMeta({ layout: "embed" })

const route = useRoute()
const sni = computed(() => String(route.query.sni || ""))

const domains = useDomainService()

// Keyed on the domain so switching ?sni= refetches. Skipped entirely when no
// domain is given (the empty-hint state renders instead).
const { data: seedData } = await useAsyncData(
  () => `embed:${sni.value}`,
  () => (sni.value ? domains.detail(sni.value, { limit: 80 }) : Promise.resolve(null)),
  { watch: [sni] },
)

const seedGraph = computed(() => {
  const d = seedData.value
  const rows = d?.top_fingerprints || []
  const nodes: GraphCanvasNode[] = []
  const edges: GraphCanvasEdge[] = []
  if (!sni.value) return { nodes, edges }
  nodes.push({ id: `s:${sni.value}`, t: "s", l: sni.value, d: d?.unique_fingerprints || rows.length })
  for (const r of rows) {
    if (!r.ja4) continue
    nodes.push({ id: `f:${r.ja4}`, t: "f", l: r.known?.name || r.ja4, d: r.count || 1 })
    edges.push({ s: `f:${r.ja4}`, t: `s:${sni.value}`, w: r.count || 1 })
  }
  return { nodes, edges }
})

useHead(() => ({
  title: sni.value ? `${sni.value} — tls-reputation.com` : "tls-reputation.com",
}))
</script>

<template>
  <div class="embed-graph">
    <GraphCanvas
      v-if="sni"
      :nodes="seedGraph.nodes"
      :edges="seedGraph.edges"
      height="100vh"
      :layout-ms="3500"
      always-label
    />
    <div v-else class="embed-hint">no domain — pass <code>?sni=example.com</code></div>
  </div>
</template>

<style scoped lang="scss" src="~/styles/pages/embed-graph.scss"></style>

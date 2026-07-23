<script setup lang="ts">
import { useCatalogService } from "~/api/services/catalog"
import type { GraphEdge, GraphNode } from "~/api/types"

useHead({ title: "graph — tls-reputation.com" })

const catalog = useCatalogService()
const route = useRoute()

const status = ref<"loading" | "ready" | "error">("loading")
const mode = ref<"all" | "focus">("all")
const query = ref("")
const seedLabel = ref("")
const notFound = ref(false)

// Full corpus kept out of reactivity (22k nodes); the current view is passed to
// <GraphCanvas>, which owns all the WebGL/sigma work.
const rawNodes = new Map<string, GraphNode>()
let rawEdges: GraphEdge[] = []
const viewNodes = shallowRef<GraphNode[]>([])
const viewEdges = shallowRef<GraphEdge[]>([])
const counts = computed(() => ({ nodes: viewNodes.value.length, edges: viewEdges.value.length }))

function showAll() {
  mode.value = "all"
  seedLabel.value = ""
  notFound.value = false
  viewNodes.value = [...rawNodes.values()]
  viewEdges.value = rawEdges
}

function findSeed(term: string): string | null {
  const t = term.trim().toLowerCase()
  if (!t) return null
  if (rawNodes.has(`s:${t}`)) return `s:${t}`
  if (rawNodes.has(`f:${t}`)) return `f:${t}`
  for (const id of rawNodes.keys()) {
    if (id.slice(2).toLowerCase().includes(t)) return id
  }
  return null
}

function doSearch() {
  if (status.value !== "ready") return
  const seed = findSeed(query.value)
  if (!seed) {
    notFound.value = true
    return
  }
  notFound.value = false
  // Seed + its direct neighbours, and the edges between them.
  const keep = new Set<string>([seed])
  const subEdges: GraphEdge[] = []
  for (const e of rawEdges) {
    if (e.s === seed || e.t === seed) {
      subEdges.push(e)
      keep.add(e.s)
      keep.add(e.t)
    }
  }
  mode.value = "focus"
  seedLabel.value = seed.slice(2)
  viewNodes.value = [...keep].map((id) => rawNodes.get(id)).filter((n): n is GraphNode => n !== undefined)
  viewEdges.value = subEdges
}

function onNodeClick(node: string) {
  const value = node.slice(2)
  navigateTo(node[0] === "f" ? `/fp/${encodeURIComponent(value)}` : `/sni/${encodeURIComponent(value)}`)
}

// Honour a ?focus= deep link (the "explore in graph →" links from the detail
// pages): focus that node's neighbourhood instead of drawing the whole corpus.
function applyView() {
  const focus = route.query.focus
  if (typeof focus === "string" && focus) {
    query.value = focus
    doSearch()
  } else {
    showAll()
  }
}

onMounted(async () => {
  try {
    const data = await catalog.graph()
    for (const n of data.nodes) rawNodes.set(n.id, n)
    rawEdges = data.edges
    status.value = "ready"
    applyView()
  } catch (e) {
    console.error("[graph]", e)
    status.value = "error"
  }
})

// Re-focus if the ?focus= changes while already on the graph page.
watch(
  () => route.query.focus,
  () => {
    if (status.value === "ready") applyView()
  },
)
</script>

<template>
  <div class="graph-page">
    <div class="graph-head">
      <h1>The graph</h1>
      <p class="muted">
        Every fingerprint and the domains it reaches. The amber hubs are browsers — one Chrome fans out to
        thousands of server names; single-purpose tools stay pinned to a handful. Drag to pan, scroll to zoom,
        hover to isolate, click to open.
      </p>
    </div>

    <div class="graph-tools">
      <button
        class="control"
        :class="{ 'control--active': mode === 'all' }"
        :disabled="status !== 'ready'"
        @click="showAll"
      >
        Show all
      </button>
      <form class="gsearch" @submit.prevent="doSearch">
        <input
          v-model="query"
          class="ginput mono"
          type="text"
          placeholder="focus a JA4 or a domain…"
          spellcheck="false"
          autocapitalize="off"
          :disabled="status !== 'ready'"
        />
        <button class="control" type="submit" :disabled="status !== 'ready'">focus</button>
      </form>
      <span v-if="mode === 'focus' && !notFound" class="gnote mono">
        focused: <code>{{ seedLabel }}</code> · {{ formatNum(counts.nodes) }} nodes
      </span>
      <span v-if="notFound" class="gnote gnote--err mono">no node matches that.</span>
    </div>

    <div v-if="status === 'error'" class="graph-err">
      couldn’t load the graph — the /graph endpoint may not be deployed yet.
    </div>
    <GraphCanvas
      v-else
      :nodes="viewNodes"
      :edges="viewEdges"
      height="72vh"
      :always-label="mode === 'focus'"
      :layout-ms="mode === 'focus' ? 3500 : 7000"
      @node-click="onNodeClick"
    />

    <p v-if="status === 'ready'" class="graph-legend mono">
      <span class="key key--fp">fingerprints</span>
      <span class="key key--sni">domains</span>
      <span class="count">{{ formatNum(counts.nodes) }} nodes · {{ formatNum(counts.edges) }} edges</span>
    </p>
  </div>
</template>

<style scoped lang="scss" src="~/styles/pages/graph.scss"></style>

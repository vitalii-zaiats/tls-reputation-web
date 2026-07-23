<script setup lang="ts">
/**
 * The shared WebGL graph renderer. Give it `nodes` ({ id, t, l, d }) and
 * `edges` ({ s, t }); it builds a graphology graph, spreads it with ForceAtlas2
 * in a worker, and draws it with sigma. Client-only — sigma is imported inside
 * onMounted, so SSR just emits the container. Re-renders when the data changes.
 */
export interface GraphCanvasNode {
  id: string
  t: string
  l: string
  d: number
}
export interface GraphCanvasEdge {
  s: string
  t: string
  w?: number
}
interface Props {
  nodes?: GraphCanvasNode[]
  edges?: GraphCanvasEdge[]
  height?: string
  layoutMs?: number
  alwaysLabel?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  nodes: () => [],
  edges: () => [],
  height: "72vh",
  layoutMs: 6000,
  alwaysLabel: false, // label every node (focused views)
})

const emit = defineEmits<{ nodeClick: [node: string] }>()

const container = ref<HTMLElement | null>(null)
// Only the dynamically-imported, untyped libraries stay `any`.
let Graph: any, Sigma: any, forceAtlas2: any, FA2Layout: any
let renderer: any = null
let layout: any = null
let pal: ReturnType<typeof palette>
let hovered: string | null = null
let libsReady = false

function palette() {
  let dark = true
  try {
    const m = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)
    if (m) {
      const [r = 0, g = 0, b = 0] = m.map(Number)
      dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 128
    }
  } catch (e) {}
  return dark
    ? { fp: "#e0a03a", sni: "#6f757e", edge: "rgba(212,216,224,0.09)", edgeHi: "rgba(224,160,58,0.7)", label: "#c9ccd2", dim: "#31343b" }
    : { fp: "#c8791a", sni: "#98a0a9", edge: "rgba(44,52,64,0.18)", edgeHi: "rgba(190,115,20,0.75)", label: "#3d424a", dim: "#d9dce1" }
}

function nodeAttrs(n: GraphCanvasNode) {
  const isFp = n.t === "f"
  return {
    label: n.l,
    kind: n.t,
    color: isFp ? pal.fp : pal.sni,
    size: isFp
      ? Math.min(20, 3 + Math.sqrt(n.d || 1) * 0.7)
      : Math.min(11, 1.4 + Math.sqrt(n.d || 1) * 1.4),
    x: Math.random(),
    y: Math.random(),
  }
}

function stopLayout() {
  if (layout) {
    layout.stop()
    layout.kill?.()
    layout = null
  }
}
function destroy() {
  stopLayout()
  if (renderer) {
    renderer.kill()
    renderer = null
  }
}

function render() {
  destroy()
  if (!container.value || !props.nodes.length) return

  const graph = new Graph({ type: "undirected", multi: false })
  for (const n of props.nodes) graph.addNode(n.id, nodeAttrs(n))
  for (const e of props.edges) {
    if (graph.hasNode(e.s) && graph.hasNode(e.t) && !graph.hasEdge(e.s, e.t)) {
      graph.addEdge(e.s, e.t, { color: pal.edge })
    }
  }
  hovered = null

  renderer = new Sigma(graph, container.value, {
    defaultEdgeColor: pal.edge,
    labelFont: '"IBM Plex Mono", ui-monospace, monospace',
    labelColor: { color: pal.label },
    labelSize: 11,
    labelRenderedSizeThreshold: props.alwaysLabel ? 0 : 9,
    minCameraRatio: 0.04,
    maxCameraRatio: 3,
    nodeReducer(node: string, d: any) {
      if (!hovered) return d
      if (node === hovered || graph.areNeighbors(hovered, node)) return d
      return { ...d, color: pal.dim, label: "" }
    },
    edgeReducer(edge: string, d: any) {
      if (!hovered) return d
      return graph.hasExtremity(edge, hovered) ? { ...d, color: pal.edgeHi } : { ...d, hidden: true }
    },
  })

  renderer.on("enterNode", ({ node }: { node: string }) => {
    hovered = node
    renderer.refresh()
  })
  renderer.on("leaveNode", () => {
    hovered = null
    renderer.refresh()
  })
  renderer.on("clickNode", ({ node }: { node: string }) => emit("nodeClick", node))

  const settings = forceAtlas2.inferSettings(graph)
  layout = new FA2Layout(graph, { settings: { ...settings, barnesHutOptimize: true } })
  layout.start()
  setTimeout(stopLayout, props.layoutMs)
}

async function ensureRender() {
  if (!libsReady) {
    const [g, s, f, fw] = await Promise.all([
      import("graphology"),
      import("sigma"),
      import("graphology-layout-forceatlas2"),
      import("graphology-layout-forceatlas2/worker"),
    ])
    Graph = g.default
    Sigma = s.Sigma || s.default
    forceAtlas2 = f.default
    FA2Layout = fw.default
    pal = palette()
    libsReady = true
  }
  render()
}

onMounted(ensureRender)
watch(
  () => [props.nodes, props.edges],
  () => {
    if (libsReady) render()
  },
)
onBeforeUnmount(destroy)
</script>

<template>
  <div ref="container" class="graph-canvas" :style="{ height }">
    <div v-if="!nodes.length" class="graph-status">loading…</div>
  </div>
</template>

<style scoped lang="scss" src="~/styles/components/graph-canvas.scss"></style>

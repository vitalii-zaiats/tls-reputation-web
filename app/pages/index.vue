<script setup lang="ts">
import { useCatalogService } from "~/api/services/catalog"
import { useDomainService } from "~/api/services/domain"
import type { Stats } from "~/api/types"
import type { GraphCanvasEdge, GraphCanvasNode } from "~/components/GraphCanvas.vue"

const catalog = useCatalogService()
const domains = useDomainService()

const { data: stats } = await useAsyncData("stats", () => catalog.stats())
// Partial, not a zero-filled Stats: on a failed /stats the numeric fields stay
// undefined so formatNum renders "—" rather than a misleading "0".
const s = computed<Partial<Stats>>(() => stats.value ?? {})

// --- ALPN offer distribution ---
const { data: alpnData } = await useAsyncData("alpn", () => catalog.alpn())
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) + "%" : "—")

const alpnCats = computed(() => {
  const d = alpnData.value
  const items = d?.items || []
  const totalObs = d?.total_observations || items.reduce((n, r) => n + (r.observations || 0), 0) || 1
  const totalFps = d?.total_fingerprints || items.reduce((n, r) => n + (r.fingerprints || 0), 0) || 1
  const sorted = [...items].sort((a, b) => (b.observations || 0) - (a.observations || 0))
  const COLORS = ["var(--c0)", "var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)"]
  const TOP = 5

  const cats = sorted.slice(0, TOP).map((r, i) => ({
    label: r.label || (r.alpn && r.alpn.length ? r.alpn.join(", ") : "(none)"),
    color: COLORS[i] ?? "var(--c-other)",
    obs: r.observations || 0,
    fps: r.fingerprints || 0,
  }))
  const rest = sorted.slice(TOP)
  if (rest.length) {
    cats.push({
      label: `other · ${rest.length} more`,
      color: "var(--c-other)",
      obs: rest.reduce((n, r) => n + (r.observations || 0), 0),
      fps: rest.reduce((n, r) => n + (r.fingerprints || 0), 0),
    })
  }
  return cats.map((c) => ({ ...c, obsPct: pct(c.obs, totalObs), fpsPct: pct(c.fps, totalFps) }))
})

const alpnObs = computed(() => alpnCats.value.map((c) => ({ label: c.label, value: c.obs, color: c.color })))
const alpnFps = computed(() => alpnCats.value.map((c) => ({ label: c.label, value: c.fps, color: c.color })))
const browserObsPct = computed(() => alpnCats.value[0]?.obsPct || "—")
const browserFpsPct = computed(() => alpnCats.value[0]?.fpsPct || "—")

// The busiest offers, with their per-client composition, for the stacked bars.
const alpnTop = computed(() =>
  [...(alpnData.value?.items || [])]
    .sort((a, b) => (b.observations || 0) - (a.observations || 0))
    .slice(0, 6),
)

// --- home graph: www.google.com's neighbourhood (light, not the full graph) ---
const GRAPH_SEED = "www.google.com"
const { data: seedData } = await useAsyncData("homegraph", () => domains.detail(GRAPH_SEED, { limit: 80 }))

const seedGraph = computed(() => {
  const d = seedData.value
  const rows = d?.top_fingerprints || []
  const nodes: GraphCanvasNode[] = [
    { id: `s:${GRAPH_SEED}`, t: "s", l: GRAPH_SEED, d: d?.unique_fingerprints || rows.length },
  ]
  const edges: GraphCanvasEdge[] = []
  for (const r of rows) {
    if (!r.ja4) continue
    nodes.push({ id: `f:${r.ja4}`, t: "f", l: r.known?.name || r.ja4, d: r.count || 1 })
    edges.push({ s: `f:${r.ja4}`, t: `s:${GRAPH_SEED}`, w: r.count || 1 })
  }
  return { nodes, edges }
})

function onGraphNodeClick(node: string) {
  const v = node.slice(2)
  navigateTo(node[0] === "f" ? `/fp/${encodeURIComponent(v)}` : `/sni/${encodeURIComponent(v)}`)
}
</script>

<template>
  <section class="hero">
    <div class="hero-bg" aria-hidden="true"></div>

    <div class="hero-inner">
      <h1>A public, free lookup service for TLS client fingerprints.</h1>
      <p class="lede">
        Paste a <strong>JA3</strong> or <strong>JA4</strong> to see what software opened a connection — and,
        across the domains it reaches, how it behaves. Or look up a <strong>domain</strong> to see whether it
        has been reached through a residential proxy network, and by which clients.
      </p>

      <div class="hero-lookup">
        <LookupInput size="lg" />
      </div>

      <dl class="hero-stats">
        <div>
          <dt>fingerprints</dt>
          <dd>{{ formatNum(s.fingerprints) }}</dd>
        </div>
        <div>
          <dt>observations</dt>
          <dd>{{ formatNum(s.observations) }}</dd>
        </div>
        <div>
          <dt>domains</dt>
          <dd>{{ formatNum(s.snis) }}</dd>
        </div>
      </dl>
    </div>
  </section>

  <section id="how" class="how section">
    <h2>How it works</h2>

    <p class="how-intro">
      The corpus is built from <strong>inside a residential proxy network</strong>. We join it as a swarm of
      peers — decoys that do nothing but listen.
    </p>

    <figure class="how-fig panel">
      <NetworkDiagram />
      <figcaption>
        <span class="key key--peer">residential peers</span>
        <span class="key key--decoy">our decoys — and the sessions they observe</span>
      </figcaption>
    </figure>

    <div class="how-grid">
      <ol class="steps">
        <li>
          <span class="num">1</span>
          <span>Every session routed through a decoy drags its TLS ClientHello and the domain it is reaching for.</span>
        </li>
        <li>
          <span class="num">2</span>
          <span>We record the fingerprint and the server name — never the peer’s IP. Just <code>(fingerprint, SNI)</code>.</span>
        </li>
        <li>
          <span class="num">3</span>
          <span>Folded together, millions of these become a reputation: what the software is, and how it behaves across everything it touches.</span>
        </li>
      </ol>

      <CaptureFeed />
    </div>
  </section>

  <section class="alpn section">
    <h2>ALPN offers</h2>

    <p class="alpn-intro">
      ALPN is the one thing you can read off a single handshake. A browser offers <code>h2</code> then
      <code>http/1.1</code>, in that order; a library offers <code>http/1.1</code> or nothing at all. Here is
      how the corpus splits — by connections, and by the distinct fingerprints behind them.
    </p>

    <div class="alpn-wrap">
      <div class="donuts">
        <DonutChart
          :items="alpnObs"
          :size="122"
          :thickness="15"
          :center-label="browserObsPct"
          center-sub="connections"
        />
        <DonutChart
          :items="alpnFps"
          :size="122"
          :thickness="15"
          :center-label="browserFpsPct"
          center-sub="fingerprints"
        />
      </div>

      <ul class="alpn-legend">
        <li v-for="c in alpnCats" :key="c.label">
          <span class="sw" :style="{ background: c.color }"></span>
          <code>{{ c.label }}</code>
          <span class="pct nums">{{ c.obsPct }}</span>
        </li>
      </ul>
    </div>

    <p class="footnote">
      The amber slice is <code>h2, http/1.1</code> — the browser offer. It carries most of the connections but
      a smaller share of the fingerprints: a handful of library offers fragment into many distinct stacks.
    </p>

    <h3 class="alpn-sub">Who is behind each offer</h3>
    <p class="alpn-sub-note">
      The amber length is the share we can name; the neutral tail is still anonymous. Browsers cluster in
      <code>h2, http/1.1</code>; the HTTP-library stacks — Node, Python — show up under <code>http/1.1</code>
      and <code>(none)</code>.
    </p>
    <AlpnBars :items="alpnTop" />
  </section>

  <section class="homegraph section">
    <h2>The graph</h2>
    <p class="hg-intro">
      Every fingerprint that reached <code>www.google.com</code>, sized by how much traffic it carried. Real
      browsers cluster; the odd library or bot sits off on its own. This is one slice —
      <NuxtLink to="/graph">explore the whole graph →</NuxtLink>
    </p>
    <GraphCanvas
      :nodes="seedGraph.nodes"
      :edges="seedGraph.edges"
      height="440px"
      :layout-ms="3500"
      always-label
      @node-click="onGraphNodeClick"
    />
  </section>
</template>

<style scoped lang="scss" src="~/styles/pages/index.scss"></style>

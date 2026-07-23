<script setup lang="ts">
/**
 * How a residential-proxy session actually flows, left to right:
 *
 *   attackers ─▶ provider backbones ─▶ residential peers ─▶ target servers
 *
 * Many attackers funnel through a few provider gateways, fan out across many
 * residential peers, and reach many targets. A handful of the peers are our
 * decoys; every path that runs through one is drawn in the accent and animated
 * — those are the sessions we get to see. Positions are fixed (not random), so
 * it reads as a topology and SSR/client hydrate identically; the peer column
 * gets a small fixed x-jitter so it reads as a swarm, not a grid. The motion
 * is a flowing stroke-dash; base.css disables it under prefers-reduced-motion.
 */
interface Node {
  x: number
  y: number
}
interface Peer extends Node {
  decoy?: boolean
}
interface Edge {
  x1: number
  y1: number
  x2: number
  y2: number
  tap?: boolean
}
interface Col {
  x: number
  label: string
}

const W = 820
const H = 360
const LABEL_Y = 350

const attackers: Node[] = [
  { x: 60, y: 48 },
  { x: 60, y: 128 },
  { x: 60, y: 208 },
  { x: 60, y: 288 },
]
const backbones: Node[] = [
  { x: 268, y: 70 },
  { x: 268, y: 150 },
  { x: 268, y: 230 },
]
const peers: Peer[] = [
  { x: 508, y: 30 },
  { x: 534, y: 55 },
  { x: 519, y: 81, decoy: true },
  { x: 502, y: 106 },
  { x: 537, y: 132 },
  { x: 512, y: 158, decoy: true },
  { x: 530, y: 183 },
  { x: 504, y: 209 },
  { x: 522, y: 234, decoy: true },
  { x: 536, y: 260 },
  { x: 506, y: 285 },
  { x: 526, y: 310, decoy: true },
]
const targets: Node[] = [
  { x: 752, y: 56 },
  { x: 752, y: 126 },
  { x: 752, y: 196 },
  { x: 752, y: 266 },
]

const nearest = (y: number, arr: Node[]) =>
  arr.reduce((best, n, i) => (Math.abs(n.y - y) < Math.abs(arr[best]!.y - y) ? i : best), 0)
const nearestN = (y: number, arr: Node[], n: number) =>
  arr
    .map((m, i) => ({ i, d: Math.abs(m.y - y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((o) => o.i)

const peerBackbone = peers.map((p) => nearest(p.y, backbones))
const peerTarget = peers.map((p) => nearest(p.y, targets))
const backboneTapped = backbones.map((_, i) =>
  peers.some((p, k) => peerBackbone[k] === i && p.decoy),
)

const edges: Edge[] = []
attackers.forEach((a) =>
  nearestN(a.y, backbones, 2).forEach((bi) =>
    edges.push({ x1: a.x, y1: a.y, x2: backbones[bi]!.x, y2: backbones[bi]!.y, tap: backboneTapped[bi] }),
  ),
)
peers.forEach((p, k) => {
  const b = backbones[peerBackbone[k]!]!
  edges.push({ x1: b.x, y1: b.y, x2: p.x, y2: p.y, tap: p.decoy })
  // Decoys and every third plain peer reach for two targets — the mesh
  // should read as many-to-many, not as tidy one-to-one lanes.
  const tIdxs = p.decoy || k % 3 === 0 ? nearestN(p.y, targets, 2) : [peerTarget[k]!]
  tIdxs.forEach((ti) => {
    const t = targets[ti]!
    edges.push({ x1: p.x, y1: p.y, x2: t.x, y2: t.y, tap: p.decoy })
  })
})
// Tapped edges last, so the accent draws over the neutral mesh.
edges.sort((a, b) => Number(a.tap) - Number(b.tap))

// Horizontal-tangent cubic, so edges leave and enter columns level and bow
// in the middle — reads as flow, not as a wire chart.
const edgePath = (e: Edge) => {
  const mx = (e.x1 + e.x2) / 2
  return `M ${e.x1} ${e.y1} C ${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}`
}

const cols: Col[] = [
  { x: attackers[0]!.x, label: "attackers" },
  { x: backbones[0]!.x, label: "provider backbones" },
  { x: 520, label: "residential peers" },
  { x: targets[0]!.x, label: "target servers" },
]
</script>

<template>
  <svg
    class="net"
    :viewBox="`0 0 ${W} ${H}`"
    role="img"
    aria-label="Attackers route through provider backbones to residential proxy peers and on to target servers; the peers that are our decoys, and every session that passes through one, are highlighted."
    preserveAspectRatio="xMidYMid meet"
  >
    <g class="edges">
      <path
        v-for="(e, k) in edges"
        :key="k"
        :class="{ tap: e.tap }"
        :style="`--d:${k}`"
        :d="edgePath(e)"
      />
    </g>

    <!-- attackers: origin points -->
    <g v-for="(a, k) in attackers" :key="`a${k}`" class="node--attacker">
      <circle :cx="a.x" :cy="a.y" r="8" class="ring" />
      <circle :cx="a.x" :cy="a.y" r="2.5" class="dot" />
    </g>

    <!-- provider backbones: routing hardware -->
    <rect
      v-for="(b, k) in backbones"
      :key="`b${k}`"
      class="node--backbone"
      :x="b.x - 5"
      :y="b.y - 5"
      width="10"
      height="10"
      rx="1.5"
      :transform="`rotate(45 ${b.x} ${b.y})`"
    />

    <!-- residential peers + decoys -->
    <template v-for="(p, k) in peers" :key="`p${k}`">
      <g v-if="p.decoy" class="decoy" :style="`--i:${k}`">
        <circle :cx="p.x" :cy="p.y" r="12" class="halo" />
        <circle :cx="p.x" :cy="p.y" r="6" class="core" />
      </g>
      <circle v-else class="peer" :cx="p.x" :cy="p.y" r="3.5" />
    </template>

    <!-- target servers: little racks -->
    <g v-for="(t, k) in targets" :key="`t${k}`" class="node--target">
      <rect :x="t.x - 9" :y="t.y - 9" width="18" height="18" rx="4" />
      <line :x1="t.x - 4" :y1="t.y - 2.5" :x2="t.x + 4" :y2="t.y - 2.5" />
      <line :x1="t.x - 4" :y1="t.y + 2.5" :x2="t.x + 4" :y2="t.y + 2.5" />
    </g>

    <!-- column labels -->
    <text
      v-for="(c, k) in cols"
      :key="`c${k}`"
      class="col-label"
      :x="c.x"
      :y="LABEL_Y"
      text-anchor="middle"
    >
      {{ c.label }}
    </text>
  </svg>
</template>

<style scoped lang="scss" src="~/styles/components/network-diagram.scss"></style>

<script setup lang="ts">
/**
 * Embeddable ALPN-distribution widget. Chrome-less, fills the iframe, follows
 * the reader's OS light/dark. One measure at a time (share by fingerprint or
 * by observation), so it is a single-series ranked bar chart — one amber fill,
 * length carries magnitude, labels carry identity. No rainbow across the
 * categories; that would be a chart made of noise.
 */
import { useCatalogService } from "~/api/services/catalog"
import type { AlpnClient, AlpnOffer } from "~/api/types"

definePageMeta({ layout: "embed" })
useHead({ title: "ALPN offers — tls-reputation.com" })

const SITE = "tls-reputation.com"
const TOP = 8

const catalog = useCatalogService()

// Fetch the ALPN report; stats is a bonus (three tiles), so tolerate its
// failure rather than fail the whole widget.
const { data: alpnData, status } = await useAsyncData("embed-alpn", () => catalog.alpn())
const { data: stats } = await useAsyncData("embed-stats", () => catalog.stats().catch(() => null))

type Basis = "fingerprints" | "observations"
type ShareKey = "share_of_fingerprints" | "share_of_observations"

// A normalised offer row. Both bases live on every row so the toggle is a
// re-sort, not a re-fetch.
interface Row {
  label: string
  reversed: boolean
  fingerprints: number
  observations: number
  unique_snis: number | null
  share_of_fingerprints: number
  share_of_observations: number
  clients: AlpnClient[]
  known_fingerprints: number
  known_observations: number
}
interface RankedRow extends Row {
  isTail: boolean
}
interface Segment {
  id: string
  name: string
  known: boolean
  width: string
  tint: string
}

const loading = computed(() => status.value === "pending")
const error = computed(() => status.value === "error")

// Which basis drives the bar length. Fingerprints and observations each
// partition the corpus and sum to a whole; domains overlap, so they are shown
// only as a hover figure, never as a bar.
const basis = ref<Basis>("fingerprints")
const hovered = ref<string | null>(null)

const BASES: { key: Basis; label: string; share: ShareKey }[] = [
  { key: "fingerprints", label: "fingerprint", share: "share_of_fingerprints" },
  { key: "observations", label: "observation", share: "share_of_observations" },
]
const shareKey = computed<ShareKey>(() => BASES.find((b) => b.key === basis.value)!.share)

const rows = computed<Row[]>(() =>
  (alpnData.value?.items ?? []).map((it: AlpnOffer) => ({
    label: it.label ?? "(none offered)",
    reversed: isAlpnReversed(it.alpn),
    fingerprints: it.fingerprints,
    observations: it.observations,
    unique_snis: it.unique_snis,
    share_of_fingerprints: it.share_of_fingerprints,
    share_of_observations: it.share_of_observations,
    // Who this offer is made of, and how much of it the catalog can name.
    clients: it.clients ?? [],
    known_fingerprints: it.known_fingerprints ?? 0,
    known_observations: it.known_observations ?? 0,
  })),
)

// Ranked by the active basis, with the long tail folded into one row so the
// chart stays legible. The tail is never given a bar of its own colour trick —
// it is just the remainder.
const ranked = computed<RankedRow[]>(() => {
  const key = shareKey.value
  const sorted = [...rows.value].sort((a, b) => b[key] - a[key])
  const head = sorted.slice(0, TOP)
  const tail = sorted.slice(TOP)
  const out: RankedRow[] = head.map((r) => ({ ...r, isTail: false }))
  if (tail.length) {
    out.push({
      label: `${tail.length} more offer lists`,
      isTail: true,
      reversed: false,
      fingerprints: tail.reduce((s, r) => s + r.fingerprints, 0),
      observations: tail.reduce((s, r) => s + r.observations, 0),
      unique_snis: null,
      share_of_fingerprints: tail.reduce((s, r) => s + r.share_of_fingerprints, 0),
      share_of_observations: tail.reduce((s, r) => s + r.share_of_observations, 0),
      clients: mergeClients(tail),
      known_fingerprints: tail.reduce((s, r) => s + r.known_fingerprints, 0),
      known_observations: tail.reduce((s, r) => s + r.known_observations, 0),
    })
  }
  return out
})

/** Merge several offers' client splits into one, named biggest-first. */
function mergeClients(items: Row[]): AlpnClient[] {
  const acc = new Map<string, AlpnClient>()
  for (const it of items) {
    for (const c of it.clients ?? []) {
      const key = c.known ? c.name ?? "" : "__anon__"
      const prev = acc.get(key)
      if (prev) {
        prev.fingerprints += c.fingerprints
        prev.observations += c.observations
      } else acc.set(key, { ...c })
    }
  }
  const all = [...acc.values()]
  const named = all
    .filter((c) => c.known)
    .sort((a, b) => b.fingerprints - a.fingerprints || b.observations - a.observations)
  return [...named, ...all.filter((c) => !c.known)]
}

/* Per-row client composition, on the active basis. Named clients get amber
   tints (rank within the row), the anonymous remainder a neutral — so the
   amber fraction of a bar is how much of that offer the catalog can name. */
const NAMED_TINTS = [90, 66, 48, 36, 28, 22]
function namedTint(i: number): string {
  return `color-mix(in srgb, var(--amber) ${NAMED_TINTS[i] ?? 16}%, var(--panel-2))`
}

function compSegments(r: RankedRow): Segment[] {
  const clients = r.clients ?? []
  const total = r[basis.value] || 0
  if (!total || !clients.length) {
    return [{ id: "anon", name: "unidentified", known: false, width: "100%", tint: "var(--line-strong)" }]
  }
  let ni = -1
  return clients.map((c) => {
    const val = c[basis.value] || 0
    return {
      id: c.known ? c.name ?? "" : "(unidentified)",
      name: c.known ? c.name ?? "" : "unidentified",
      known: c.known,
      width: `${((val / total) * 100).toFixed(3)}%`,
      tint: c.known ? namedTint(++ni) : "var(--line-strong)",
    }
  })
}

function namedShare(r: RankedRow): number {
  const total = r[basis.value] || 0
  if (!total) return 0
  const known = basis.value === "observations" ? r.known_observations : r.known_fingerprints
  return (known || 0) / total
}

function compCaption(r: RankedRow): string {
  const named = (r.clients ?? []).filter((c) => c.known)
  if (!named.length) return "unidentified"
  const top = named.slice(0, 2).map((c) => c.name)
  const extra = named.length - top.length
  return `${top.join(", ")}${extra > 0 ? ` +${extra}` : ""} · ${pct(namedShare(r))} named`
}

// Scale bars so the largest fills the track: the shape of the distribution is
// the point, and it genuinely differs between the two bases.
const maxShare = computed(() => Math.max(...ranked.value.map((r) => r[shareKey.value]), 0.0001))

function pct(share: number): string {
  const v = share * 100
  if (v > 0 && v < 0.01) return "<0.01%"
  return `${v.toFixed(v < 10 ? 2 : 1)}%`
}
function width(r: RankedRow): string {
  return `${Math.max((r[shareKey.value] / maxShare.value) * 100, 1.5)}%`
}

const statTiles = computed(() => {
  if (!stats.value) return []
  return [
    { label: "fingerprints", value: formatNum(stats.value.fingerprints) },
    { label: "server names", value: formatNum(stats.value.snis) },
    { label: "observations", value: formatNum(stats.value.observations) },
  ]
})

// The widget root, measured so the frame can size to it (no inner scrollbar).
const root = ref<HTMLElement | null>(null)
let stop = () => {}

onMounted(() => {
  // Report height once content has rendered, and on every later size change.
  stop = reportEmbedHeight(() => root.value)
})
onBeforeUnmount(() => stop())
</script>

<template>
  <div ref="root" class="widget">
    <header class="head">
      <div class="titles">
        <h1>ALPN offers, live</h1>
        <p class="sub">
          What clients advertise in ALPN, in their own order — each bar split by who the
          catalog can name.
        </p>
      </div>
      <dl v-if="statTiles.length" class="stats">
        <div v-for="t in statTiles" :key="t.label" class="stat">
          <dd>{{ t.value }}</dd>
          <dt>{{ t.label }}</dt>
        </div>
      </dl>
    </header>

    <div class="toolbar">
      <span class="lbl">share by</span>
      <div class="seg" role="group" aria-label="Share basis">
        <button
          v-for="b in BASES"
          :key="b.key"
          type="button"
          class="control opt"
          :aria-pressed="basis === b.key"
          @click="basis = b.key"
        >
          {{ b.label }}
        </button>
      </div>
    </div>

    <p v-if="loading" class="state">loading…</p>
    <p v-else-if="error" class="state">couldn't load the corpus.</p>

    <div v-else class="chart" @mouseleave="hovered = null">
      <div
        v-for="r in ranked"
        :key="r.label"
        class="row"
        :class="{ tail: r.isTail, hot: hovered === r.label }"
        @mouseenter="hovered = r.label"
      >
        <div class="idcol">
          <div class="name mono">
            {{ r.label }}
            <span v-if="r.reversed" class="flag" title="http/1.1 offered before h2 — no real browser does this">⚠ reversed</span>
          </div>
          <div class="cap" :class="{ none: !r.known_fingerprints }">{{ compCaption(r) }}</div>
        </div>
        <!-- Bar length is the offer's share; the split inside it is by client —
             amber runs are the clients the catalog can name, the neutral tail is
             still anonymous. So a mostly-amber bar is identified traffic. -->
        <div class="track">
          <div class="fillwrap" :style="{ width: width(r) }">
            <span
              v-for="seg in compSegments(r)"
              :key="seg.id"
              class="seg"
              :class="{ anon: !seg.known }"
              :style="{ width: seg.width, background: seg.tint }"
              :title="seg.name"
            ></span>
          </div>
        </div>
        <div class="val mono">{{ pct(r[shareKey]) }}</div>

        <div v-if="hovered === r.label" class="tip mono">
          {{ formatNum(r.fingerprints) }} fps · {{ formatNum(r.observations) }} obs<template v-if="r.unique_snis !== null"> · {{ formatNum(r.unique_snis) }} domains</template>
        </div>
      </div>
    </div>

    <footer class="foot">
      <p class="note">
        Each bar is split by client — <span class="mono">amber</span> is a fingerprint the
        catalog can name (mostly a real Chromium engine), the neutral tail is still anonymous.
        Order is a signal too: <span class="mono">h2, http/1.1</span> and
        <span class="mono">http/1.1, h2</span> are different clients.
      </p>
      <a class="link mono" :href="`https://${SITE}`" target="_blank" rel="noopener">{{ SITE }} ↗</a>
    </footer>
  </div>
</template>

<style scoped lang="scss" src="~/styles/pages/embed-alpn.scss"></style>

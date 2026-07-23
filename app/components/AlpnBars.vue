<script setup lang="ts">
import type { AlpnOffer } from "~/api/types"

/**
 * One stacked bar per ALPN offer, split by the client behind it. Named clients
 * take an amber ramp (darkest = biggest); the anonymous remainder is neutral.
 * So the amber length is the "named" share and you can read which stacks —
 * Chromium, Node, Python requests — make up each offer.
 */
interface Props {
  items?: AlpnOffer[]
}
const props = withDefaults(defineProps<Props>(), { items: () => [] })

// "Google Chrome / Chromium" -> "Google Chrome"; drop the parenthetical tails.
const short = (n: string | null) => (n ?? "").split(" / ")[0]?.split(" (")[0]?.trim() ?? ""

const rows = computed(() =>
  props.items.map((item) => {
    const total = item.observations || 1
    const clients = [...(item.clients || [])].sort((a, b) => (b.observations || 0) - (a.observations || 0))
    const named = clients.filter((c) => c.known && c.name)
    const anonObs = Math.max(0, total - (item.known_observations || 0))

    const TOPN = 4
    const AMBER = ["var(--a0)", "var(--a1)", "var(--a2)", "var(--a3)"]
    const segs = named.slice(0, TOPN).map((c, i) => ({
      name: short(c.name),
      obs: c.observations || 0,
      color: AMBER[i],
      frac: (c.observations || 0) / total,
    }))
    const restNamed = named.slice(TOPN)
    const restObs = restNamed.reduce((n, c) => n + (c.observations || 0), 0)
    if (restObs > 0)
      segs.push({ name: `+${restNamed.length} more`, obs: restObs, color: "var(--a-rest)", frac: restObs / total })
    if (anonObs > 0)
      segs.push({ name: "anonymous", obs: anonObs, color: "var(--anon)", frac: anonObs / total })

    return {
      label: item.label || (item.alpn && item.alpn.length ? item.alpn.join(", ") : "(none)"),
      knownPct: Math.round((100 * (item.known_observations || 0)) / total),
      segs,
    }
  }),
)
</script>

<template>
  <div class="alpn-bars">
    <div v-for="row in rows" :key="row.label" class="arow">
      <code class="off">{{ row.label }}</code>

      <div class="abar" role="img" :aria-label="`${row.label}: ${row.knownPct}% named clients`">
        <span
          v-for="(seg, i) in row.segs"
          :key="i"
          class="aseg"
          :style="{ flexBasis: seg.frac * 100 + '%', background: seg.color }"
          :title="`${seg.name} — ${Math.round(seg.frac * 100)}%`"
        ></span>
      </div>

      <span class="known nums">{{ row.knownPct }}% named</span>

      <div class="alabels">
        <span v-for="(seg, i) in row.segs.filter((x) => x.frac >= 0.06)" :key="i" class="alab">
          <span class="dot" :style="{ background: seg.color }"></span>{{ seg.name }}
          <span class="faint">{{ Math.round(seg.frac * 100) }}%</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss" src="~/styles/components/alpn-bars.scss"></style>

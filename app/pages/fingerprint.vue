<script setup lang="ts">
import type { Stability } from "~/api/types"

// The visitor's own TLS fingerprint, read live from the probe server. The probe
// peeks the ClientHello of whoever connects and answers with CORS *, so the
// browser can fetch it cross-origin and learn exactly how it looks on the wire.
const PROBE_URL = "https://probe.tls-reputation.com:8443/"

interface ProbeReputation {
  observations: number
  unique_snis: number
  spread: number
  stability: Stability
  known: { name?: string } | null
  first_seen?: string
  last_seen?: string
}
interface ProbeResult {
  ja4: string
  ja3: string
  tls_version: string
  alpn: string[]
  known: { name?: string } | null
  observed: boolean
  reputation: ProbeReputation | null
}

const data = ref<ProbeResult | null>(null)
const failed = ref(false)
const pending = ref(true)

async function detect() {
  pending.value = true
  failed.value = false
  try {
    data.value = await $fetch<ProbeResult>(PROBE_URL, { retry: 0, timeout: 12000 })
  } catch {
    failed.value = true
    data.value = null
  } finally {
    pending.value = false
  }
}

// Client-only: the point is to fingerprint THIS browser's handshake, which only
// happens in the browser — never in the SSR worker.
onMounted(detect)

const rep = computed(() => data.value?.reputation ?? null)
const knownName = computed(() => data.value?.known?.name || rep.value?.known?.name || "")

const stat = computed(() =>
  rep.value
    ? [
        { value: formatNum(rep.value.observations), label: "observations" },
        { value: formatNum(rep.value.unique_snis), label: "domains reached" },
        { value: rep.value.stability?.class ?? "—", label: "stability" },
      ]
    : [],
)

useHead({ title: "Your TLS fingerprint — tls-reputation.com" })
useSeoMeta({
  description:
    "See your own browser's live TLS fingerprint (JA3/JA4) and how it compares to the reputation corpus.",
})
</script>

<template>
  <h1>Your TLS fingerprint</h1>
  <p class="lede">
    Read live from the probe, which peeks the ClientHello of your connection —
    this is how <em>this browser</em> looks on the wire.
  </p>

  <div v-if="pending" class="status">Detecting your fingerprint…</div>

  <div v-else-if="failed" class="status status--error">
    Couldn’t reach the probe. It answers on port <code>8443</code>; a firewall or
    network policy may be blocking it.
    <button class="retry" type="button" @click="detect">Try again</button>
  </div>

  <template v-else-if="data">
    <header class="head">
      <p class="eyebrow mono">JA4</p>
      <CopyText :text="data.ja4" class="hash" />
      <div class="chips">
        <VerdictChip v-if="knownName" tone="notable" :label="knownName" />
        <VerdictChip v-else tone="unestablished" label="unrecognised client" />
        <VerdictChip
          :tone="data.observed ? 'neutral' : 'unestablished'"
          :label="data.observed ? 'in the corpus' : 'never observed'"
        />
      </div>
    </header>

    <StatGrid v-if="rep" :items="stat" />

    <dl class="facts">
      <div><dt>JA3</dt><dd><CopyText :text="data.ja3" /></dd></div>
      <div><dt>TLS</dt><dd>{{ data.tls_version }}</dd></div>
      <div><dt>ALPN</dt><dd class="mono">{{ data.alpn.join(", ") }}</dd></div>
      <div v-if="rep">
        <dt>Spread</dt>
        <dd class="spread"><SpreadBar :value="rep.spread" /> <span class="mono">{{ rep.spread.toFixed(3) }}</span></dd>
      </div>
      <div v-if="rep?.stability">
        <dt>Stability</dt>
        <dd><StabilityBadge :stability="rep.stability" show-variants /></dd>
      </div>
    </dl>

    <p v-if="rep?.stability?.explanation" class="explain muted">{{ rep.stability.explanation }}</p>

    <p class="actions">
      <NuxtLink v-if="data.observed" class="cta" :to="`/fp/${encodeURIComponent(data.ja4)}`">
        Full corpus record for this fingerprint →
      </NuxtLink>
      <button class="retry" type="button" @click="detect">Re-check</button>
    </p>
  </template>
</template>

<style scoped>
.lede {
  max-width: 60ch;
}
.head {
  margin: 1.5rem 0 1rem;
}
.eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.hash {
  font-size: 1.05rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.facts {
  display: grid;
  gap: 0.6rem;
  margin: 1.25rem 0;
}
.facts > div {
  display: grid;
  grid-template-columns: 8rem 1fr;
  align-items: center;
  gap: 0.75rem;
}
.facts dt {
  color: var(--muted);
  font-size: 0.85rem;
}
.facts dd {
  margin: 0;
}
.spread {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.explain {
  max-width: 60ch;
  font-size: 0.9rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
}
.cta {
  font-weight: 500;
}
.retry {
  padding: 0.35rem 0.8rem;
  font: inherit;
  color: inherit;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
}
.retry:hover {
  border-color: var(--muted);
}
.status {
  padding: 2rem 0;
  color: var(--muted);
}
.status--error {
  color: var(--text);
}
</style>

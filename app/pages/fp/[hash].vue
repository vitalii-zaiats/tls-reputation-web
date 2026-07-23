<script setup lang="ts">
import { useFingerprintService } from "~/api/services/fingerprint"
import type { DomainReach, Ja3Variants, Stability } from "~/api/types"

const route = useRoute()
const fingerprints = useFingerprintService()

const hash = computed(() => String(route.params.hash || ""))

// The service routes a 32-hex md5 to /ja3 and anything else to /ja4.
const { data: fp, error } = await useAsyncData("fp", () => fingerprints.detail(hash.value), {
  watch: [hash],
})

const notFound = computed(() => (error.value?.statusCode ?? error.value?.status) === 404)

// ---- derived read ----
const verdict = computed(() => (fp.value ? fingerprintVerdict(fp.value) : null))
const named = computed(() => !!fp.value?.known?.name)
const mlkem = computed(() => !!fp.value && hasMlkem(fp.value))
const browserish = computed(() => !!fp.value && browserShaped(fp.value))
const stability = computed<Stability>(() => fp.value?.stability ?? { class: "unknown" })

const alpnList = computed(() => fp.value?.alpn || [])
const alpnReversed = computed(() => isAlpnReversed(alpnList.value))

// ---- at-a-glance + stats ----
const statItems = computed(() =>
  fp.value
    ? [
        { value: formatNum(fp.value.observations), label: "observations" },
        { value: formatNum(fp.value.unique_snis), label: "domains reached" },
        { value: formatDate(fp.value.first_seen), label: "first seen" },
        { value: formatDate(fp.value.last_seen), label: "last seen" },
      ]
    : [],
)

// ---- reach (top slice as bars, full list paged as the record) ----
// Only the top 15 feed the bars — the embedded top_snis holds up to 50, but the
// true remainder lives in the paged table below, so drawing a "+N more" tail
// from the 50-item slice would badly understate it (35 vs the real thousands).
const reachItems = computed(() =>
  (fp.value?.top_snis || []).slice(0, 15).map((s) => ({
    key: s.sni,
    label: s.sni,
    value: s.count,
    share: s.share,
    to: `/sni/${encodeURIComponent(s.sni)}`,
  })),
)
const embeddedReach = computed(() => (fp.value?.top_snis || []).length)
const hasFullReach = computed(() => (fp.value?.unique_snis || 0) > embeddedReach.value)

const REACH_PAGE = 50
const reachOffset = ref(0)
const reachRows = ref<DomainReach[]>([])
const reachTotal = ref(0)
const reachPending = ref(false)
async function loadReach() {
  if (!hasFullReach.value) return
  reachPending.value = true
  try {
    const r = await fingerprints.reach(hash.value, { limit: REACH_PAGE, offset: reachOffset.value })
    reachRows.value = r.items || []
    reachTotal.value = r.total || 0
  } finally {
    reachPending.value = false
  }
}
// Client-only. `immediate` covers the first load without an onMounted (which
// wouldn't re-fire when the page component is reused across route changes); the
// ja4 watch then handles every subsequent navigation, resetting paging first.
watch(
  () => fp.value?.ja4,
  () => {
    reachOffset.value = 0
    reachRows.value = []
    reachTotal.value = 0
    loadReach()
  },
  { immediate: import.meta.client },
)
watch(reachOffset, loadReach)

// ---- ja3 variants ----
const EMPTY_VARIANTS: Ja3Variants = { total: 0, capped: false, truncated: false, returned: 0, items: [] }
const variants = computed<Ja3Variants>(() => fp.value?.ja3_variants ?? EMPTY_VARIANTS)
const hasVariants = computed(() => variants.value.total > 1 && variants.value.items.length > 0)
const variantTotalObs = computed(() => fp.value?.observations || 1)

// ---- ja3-route resolution panel ----
const matched = computed(() => fp.value?.matched_ja3 || null)

useHead({ title: computed(() => `${fp.value?.known?.name || hash.value} — tls-reputation.com`) })
</script>

<template>
  <!-- ============ NOT OBSERVED / ERROR ============ -->
  <div v-if="notFound" class="status">
    Never observed.
    <span class="muted">
      This fingerprint isn’t in the corpus — which, for negative-exclusion, is itself a signal. Note that a client
      which permutes its ClientHello emits a fresh JA3 per connection, so an unseen JA3 doesn’t mean the client is
      unknown; look it up by JA4 instead. Absence is not a verdict.
    </span>
  </div>
  <div v-else-if="error" class="status status--error">Couldn’t load this fingerprint.</div>

  <template v-else-if="fp">
    <!-- ============ HEADER ============ -->
    <header class="head">
      <p class="eyebrow mono">
        <span v-if="named" class="dot" aria-hidden="true"></span>{{ named ? "known client" : "unrecognised fingerprint" }}
      </p>
      <h1 :class="{ 'mono ident': !named }">{{ named ? fp.known?.name : fp.ja4 }}</h1>
      <p v-if="named && fp.known?.env" class="sub muted">{{ fp.known?.env }}</p>

      <div class="lead-read">
        <VerdictChip v-if="verdict" :tone="verdict.tone" :label="verdict.label" />
        <p v-if="verdict" class="lead">{{ verdict.lead }}</p>
      </div>

      <div class="bar facts">
        <span class="chip">{{ fp.tls_version || "TLS" }}</span>
        <span
          class="chip"
          :class="{ 'chip--warn': alpnReversed }"
          :title="alpnReversed ? 'http/1.1 offered before h2 — reversed from a genuine browser' : ''"
        >
          <template v-if="alpnList.length">
            <span v-if="alpnReversed" class="visually-hidden">reversed ALPN order — </span>
            <span v-if="alpnReversed" aria-hidden="true">⚠ </span>ALPN {{ alpnList.join(" · ") }}
          </template>
          <template v-else>no ALPN</template>
        </span>
        <span class="chip">{{ formatDate(fp.first_seen) }} → {{ formatDate(fp.last_seen) }}</span>
      </div>

      <dl class="kv synopsis">
        <dt>JA4</dt>
        <dd><CopyText :text="fp.ja4" /></dd>
        <dt>JA4_r</dt>
        <dd><CopyText :text="fp.ja4_r" /></dd>
        <dt>JA3</dt>
        <dd>
          <CopyText v-if="fp.ja3" :text="fp.ja3" />
          <span v-else class="muted">{{ noJa3Reason(fp) }}</span>
        </dd>
        <dt>JA3_raw</dt>
        <dd>
          <CopyText v-if="fp.ja3_raw" :text="fp.ja3_raw" />
          <span v-else class="muted">—</span>
        </dd>
      </dl>

      <!-- JA3-route resolution -->
      <div v-if="matched" class="resolve panel">
        <template v-if="matched.canonical">
          This JA3 resolves unambiguously to the JA4 above.
        </template>
        <template v-else>
          <p class="rtitle mono">this JA3 also appears under:</p>
          <ul class="rlist">
            <li v-for="o in matched.also_seen_under" :key="o.ja4">
              <NuxtLink :to="`/fp/${encodeURIComponent(o.ja4)}`" class="mono">{{ o.ja4 }}</NuxtLink>
              <span class="muted nums"> · {{ formatNum(o.observations) }} obs</span>
            </li>
          </ul>
          <p class="footnote">
            One JA3 mapping to several JA4s means the same cipher/extension set arrived under different TLS versions or
            ALPNs — the JA4 is the finer identity.
          </p>
        </template>
      </div>

      <p class="explore">
        <NuxtLink :to="`/graph?focus=${encodeURIComponent(fp.ja4)}`">explore in graph →</NuxtLink>
      </p>
    </header>

    <!-- ============ READ ============ -->
    <section class="section">
      <h2>Read</h2>

      <SignalRow label="catalog identity" :tone="named ? 'strong' : 'absent'">
        <template v-if="named">Matches <strong>{{ fp.known?.name }}</strong> in the ground-truth catalogue.</template>
        <template v-else>No ground-truth build has reproduced this hello yet — absence is not a verdict.</template>
      </SignalRow>

      <SignalRow
        label="self-randomisation"
        :tone="stability.class === 'fixed' ? 'strong' : stability.class === 'unknown' ? 'absent' : 'neutral'"
      >
        <StabilityBadge :stability="stability" show-variants />
        <span v-if="stability.explanation"> — {{ stability.explanation }}</span>
      </SignalRow>

      <SignalRow v-if="browserish" label="real-browser tell" :tone="mlkem ? 'strong' : 'absent'">
        <template v-if="mlkem">
          Advertises <code>X25519MLKEM768</code> (0x11ec), a post-quantum key share only current real browsers send.
        </template>
        <template v-else>
          Browser-shaped cipher list but no post-quantum key share — the tell that separates curl-impersonate / uTLS
          from a real Chrome.
        </template>
      </SignalRow>

      <SignalRow label="reach" :tone="(fp.unique_snis || 0) > 1 ? 'neutral' : 'absent'">
        <SpreadBar :value="fp.spread" width="8rem" />
        <span v-if="(fp.unique_snis || 0) > 1">
          roams across {{ formatNum(fp.unique_snis) }} domains — spread is how evenly, not how many.
        </span>
        <span v-else>effectively one destination.</span>
      </SignalRow>

      <p class="footnote">
        Spread measures reach, not intent: it can’t tell one scraper visiting 500 domains from 500 people visiting one
        each. Stability is a claim about software — whether the stack is deterministic — nothing about who runs it.
      </p>
    </section>

    <!-- ============ FOOTPRINT ============ -->
    <section class="section">
      <h2>Footprint</h2>
      <StatGrid :items="statItems" />
    </section>

    <!-- ============ CLIENTHELLO ANATOMY ============ -->
    <section class="section">
      <h2>ClientHello anatomy</h2>
      <div class="anat-r">
        <CopyText :text="fp.ja4_r" />
      </div>
      <p class="footnote anat-note">
        The underscore groups of JA4_r are the raw cipher suites · extensions · signature algorithms behind the hash.
      </p>

      <dl class="kv meta">
        <dt>TLS version</dt><dd>{{ fp.tls_version || "—" }}</dd>
        <dt>ALPN (wire order)</dt><dd>{{ alpnList.length ? alpnList.join(", ") : "—" }}</dd>
        <dt>EC point formats</dt><dd>{{ (fp.point_formats || []).join(", ") || "—" }}</dd>
        <dt>Post-quantum key share</dt>
        <dd :class="mlkem ? 'pq-yes' : 'muted'">
          <span v-if="mlkem" class="pq-dot" aria-hidden="true"></span>{{ mlkem ? "present (X25519MLKEM768)" : "absent" }}
        </dd>
      </dl>
      <p class="footnote">
        The post-quantum key share is a structural fact about the hello, not a verdict — GREASE values are flagged the
        same neutral way.
      </p>

      <div class="anat-grid">
        <AnatomyColumn title="cipher suites" :entries="fp.cipher_suites || []" />
        <AnatomyColumn
          title="extensions"
          :entries="fp.extensions || []"
          :sorted="fp.extensions_sorted"
          :note="fp.extensions_sorted ? 'Stored sorted — under one JA4 the wire order varies by construction, so no single order is “the” order.' : ''"
        />
        <AnatomyColumn title="curves / groups" :entries="fp.curves || []" />
        <AnatomyColumn title="signature algorithms" :entries="fp.sig_algs || []" />
      </div>
    </section>

    <!-- ============ JA3 VARIANTS ============ -->
    <section v-if="hasVariants" class="section">
      <h2>JA3 variants</h2>
      <p class="lede muted">
        {{ formatNum(variants.total) }}{{ variants.capped ? "+" : "" }} distinct JA3 hashes collapse into this one JA4.
      </p>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr><th>#</th><th>JA3</th><th>JA3_raw</th><th class="r">obs</th><th class="r">share</th></tr>
          </thead>
          <tbody>
            <tr v-for="(v, i) in variants.items" :key="v.ja3">
              <td class="faint nums">{{ i }}</td>
              <td><CopyText :text="v.ja3" :display="truncateMiddle(v.ja3, 10, 6)" /></td>
              <td class="mono muted" :title="v.ja3_raw">{{ truncateMiddle(v.ja3_raw, 22, 10) }}</td>
              <td class="r nums">{{ formatNum(v.observations) }}</td>
              <td class="r nums">{{ formatShare(v.observations / variantTotalObs) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="footnote">
        JA3 hashes preserve wire order, so a permuting client mints a new one per connection; JA4 sorts the same set,
        which is why they share one JA4. Every hash here belongs to this fingerprint — there is no per-JA3 page.
        {{ variants.truncated ? `Showing the busiest ${variants.returned}.` : "" }}
      </p>
    </section>

    <!-- ============ REACH ============ -->
    <section v-if="reachItems.length" class="section">
      <h2>Reach — domains contacted</h2>
      <ShareBarList :items="reachItems" :max="15" scale="max" :tail-label="(n) => `+${formatNum(n)} more domains`" />
      <p class="footnote">
        Top {{ Math.min(15, reachItems.length) }} of {{ formatNum(fp.unique_snis) }}. Share is the fraction of this
        fingerprint’s observations reaching each name.
      </p>

      <template v-if="hasFullReach">
        <div v-if="reachPending && !reachRows.length" class="status">Loading the full domain list…</div>
        <div v-else-if="reachRows.length" class="tbl-wrap reach-tbl">
          <table class="tbl">
            <thead>
              <tr><th>domain</th><th class="r">count</th><th class="r">share</th><th class="r">first seen</th><th class="r">last seen</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in reachRows" :key="r.sni">
                <td><NuxtLink :to="`/sni/${encodeURIComponent(r.sni)}`" class="mono">{{ r.sni }}</NuxtLink></td>
                <td class="r nums">{{ formatNum(r.count) }}</td>
                <td class="r nums">{{ formatShare(r.share) }}</td>
                <td class="r nums" :title="r.first_seen ?? ''">{{ formatDate(r.first_seen) }}</td>
                <td class="r nums" :title="r.last_seen ?? ''">{{ formatDate(r.last_seen) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="reachTotal > REACH_PAGE" class="pager">
          <button class="control" :disabled="reachOffset === 0" @click="reachOffset -= REACH_PAGE">prev</button>
          <span class="muted nums">
            {{ reachOffset + 1 }}–{{ Math.min(reachOffset + REACH_PAGE, reachTotal) }} of {{ formatNum(reachTotal) }}
          </span>
          <button class="control" :disabled="reachOffset + REACH_PAGE >= reachTotal" @click="reachOffset += REACH_PAGE">
            next
          </button>
        </div>
      </template>
    </section>
  </template>
</template>

<style scoped lang="scss" src="~/styles/pages/fp.scss"></style>

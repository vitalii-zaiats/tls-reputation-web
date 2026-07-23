<script setup lang="ts">
import { useFingerprintService } from "~/api/services/fingerprint"
import { useDomainService } from "~/api/services/domain"
import type { FingerprintSummary, SortDir } from "~/api/types"

useHead({ title: "browse — tls-reputation.com" })
const fingerprints = useFingerprintService()
const domains = useDomainService()
const route = useRoute()
const router = useRouter()

type FpSortKey = "observations" | "unique_snis" | "spread" | "last_seen"
type DomainSortKey = "observations" | "unique_fingerprints" | "spread" | "last_seen"

const FP_SORTS: FpSortKey[] = ["observations", "unique_snis", "spread", "last_seen"]
const DOMAIN_SORTS: DomainSortKey[] = ["observations", "unique_fingerprints", "spread", "last_seen"]

const PAGE = 50
const ANY = "__any__"

// ---- URL state: seed the initial filter/sort/page from the query so a browse
// view is bookmarkable and survives reload; changes are mirrored back below. ----
const q0 = route.query
const qStr = (v: unknown): string | undefined => (typeof v === "string" && v.length ? v : undefined)
const qInt = (v: unknown): number => Math.max(0, Number(qStr(v)) || 0)
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => {
  const s = qStr(v) as T | undefined
  return s && allowed.includes(s) ? s : fallback
}

const tab = ref<"fingerprints" | "domains">(qStr(q0.tab) === "domains" ? "domains" : "fingerprints")

// ---- fingerprints: fetched once, filtered/sorted/paged on the client (1.3k rows) ----
// The API caps a page at 500, so pull the whole corpus (~1.3k) in a few pages
// and merge — small enough to filter and sort entirely on the client.
const { data: fpData, pending: fpPending } = useAsyncData(
  "browse-fps",
  async () => {
    const LIM = 500
    const first = await fingerprints.list({ limit: LIM, offset: 0 })
    const total = first.total || (first.items || []).length
    const items = [...(first.items || [])]
    const reqs = []
    for (let off = LIM; off < total; off += LIM) reqs.push(fingerprints.list({ limit: LIM, offset: off }))
    for (const r of await Promise.all(reqs)) items.push(...(r.items || []))
    return { items, total }
  },
  { server: false, lazy: true },
)
const allFps = computed(() => fpData.value?.items || [])

const fpSort = ref<FpSortKey>(oneOf(q0.sort, FP_SORTS, "observations"))
const fpDir = ref<SortDir>(qStr(q0.dir) === "asc" ? "asc" : "desc")
const fpPage = ref(qInt(q0.page))
const clientFilter = ref(qStr(q0.client) ?? ANY)
const alpnFilter = ref(qStr(q0.alpn) ?? ANY)

// Clicking the active sort flips its direction; picking a new one starts at desc.
function pickFpSort(s: FpSortKey) {
  if (fpSort.value === s) fpDir.value = fpDir.value === "desc" ? "asc" : "desc"
  else {
    fpSort.value = s
    fpDir.value = "desc"
  }
}
const alpnLabel = (f: FingerprintSummary) => (f.alpn && f.alpn.length ? f.alpn.join(", ") : "(none)")
const clientLabel = (f: FingerprintSummary) => f.known?.name || "— unnamed"

const clientOptions = computed(() => {
  const m = new Map<string, number>()
  for (const f of allFps.value) m.set(clientLabel(f), (m.get(clientLabel(f)) || 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
})
const alpnFilterOptions = computed(() => {
  const m = new Map<string, number>()
  for (const f of allFps.value) m.set(alpnLabel(f), (m.get(alpnLabel(f)) || 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
})

const filteredFps = computed(() => {
  let arr = allFps.value
  if (clientFilter.value !== ANY) arr = arr.filter((f) => clientLabel(f) === clientFilter.value)
  if (alpnFilter.value !== ANY) arr = arr.filter((f) => alpnLabel(f) === alpnFilter.value)
  const key = fpSort.value
  const dir = fpDir.value === "asc" ? 1 : -1
  const val = (x: FingerprintSummary): number => {
    if (key === "last_seen") return new Date(x.last_seen ?? 0).getTime()
    const n = x[key]
    return typeof n === "number" ? n : 0
  }
  return [...arr].sort((a, b) => dir * (val(a) - val(b)))
})
const fpTotal = computed(() => filteredFps.value.length)
const fpPageItems = computed(() => filteredFps.value.slice(fpPage.value * PAGE, fpPage.value * PAGE + PAGE))
watch([clientFilter, alpnFilter, fpSort, fpDir], () => (fpPage.value = 0))

// ---- domains: server-side (20k+ rows) ----
const domainSort = ref<DomainSortKey>(oneOf(q0.dsort, DOMAIN_SORTS, "observations"))
const domainDir = ref<SortDir>(qStr(q0.ddir) === "asc" ? "asc" : "desc")
const domainPage = ref(qInt(q0.dpage))
const { data: snisData, pending: snisPending } = useAsyncData(
  "browse-snis",
  () => domains.list({ sort: domainSort.value, dir: domainDir.value, limit: PAGE, offset: domainPage.value * PAGE }),
  { watch: [domainSort, domainDir, domainPage], lazy: true },
)
const domainItems = computed(() => snisData.value?.items || [])
const domainTotal = computed(() => snisData.value?.total || 0)
watch([domainSort, domainDir], () => (domainPage.value = 0))

function pickDomainSort(s: DomainSortKey) {
  if (domainSort.value === s) domainDir.value = domainDir.value === "desc" ? "asc" : "desc"
  else {
    domainSort.value = s
    domainDir.value = "desc"
  }
}

const stabilityClass = (f: FingerprintSummary) => f.stability?.class || ""

// Mirror the current view into the URL — replace (not push) so filtering doesn't
// spam history, and only non-default params so the URL stays clean.
watch(
  [tab, fpSort, fpDir, fpPage, clientFilter, alpnFilter, domainSort, domainDir, domainPage],
  () => {
    const q: Record<string, string> = {}
    if (tab.value === "domains") q.tab = "domains"
    if (fpSort.value !== "observations") q.sort = fpSort.value
    if (fpDir.value !== "desc") q.dir = fpDir.value
    if (fpPage.value) q.page = String(fpPage.value)
    if (clientFilter.value !== ANY) q.client = clientFilter.value
    if (alpnFilter.value !== ANY) q.alpn = alpnFilter.value
    if (domainSort.value !== "observations") q.dsort = domainSort.value
    if (domainDir.value !== "desc") q.ddir = domainDir.value
    if (domainPage.value) q.dpage = String(domainPage.value)
    router.replace({ query: q })
  },
)
</script>

<template>
  <h1>Browse</h1>

  <div class="bar tabs">
    <button class="control" :class="{ 'control--active': tab === 'fingerprints' }" @click="tab = 'fingerprints'">
      fingerprints
    </button>
    <button class="control" :class="{ 'control--active': tab === 'domains' }" @click="tab = 'domains'">
      domains
    </button>
  </div>

  <!-- ============ FINGERPRINTS ============ -->
  <template v-if="tab === 'fingerprints'">
    <div class="filters">
      <label class="fld">
        <span>client</span>
        <select v-model="clientFilter" class="control">
          <option :value="ANY">any client</option>
          <option v-for="[name, n] in clientOptions" :key="name" :value="name">{{ name }} ({{ n }})</option>
        </select>
      </label>
      <label class="fld">
        <span>ALPN</span>
        <select v-model="alpnFilter" class="control">
          <option :value="ANY">any ALPN</option>
          <option v-for="[label, n] in alpnFilterOptions" :key="label" :value="label">{{ label }} ({{ n }})</option>
        </select>
      </label>
      <div class="fld">
        <span>sort</span>
        <div class="bar">
          <button
            v-for="s in FP_SORTS"
            :key="s"
            class="control"
            :class="{ 'control--active': fpSort === s }"
            :title="fpSort === s ? 'click to flip direction' : 'sort by ' + s.replace('_', ' ')"
            @click="pickFpSort(s)"
          >
            {{ s.replace("_", " ") }}<span v-if="fpSort === s" class="arrow">{{ fpDir === "asc" ? "↑" : "↓" }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="fpPending" class="status">Loading fingerprints…</div>
    <div v-else class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>JA4</th>
            <th>client</th>
            <th>ALPN</th>
            <th>stability</th>
            <th class="r">obs</th>
            <th class="r">domains</th>
            <th class="r">spread</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in fpPageItems" :key="f.ja4">
            <td><NuxtLink :to="`/fp/${encodeURIComponent(f.ja4)}`" class="mono">{{ f.ja4 }}</NuxtLink></td>
            <td :class="{ muted: !f.known }">{{ clientLabel(f) }}</td>
            <td class="mono muted">{{ alpnLabel(f) }}</td>
            <td>
              <span v-if="stabilityClass(f)" class="chip" :class="`chip--${stabilityClass(f)}`">{{ stabilityClass(f) }}</span>
            </td>
            <td class="r nums">{{ formatNum(f.observations) }}</td>
            <td class="r nums">{{ formatNum(f.unique_snis) }}</td>
            <td class="r nums">{{ formatSpread(f.spread) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="fpTotal > PAGE" class="pager">
      <button class="control" :disabled="fpPage === 0" @click="fpPage--">prev</button>
      <span class="muted">{{ fpPage * PAGE + 1 }}–{{ Math.min((fpPage + 1) * PAGE, fpTotal) }} of {{ formatNum(fpTotal) }}</span>
      <button class="control" :disabled="(fpPage + 1) * PAGE >= fpTotal" @click="fpPage++">next</button>
    </div>
  </template>

  <!-- ============ DOMAINS ============ -->
  <template v-else>
    <div class="filters">
      <div class="fld">
        <span>sort</span>
        <div class="bar">
          <button
            v-for="s in DOMAIN_SORTS"
            :key="s"
            class="control"
            :class="{ 'control--active': domainSort === s }"
            :title="domainSort === s ? 'click to flip direction' : 'sort by ' + s.replace('_', ' ')"
            @click="pickDomainSort(s)"
          >
            {{ s.replace("_", " ") }}<span v-if="domainSort === s" class="arrow">{{ domainDir === "asc" ? "↑" : "↓" }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="snisPending" class="status">Loading domains…</div>
    <div v-else class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>domain</th>
            <th class="r">obs</th>
            <th class="r">clients</th>
            <th class="r">spread</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in domainItems" :key="d.sni">
            <td><NuxtLink :to="`/sni/${encodeURIComponent(d.sni)}`" class="mono">{{ d.sni }}</NuxtLink></td>
            <td class="r nums">{{ formatNum(d.observations) }}</td>
            <td class="r nums">{{ formatNum(d.unique_fingerprints) }}</td>
            <td class="r nums">{{ formatSpread(d.spread) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="domainTotal > PAGE" class="pager">
      <button class="control" :disabled="domainPage === 0" @click="domainPage--">prev</button>
      <span class="muted">{{ domainPage * PAGE + 1 }}–{{ Math.min((domainPage + 1) * PAGE, domainTotal) }} of {{ formatNum(domainTotal) }}</span>
      <button class="control" :disabled="(domainPage + 1) * PAGE >= domainTotal" @click="domainPage++">next</button>
    </div>
  </template>
</template>

<style scoped lang="scss" src="~/styles/pages/browse.scss"></style>

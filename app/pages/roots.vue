<script setup lang="ts">
import { useRootService } from "~/api/services/root"
import type { RootHostname, RootSummary } from "~/api/types"

const roots = useRootService()
const route = useRoute()
const router = useRouter()

const SORTS = ["observations", "clients", "targeting", "hostnames", "domain"] as const
type SortKey = (typeof SORTS)[number]
const PAGE = 50

function oneOf<T extends string>(v: unknown, allowed: readonly T[], d: T): T {
  return allowed.includes(v as T) ? (v as T) : d
}

const q0 = route.query
const sort = ref<SortKey>(oneOf(q0.sort, SORTS, "observations"))
const dir = ref<"asc" | "desc">(q0.dir === "asc" ? "asc" : "desc")
const page = ref(Math.max(0, Number(q0.page) || 0))

const { data, pending } = await useAsyncData(
  "roots",
  () => roots.list({ sort: sort.value, dir: dir.value, limit: PAGE, offset: page.value * PAGE }),
  { watch: [sort, dir, page] },
)

const items = computed<RootSummary[]>(() => data.value?.items || [])
const total = computed(() => data.value?.total || 0)

// Drill-down: the real SNIs under a root. The bare root is often never an
// observed SNI itself, so linking it would 404 — expand to the hostnames that
// actually exist. Lazy-loaded and cached per domain.
type SubState = "loading" | "error" | RootHostname[]
const open = ref(new Set<string>())
const subs = ref<Record<string, SubState>>({})

const isOpen = (d: string) => open.value.has(d)
const hostsOf = (d: string): RootHostname[] => {
  const s = subs.value[d]
  return Array.isArray(s) ? s : []
}

async function loadHostnames(d: string) {
  subs.value[d] = "loading"
  try {
    const r = await roots.hostnames(d, { limit: 100 })
    subs.value[d] = r.items
  } catch {
    subs.value[d] = "error"
  }
}
function toggle(d: string) {
  if (open.value.has(d)) {
    open.value.delete(d)
  } else {
    open.value.add(d)
    if (subs.value[d] === undefined) loadHostnames(d)
  }
}

function pickSort(s: SortKey) {
  if (sort.value === s) {
    dir.value = dir.value === "desc" ? "asc" : "desc"
  } else {
    sort.value = s
    dir.value = s === "domain" ? "asc" : "desc"
  }
  page.value = 0
}
const arrow = (s: SortKey) => (sort.value === s ? (dir.value === "desc" ? " ↓" : " ↑") : "")

// Keep the URL shareable — only non-defaults.
watch([sort, dir, page], () => {
  const q: Record<string, string> = {}
  if (sort.value !== "observations") q.sort = sort.value
  if (dir.value !== "desc") q.dir = dir.value
  if (page.value) q.page = String(page.value)
  router.replace({ query: q })
})

useHead({ title: "Root domains — tls-reputation.com" })
useSeoMeta({
  description:
    "Observed server names rolled up to their registrable domain (eTLD+1): distinct hostnames and total observations per site, with subdomain noise collapsed.",
})
</script>

<template>
  <h1>Root domains</h1>
  <p class="lede">
    Every observed server name folded to its registrable domain (eTLD+1), so
    subdomain sprawl collapses — the hundreds of per-widget
    <code>*.w.hcaptcha.com</code> hosts become one <code>hcaptcha.com</code>.
    <strong>hostnames</strong> is the distinct SNIs folded in; <strong>clients</strong>
    the distinct fingerprints reaching it. Many observations behind few clients is
    one operator hammering — <strong>sort by targeting</strong> to surface it.
    <span class="muted">{{ formatNum(total) }} domains.</span>
  </p>

  <div class="toolbar">
    <span class="muted lbl">sort</span>
    <button
      v-for="s in SORTS"
      :key="s"
      type="button"
      class="control"
      :class="{ 'control--active': sort === s }"
      @click="pickSort(s)"
    >
      {{ s }}{{ arrow(s) }}
    </button>
  </div>

  <div class="tbl-wrap">
    <table class="tbl">
      <thead>
        <tr>
          <th>domain</th>
          <th class="r">hostnames</th>
          <th class="r">clients</th>
          <th class="r">observations</th>
        </tr>
      </thead>
      <tbody v-if="pending">
        <tr v-for="i in 12" :key="`sk-${i}`">
          <td><Skeleton height="1.05rem" :width="['58%', '42%', '66%', '50%'][i % 4]" /></td>
          <td class="r"><Skeleton class="sk-r" height="1.05rem" width="2.5rem" /></td>
          <td class="r"><Skeleton class="sk-r" height="1.05rem" width="2.5rem" /></td>
          <td class="r"><Skeleton class="sk-r" height="1.05rem" width="4rem" /></td>
        </tr>
      </tbody>
      <tbody v-else>
        <template v-for="d in items" :key="d.domain">
          <tr class="root-row" :class="{ open: isOpen(d.domain) }">
            <td>
              <button
                type="button"
                class="toggle"
                :aria-expanded="isOpen(d.domain)"
                @click="toggle(d.domain)"
              >
                <span class="chev" :class="{ open: isOpen(d.domain) }">▸</span>
                <span class="mono">{{ d.domain }}</span>
              </button>
            </td>
            <td class="r">{{ formatNum(d.hostnames) }}</td>
            <td class="r">{{ formatNum(d.clients) }}</td>
            <td class="r">{{ formatNum(d.observations) }}</td>
          </tr>
          <tr v-if="isOpen(d.domain)" class="sub-row">
            <td colspan="4" class="sub-cell">
              <div v-if="subs[d.domain] === 'loading'" class="sub-load">
                <Skeleton :lines="3" height="0.95rem" :width="['46%', '36%', '52%']" gap="0.45rem" />
              </div>
              <p v-else-if="subs[d.domain] === 'error'" class="muted sub-msg">
                Couldn’t load hostnames.
                <button type="button" class="link" @click="loadHostnames(d.domain)">retry</button>
              </p>
              <ul v-else class="subs">
                <li v-for="h in hostsOf(d.domain)" :key="h.sni">
                  <NuxtLink :to="`/sni/${encodeURIComponent(h.sni)}`" class="mono sub-sni">{{ h.sni }}</NuxtLink>
                  <span class="sub-meta muted">
                    {{ formatNum(h.unique_fingerprints) }} clients · {{ formatNum(h.observations) }} obs
                  </span>
                </li>
                <li v-if="hostsOf(d.domain).length < d.hostnames" class="muted sub-more">
                  … and {{ formatNum(d.hostnames - hostsOf(d.domain).length) }} more
                </li>
              </ul>
            </td>
          </tr>
        </template>
        <tr v-if="!items.length">
          <td colspan="4" class="muted empty">No domains.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="pager">
    <button class="control" type="button" :disabled="page === 0" @click="page--">prev</button>
    <span class="muted range">
      {{ total ? page * PAGE + 1 : 0 }}–{{ Math.min((page + 1) * PAGE, total) }} of {{ formatNum(total) }}
    </span>
    <button class="control" type="button" :disabled="(page + 1) * PAGE >= total" @click="page++">next</button>
  </div>
</template>

<style scoped>
.lede {
  max-width: 66ch;
  margin-bottom: 1.25rem;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 1rem 0;
}
.lbl {
  margin-right: 0.25rem;
  font-size: 0.85rem;
}
.control {
  padding: 0.3rem 0.7rem;
  font: inherit;
  font-size: 0.85rem;
  color: var(--muted);
  background: var(--panel, rgba(127, 127, 127, 0.08));
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
}
.control--active {
  color: var(--text);
  border-color: var(--muted);
}
.control:disabled {
  opacity: 0.4;
  cursor: default;
}
.tbl .r {
  text-align: right;
}
.sk-r {
  align-items: flex-end;
}
.empty {
  padding: 1.5rem 0;
  text-align: center;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.25rem;
}
.range {
  font-size: 0.85rem;
}

/* drill-down accordion */
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
}
.chev {
  display: inline-block;
  width: 0.8rem;
  font-size: 0.7rem;
  color: var(--muted);
  transition: transform 0.15s ease;
}
.chev.open {
  transform: rotate(90deg);
}
.toggle:hover .mono {
  color: var(--accent, inherit);
}
.sub-row .sub-cell {
  padding: 0.3rem 0 0.7rem 1.9rem;
  background: var(--panel, rgba(127, 127, 127, 0.03));
}
.sub-load {
  padding: 0.2rem 0;
}
.subs {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.subs li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.6rem;
}
.sub-meta,
.sub-msg,
.sub-more {
  font-size: 0.82rem;
}
.link {
  padding: 0;
  font: inherit;
  color: var(--accent, inherit);
  text-decoration: underline;
  background: none;
  border: none;
  cursor: pointer;
}
</style>

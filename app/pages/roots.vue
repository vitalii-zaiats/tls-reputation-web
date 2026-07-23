<script setup lang="ts">
import { useRootService } from "~/api/services/root"
import type { RootSummary } from "~/api/types"

const roots = useRootService()
const route = useRoute()
const router = useRouter()

const SORTS = ["observations", "hostnames", "domain"] as const
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
    <strong>hostnames</strong> counts the distinct SNIs that fold into each.
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
          <th class="r">observations</th>
        </tr>
      </thead>
      <tbody v-if="pending">
        <tr v-for="i in 12" :key="`sk-${i}`">
          <td><Skeleton height="1.05rem" :width="['58%', '42%', '66%', '50%'][i % 4]" /></td>
          <td class="r"><Skeleton class="sk-r" height="1.05rem" width="2.5rem" /></td>
          <td class="r"><Skeleton class="sk-r" height="1.05rem" width="4rem" /></td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-for="d in items" :key="d.domain">
          <td>
            <NuxtLink :to="`/sni/${encodeURIComponent(d.domain)}`" class="mono">{{ d.domain }}</NuxtLink>
          </td>
          <td class="r">{{ formatNum(d.hostnames) }}</td>
          <td class="r">{{ formatNum(d.observations) }}</td>
        </tr>
        <tr v-if="!items.length">
          <td colspan="3" class="muted empty">No domains.</td>
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
</style>

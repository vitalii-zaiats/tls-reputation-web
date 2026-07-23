<script setup lang="ts">
import { useDomainService } from "~/api/services/domain"
import type { DomainClient } from "~/api/types"

// Remount on route change so navigating between two /sni/[name] routes refetches.
definePageMeta({ key: (route) => route.fullPath })

const route = useRoute()
const domains = useDomainService()
const name = computed(() => String(route.params.name || ""))

const PAGE = 50
const page = ref(0)

// Per-domain key so a remount fetches the new domain instead of the previous
// one's cached data; pagination (page ref) refetches this entry via the watch.
const { data, error, pending } = await useAsyncData(
  `sni:${name.value}`,
  () => domains.detail(name.value, { limit: PAGE, offset: page.value * PAGE }),
  { watch: [page] },
)
// Sync flush so the page reset lands before useAsyncData's own [name, page]
// watcher runs, collapsing an offset>0 domain change into a single fetch at 0.
watch(name, () => (page.value = 0), { flush: "sync" })

const notFound = computed(() => (error.value?.statusCode ?? error.value?.status) === 404)
const isAuth = computed(() => data.value?.category === "auth")
const verdict = computed(() => (data.value ? sniVerdict(data.value) : null))

const clients = computed(() => data.value?.top_fingerprints || [])
const clientLabel = (c: DomainClient) => c.known?.name || truncateMiddle(c.ja4 || c.ja3, 14, 8)
const clientTo = (c: DomainClient): string =>
  c.ja4 ? `/fp/${encodeURIComponent(c.ja4)}` : c.ja3 ? `/fp/${encodeURIComponent(c.ja3)}` : ""

// Bars only on the first page — the table below is server-paged, so a bar list
// there would silently claim the whole domain from one slice.
const onFirstPage = computed(() => page.value === 0)
const barItems = computed(() =>
  clients.value.slice(0, 15).map((c) => ({
    key: c.ja4,
    label: clientLabel(c),
    value: c.count,
    share: c.share,
    to: clientTo(c),
    _c: c,
  })),
)

const statItems = computed(() =>
  data.value
    ? [
        { value: formatNum(data.value.observations), label: "observations" },
        { value: formatNum(data.value.unique_fingerprints), label: "distinct clients" },
        { value: formatDate(data.value.first_seen), label: "first seen" },
        { value: formatDate(data.value.last_seen), label: "last seen" },
      ]
    : [],
)

const total = computed(() => data.value?.unique_fingerprints || 0)

useHead({ title: computed(() => `${name.value} — tls-reputation.com`) })
</script>

<template>
  <div v-if="notFound" class="status">
    Never observed.
    <span class="muted">No client in the corpus has reached this domain — or the name is mistyped.</span>
  </div>
  <div v-else-if="error" class="status status--error">Couldn’t load this domain.</div>

  <template v-else-if="data">
    <!-- ============ HEADER ============ -->
    <header class="head">
      <p class="eyebrow mono">
        <span v-if="isAuth" class="dot" aria-hidden="true"></span>{{ isAuth ? "auth surface" : "server name" }}
      </p>
      <h1 class="mono ident">{{ name }}</h1>

      <div class="lead-read">
        <VerdictChip v-if="verdict" :tone="verdict.tone" :label="verdict.label" />
        <p v-if="verdict" class="lead">{{ verdict.lead }}</p>
      </div>

      <div class="bar facts">
        <span v-if="isAuth" class="chip chip--accent">auth</span>
        <span class="chip">{{ formatNum(data.unique_fingerprints) }} clients</span>
        <span class="chip">{{ formatNum(data.observations) }} obs</span>
        <span class="chip">{{ formatDate(data.first_seen) }} → {{ formatDate(data.last_seen) }}</span>
      </div>

      <dl class="kv synopsis">
        <dt>domain</dt>
        <dd><CopyText :text="name" /></dd>
      </dl>

      <p class="explore">
        <NuxtLink :to="`/graph?focus=${encodeURIComponent(name)}`">explore in graph →</NuxtLink>
      </p>
    </header>

    <!-- ============ READ ============ -->
    <section class="section">
      <h2>Read</h2>

      <SignalRow
        label="client diversity"
        :tone="data.unique_fingerprints > 20 ? 'strong' : 'neutral'"
      >
        {{ formatNum(data.unique_fingerprints) }} distinct client stacks reach this name.
      </SignalRow>

      <SignalRow label="concentration" :tone="data.spread >= 0.5 ? 'strong' : 'neutral'">
        <SpreadBar :value="data.spread" width="8rem" />
        <span v-if="data.spread >= 0.5">
          traffic splits near-evenly across many unrelated stacks.
        </span>
        <span v-else>one client stack dominates — normal for an API or a CDN origin.</span>
      </SignalRow>

      <SignalRow v-if="isAuth" label="category" tone="strong">
        Looks like an auth endpoint — a hostname heuristic, high-precision / low-recall, not a verdict.
      </SignalRow>

      <SignalRow v-if="isAuth && data.spread >= 0.5 && data.observations >= 16" label="synthesis" tone="strong">
        Many unrelated stacks reaching an auth endpoint in near-equal proportion is the credential-stuffing shape. The
        corpus records no per-connection identity and cannot confirm intent.
      </SignalRow>

      <p class="footnote">
        Spread is entropy over the fingerprints reaching this domain, not over the domains a fingerprint reaches. It
        can’t distinguish one scraper from many people — it measures the mix of software, not who runs it.
      </p>
    </section>

    <!-- ============ FOOTPRINT ============ -->
    <section class="section">
      <h2>Footprint</h2>
      <StatGrid :items="statItems" />
    </section>

    <!-- ============ CLIENT STACKS ============ -->
    <section class="section">
      <h2>Client stacks reaching this name</h2>

      <template v-if="onFirstPage && barItems.length">
        <ShareBarList
          :items="barItems"
          :max="15"
          scale="max"
          :tail-label="(n) => `+${formatNum(n)} more clients`"
          empty-text="No fingerprints recorded for this name."
        >
          <template #label="{ item }">
            <NuxtLink v-if="item.to" :to="item.to" class="mono lk" :class="{ named: item._c.known }">
              {{ item.label }}
            </NuxtLink>
            <span v-else class="mono">{{ item.label }}</span>
          </template>
          <template #meta="{ item }">
            <StabilityBadge :stability="item._c.stability" />
          </template>
        </ShareBarList>
        <p class="footnote">
          Busiest {{ Math.min(15, barItems.length) }} client stacks on this page. Share is the fraction of this name’s
          observations. Many distinct fingerprints on a low-traffic name is itself worth a look; a blank JA3 is a
          permuting client — open the fingerprint for its variants.
        </p>
      </template>

      <div v-if="pending && !clients.length" class="status">Loading clients…</div>
      <div v-else-if="clients.length" class="tbl-wrap record">
        <table class="tbl">
          <thead>
            <tr>
              <th>client</th><th>JA3</th><th>stability</th>
              <th class="r">count</th><th class="r">share</th><th class="r">first seen</th><th class="r">last seen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in clients" :key="c.ja4">
              <td>
                <NuxtLink v-if="clientTo(c)" :to="clientTo(c)" class="mono">
                  {{ c.known?.name || truncateMiddle(c.ja4 || c.ja3, 16, 8) }}
                </NuxtLink>
                <span v-else class="mono muted">—</span>
                <div v-if="c.known?.env" class="env muted">{{ c.known.env }}</div>
              </td>
              <td>
                <NuxtLink v-if="c.ja3" :to="`/fp/${encodeURIComponent(c.ja3)}`" class="mono muted">
                  {{ truncateMiddle(c.ja3, 8, 6) }}
                </NuxtLink>
                <span v-else class="muted">—</span>
              </td>
              <td><StabilityBadge :stability="c.stability" /></td>
              <td class="r nums">{{ formatNum(c.count) }}</td>
              <td class="r nums">{{ formatShare(c.share) }}</td>
              <td class="r nums" :title="c.first_seen ?? ''">{{ formatDate(c.first_seen) }}</td>
              <td class="r nums" :title="c.last_seen ?? ''">{{ formatDate(c.last_seen) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="status">No fingerprints recorded for this name.</div>

      <div v-if="total > PAGE" class="pager">
        <button class="control" :disabled="page === 0" @click="page--">prev</button>
        <span class="muted nums">
          {{ page * PAGE + 1 }}–{{ Math.min((page + 1) * PAGE, total) }} of {{ formatNum(total) }}
        </span>
        <button class="control" :disabled="(page + 1) * PAGE >= total" @click="page++">next</button>
      </div>
    </section>
  </template>
</template>

<style scoped lang="scss" src="~/styles/pages/sni.scss"></style>

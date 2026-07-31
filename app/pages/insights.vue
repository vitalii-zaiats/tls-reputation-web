<script setup lang="ts">
import { useCatalogService } from "~/api/services/catalog"

const catalog = useCatalogService()
const { data } = await useAsyncData("insights", () => catalog.insights(12))

const collapse = computed(() => data.value?.collapse)
const flattest = computed(() => data.value?.flattest || [])
const concentrated = computed(() => data.value?.concentrated || [])
const platforms = computed(() => data.value?.platforms || [])

// The JA4 count minus the builds behind it: the rows that are one client seen
// through a different destination.
const inflation = computed(() => {
  const c = collapse.value
  if (!c || !c.builds) return null
  return Math.round((1 - c.builds / c.distinct_ja4) * 100)
})

const platformTotal = computed(() =>
  platforms.value.reduce((n, p) => n + (p.observations || 0), 0),
)
const platformPct = (n: number) =>
  platformTotal.value ? `${Math.round((100 * n) / platformTotal.value)}%` : "—"

// Below this a domain's flatness is arithmetic, not evidence — see the note.
const FLAT_SUSPECT = 3

useHead({ title: "Insights — how to read the corpus | tls-reputation.com" })
useSeoMeta({
  description:
    "What the TLS fingerprint corpus can and cannot tell you: why the fingerprint count overstates client diversity, why spread means opposite things on different endpoints, and the flatness statistic that separates a real audience from a rotating roster of profiles.",
})
</script>

<template>
  <h1>Insights</h1>
  <p class="lede">
    The numbers on the front page say how much was seen. These say what shape it
    was in — and where the obvious reading of a number is the wrong one.
  </p>

  <!-- ============ 1. flatness ============ -->
  <section class="section">
    <h2>A real audience is never even</h2>
    <p class="narrow">
      Client populations are power laws. On any domain with real traffic the
      busiest stack carries far more than its <code>1/N</code> share — a browser
      version everyone is on, an SDK every app embeds. So multiply the top
      stack's share by the number of stacks and organic endpoints land in double
      digits.
    </p>
    <p class="narrow">
      A value near <strong>1</strong> means every stack carried the same load.
      No audience does that. A roster of profiles being rotated does exactly
      that.
    </p>

    <div class="tbl-wrap record">
      <table class="tbl">
        <thead>
          <tr>
            <th>domain</th><th class="r">stacks</th><th class="r">observations</th>
            <th class="r">busiest stack</th><th class="r">flatness</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in flattest" :key="d.sni">
            <td>
              <NuxtLink :to="`/sni/${encodeURIComponent(d.sni)}`" class="mono">{{ d.sni }}</NuxtLink>
              <span v-if="d.category === 'auth'" class="chip chip--accent">auth</span>
            </td>
            <td class="r nums">{{ formatNum(d.stacks) }}</td>
            <td class="r nums">{{ formatNum(d.observations) }}</td>
            <td class="r nums">{{ Math.round(d.top1_share * 100) }}%</td>
            <td class="r nums" :class="{ flag: d.flatness < FLAT_SUSPECT }">
              {{ d.flatness.toFixed(2) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="footnote">
      Only domains with at least ten distinct stacks are ranked. Below that the
      statistic is arithmetic rather than evidence: with five stacks even a
      thoroughly dominated endpoint scores low, because there is nothing for the
      load to be uneven across.
    </p>
  </section>

  <!-- ============ 2. the collapse ============ -->
  <section v-if="collapse" class="section">
    <h2>The fingerprint count overstates client diversity</h2>
    <p class="narrow">
      A JA4 is three parts. <code>ja4_b</code> is the cipher list and
      <code>ja4_c</code> the extensions and signature algorithms — those belong
      to the client. <code>ja4_a</code> carries the TLS version, the cipher and
      extension counts, and the ALPN offered — and ALPN is a fact about the
      <em>destination</em>: a browser offers <code>h3</code> only where it has
      learned QUIC works, and <code>http/1.1</code> alone where it knows there is
      no h2. One browser build therefore appears under several JA4s.
    </p>

    <dl class="collapse-grid">
      <div>
        <dt>distinct JA4</dt>
        <dd>{{ formatNum(collapse.distinct_ja4) }}</dd>
      </div>
      <div>
        <dt>client builds<span class="sub">ja4_b + ja4_c</span></dt>
        <dd>{{ formatNum(collapse.builds) }}</dd>
      </div>
      <div>
        <dt>extension sets<span class="sub">ja4_c</span></dt>
        <dd>{{ formatNum(collapse.extension_sets) }}</dd>
      </div>
      <div>
        <dt>cipher lists<span class="sub">ja4_b</span></dt>
        <dd>{{ formatNum(collapse.cipher_lists) }}</dd>
      </div>
    </dl>

    <p v-if="inflation !== null" class="footnote">
      <strong>{{ inflation }}%</strong> of the JA4 rows are a client already
      counted, seen through a different destination. Group by
      <code>ja4_b + ja4_c</code> when you want clients; keep the whole JA4 when
      you want sightings.
    </p>
  </section>

  <!-- ============ 3. concentration ============ -->
  <section class="section">
    <h2>One stack, a lot of traffic</h2>
    <p class="narrow">
      The other end of the same axis. Volume behind a single client stack is one
      operator, not an audience — the corpus cannot say who, but it can say
      there was only ever one of them.
    </p>

    <div class="tbl-wrap record">
      <table class="tbl">
        <thead>
          <tr><th>domain</th><th class="r">observations</th><th class="r">stacks</th></tr>
        </thead>
        <tbody>
          <tr v-for="d in concentrated" :key="d.sni">
            <td>
              <NuxtLink :to="`/sni/${encodeURIComponent(d.sni)}`" class="mono">{{ d.sni }}</NuxtLink>
              <span v-if="d.category === 'auth'" class="chip chip--accent">auth</span>
            </td>
            <td class="r nums">{{ formatNum(d.observations) }}</td>
            <td class="r nums">1</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- ============ 4. platforms ============ -->
  <section class="section">
    <h2>What the traffic is made of</h2>
    <p class="narrow">
      Grouped by cipher list, which is a property of the TLS library build and
      passes through unchanged to everything using it — so one row here covers a
      whole family of clients. Named from the same catalogue the fingerprint
      pages use.
    </p>

    <div class="tbl-wrap record">
      <table class="tbl">
        <thead>
          <tr>
            <th>cipher list</th><th>known as</th>
            <th class="r">observations</th><th class="r">share</th><th class="r">JA4 rows</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in platforms" :key="p.cipher_list">
            <td class="mono">{{ p.cipher_list }}</td>
            <td>
              <span v-if="p.known">{{ p.known }}</span>
              <span v-else class="muted">unnamed</span>
            </td>
            <td class="r nums">{{ formatNum(p.observations) }}</td>
            <td class="r nums">{{ platformPct(p.observations) }}</td>
            <td class="r nums">{{ formatNum(p.ja4_rows) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="footnote">
      A high JA4-row count against one cipher list is the collapse above, seen
      from the other side: many destinations, one client family. An
      <span class="muted">unnamed</span> row is a cipher list the catalogue has
      not been taught yet, not an unknown client.
    </p>
  </section>

  <p class="explore">
    <NuxtLink to="/browse?tab=domains">browse every domain →</NuxtLink>
  </p>
</template>

<style scoped lang="scss" src="~/styles/pages/insights.scss"></style>

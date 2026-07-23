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

// --- programmatic examples --------------------------------------------------
// The probe answers any TLS client with that client's own fingerprint, so these
// each return something different from a browser (and from each other).
const LANGS = [
  { key: "curl", label: "curl" },
  { key: "python", label: "Python" },
  { key: "go", label: "Go" },
  { key: "node", label: "Node" },
] as const
type Lang = (typeof LANGS)[number]["key"]
const lang = ref<Lang>("curl")

const SNIPPETS: Record<Lang, string> = {
  curl: `curl https://probe.tls-reputation.com:8443/`,
  python: `import json, urllib.request

with urllib.request.urlopen("https://probe.tls-reputation.com:8443/") as r:
    fp = json.load(r)

print(fp["ja4"], fp["known"])`,
  go: `package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

func main() {
	r, _ := http.Get("https://probe.tls-reputation.com:8443/")
	defer r.Body.Close()
	var fp map[string]any
	json.NewDecoder(r.Body).Decode(&fp)
	fmt.Println(fp["ja4"])
}`,
  node: `const fp = await fetch("https://probe.tls-reputation.com:8443/")
  .then((r) => r.json())

console.log(fp.ja4, fp.known)`,
}

const EXAMPLE_OUTPUT = `{
  "ja4": "t13d4907h2_0d8feac7bc37_7395dae3b2f3",
  "ja3": "375c6162a492dfbf2795909110ce8424",
  "tls_version": "TLS 1.3",
  "alpn": ["h2", "http/1.1"],
  "known": null,
  "observed": true,
  "reputation": {
    "observations": 26,
    "unique_snis": 10,
    "spread": 0.855,
    "stability": { "class": "fixed" }
  }
}`

const copied = ref(false)
async function copyActive() {
  try {
    await navigator.clipboard.writeText(SNIPPETS[lang.value])
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* clipboard blocked — the code is selectable anyway */
  }
}

useHead({ title: "TLS fingerprint checker — your JA3 & JA4 | tls-reputation.com" })
useSeoMeta({
  description:
    "Free TLS fingerprint checker: see your browser's live JA3 and JA4 fingerprint, or query the probe from curl, Python, Go or Node — exactly how your client looks on the wire.",
})
</script>

<template>
  <h1>TLS fingerprint checker</h1>
  <p class="lede">
    Your <strong>JA3</strong> and <strong>JA4</strong> — the fingerprint of the
    TLS ClientHello your software sends. Read live below from the probe, which
    peeks the handshake of your connection: this is how <em>this client</em>
    looks on the wire, and whether the corpus has seen it before.
  </p>

  <!-- ============ LIVE: this browser ============ -->
  <section class="section">
    <h2>Your browser</h2>

    <div v-if="pending" class="status">Detecting your fingerprint…</div>

    <div v-else-if="failed" class="status status--error">
      Couldn’t reach the probe. It answers on port <code>8443</code>; a firewall
      or network policy may be blocking it.
      <button class="btn" type="button" @click="detect">Try again</button>
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
        <button class="btn" type="button" @click="detect">Re-check</button>
      </p>
    </template>
  </section>

  <!-- ============ Programmatic: any client ============ -->
  <section class="section">
    <h2>From your own client</h2>
    <p class="muted narrow">
      The probe fingerprints <em>whatever connects</em> and returns JSON — so
      curl, Python, Go, a browser and your own app each get a different JA4.
      No key, no rate limit, CORS-open.
    </p>

    <div class="tabs" role="tablist" aria-label="Example clients">
      <button
        v-for="l in LANGS"
        :key="l.key"
        type="button"
        role="tab"
        :aria-selected="lang === l.key"
        class="tab"
        :class="{ active: lang === l.key }"
        @click="lang = l.key"
      >
        {{ l.label }}
      </button>
      <button type="button" class="copy" @click="copyActive">{{ copied ? "copied" : "copy" }}</button>
    </div>

    <pre v-for="l in LANGS" v-show="lang === l.key" :key="l.key" class="code"><code>{{ SNIPPETS[l.key] }}</code></pre>

    <h3 class="ex-h">Example output</h3>
    <p class="muted narrow">
      curl isn’t a recognised browser, so <code>known</code> is <code>null</code>
      and its handshake is deterministic (<code>stability: fixed</code>). A real
      Chrome or Firefox returns its name and a completely different JA4.
    </p>
    <pre class="code"><code>{{ EXAMPLE_OUTPUT }}</code></pre>
  </section>

  <!-- ============ What is this — a little SEO/context body ============ -->
  <section class="section">
    <h2>What is a TLS fingerprint?</h2>
    <p class="muted narrow">
      Every TLS connection opens with a <em>ClientHello</em>: the versions,
      cipher suites, extensions and curves your software offers. Their exact set
      and order is characteristic of the client — a
      <strong>JA3</strong> (MD5, legacy) or <strong>JA4</strong> (readable,
      current) hash of it. It identifies <em>software</em>, not people: two
      people running the same Chrome build share a fingerprint. Look any of them
      up in the <NuxtLink to="/browse">corpus</NuxtLink>, or read the
      <NuxtLink to="/docs">API</NuxtLink>.
    </p>
  </section>
</template>

<style scoped>
.lede,
.narrow {
  max-width: 62ch;
}
.section {
  margin: 2rem 0;
}
.section h2 {
  margin-bottom: 0.75rem;
}
.head {
  margin: 1rem 0;
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
  max-width: 62ch;
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
.status {
  padding: 1.5rem 0;
  color: var(--muted);
}
.status--error {
  color: var(--text);
}

/* tabs + code */
.tabs {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  margin-bottom: -1px;
}
.tab,
.copy,
.btn {
  font: inherit;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
}
.tab {
  padding: 0.4rem 0.8rem;
  font-size: 0.9rem;
  color: var(--muted);
  border-radius: 6px 6px 0 0;
}
.tab.active {
  color: var(--text);
  background: var(--panel, rgba(127, 127, 127, 0.08));
  border-color: var(--border);
  border-bottom-color: transparent;
}
.copy {
  margin-left: auto;
  padding: 0.3rem 0.7rem;
  font-size: 0.8rem;
  color: var(--muted);
  border-radius: 6px;
}
.copy:hover {
  color: var(--text);
}
.code {
  margin: 0 0 0.5rem;
  padding: 1rem 1.1rem;
  overflow-x: auto;
  font-size: 0.85rem;
  line-height: 1.5;
  background: var(--panel, rgba(127, 127, 127, 0.08));
  border: 1px solid var(--border);
  border-radius: 0 8px 8px 8px;
}
.code code {
  font-family: inherit;
  white-space: pre;
}
.ex-h {
  margin: 1.5rem 0 0.5rem;
  font-size: 1rem;
}
.btn {
  padding: 0.35rem 0.8rem;
  background: var(--panel, rgba(127, 127, 127, 0.08));
  border-color: var(--border);
  border-radius: 6px;
}
.btn:hover {
  border-color: var(--muted);
}
</style>

<script setup lang="ts">
import { RCODE_NXDOMAIN, resolveName, type DnsAnswer } from "~/api/doh"

const props = defineProps<{ name: string }>()

const data = ref<DnsAnswer | null>(null)
const pending = ref(true)
const failed = ref(false)

async function load() {
  pending.value = true
  failed.value = false
  data.value = null
  try {
    data.value = await resolveName(props.name)
  } catch {
    failed.value = true
  } finally {
    pending.value = false
  }
}

// Client-only, and on purpose — see the note at the top of ~/api/doh.
onMounted(load)
watch(() => props.name, load)

const nxdomain = computed(() => data.value?.status === RCODE_NXDOMAIN)
const empty = computed(
  () => !!data.value && !nxdomain.value && !data.value.a.length && !data.value.aaaa.length,
)

/** Seconds as the resolver reports them, rounded to something readable. */
function ttl(seconds: number): string {
  if (seconds >= 86400) return `${Math.round(seconds / 86400)}d`
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`
  return `${seconds}s`
}
</script>

<template>
  <aside class="dns panel">
    <p class="eyebrow mono">resolves to</p>

    <div v-if="pending" class="dns-load">
      <Skeleton :lines="3" height="1.05rem" :width="['70%', '55%', '62%']" gap="0.6rem" />
    </div>

    <p v-else-if="failed" class="dns-note muted">
      Resolver unreachable. The lookup runs in your browser, so a blocked or
      filtered DNS-over-HTTPS endpoint shows up here and nowhere else.
    </p>

    <p v-else-if="nxdomain" class="dns-note muted">
      <strong class="dns-strong">NXDOMAIN</strong> — the name does not resolve today.
      The corpus saw it reached at least once, so it did once, or the client was
      sent there by something other than public DNS.
    </p>

    <p v-else-if="empty" class="dns-note muted">
      No A or AAAA record. The name exists but points at nothing addressable —
      an MX-only or TXT-only zone, or a record type this panel does not ask for.
    </p>

    <template v-else-if="data">
      <ol v-if="data.cname.length" class="dns-chain mono">
        <li v-for="(c, i) in data.cname" :key="c">
          <span class="dns-arrow" aria-hidden="true">{{ i === 0 ? "" : "↳" }}</span>{{ c }}
        </li>
      </ol>

      <dl class="dns-recs">
        <template v-if="data.a.length">
          <dt class="mono">A</dt>
          <dd>
            <ul>
              <li v-for="r in data.a" :key="r.data">
                <span class="mono nums">{{ r.data }}</span>
                <span class="dns-ttl mono">{{ ttl(r.ttl) }}</span>
              </li>
            </ul>
          </dd>
        </template>

        <template v-if="data.aaaa.length">
          <dt class="mono">AAAA</dt>
          <dd>
            <ul>
              <li v-for="r in data.aaaa" :key="r.data">
                <span class="mono nums dns-v6">{{ r.data }}</span>
                <span class="dns-ttl mono">{{ ttl(r.ttl) }}</span>
              </li>
            </ul>
          </dd>
        </template>
      </dl>
    </template>

    <p class="dns-foot">
      Live lookup through <span class="mono">1.1.1.1</span>, from your browser.
      Today's answer — not corpus data, and not what the observed client
      necessarily resolved at the time.
    </p>
  </aside>
</template>

<style scoped lang="scss" src="~/styles/components/dns-panel.scss"></style>

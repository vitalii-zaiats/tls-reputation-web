<script setup lang="ts">
import {
  RCODE_NXDOMAIN,
  resolveName,
  resolveOrigins,
  type DnsAnswer,
  type OriginGroup,
} from "~/api/doh"

const props = defineProps<{ name: string }>()

const data = ref<DnsAnswer | null>(null)
const pending = ref(true)
const failed = ref(false)

// Second phase, and allowed to be slower or to fail on its own: the addresses
// are the answer, the AS behind them is the annotation.
const origins = ref<OriginGroup[]>([])
const originsPending = ref(false)

async function load() {
  pending.value = true
  failed.value = false
  data.value = null
  origins.value = []
  try {
    const answer = await resolveName(props.name)
    data.value = answer

    const ips = [...answer.a, ...answer.aaaa].map((r) => r.data)
    if (ips.length) {
      originsPending.value = true
      try {
        origins.value = await resolveOrigins(ips)
      } catch {
        origins.value = []
      } finally {
        originsPending.value = false
      }
    }
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

      <!-- Grouped by AS: five round-robin addresses for one name are one
           origin, not five. -->
      <template v-if="origins.length">
        <p class="eyebrow mono dns-sub">announced by</p>
        <ul class="dns-origins">
          <li v-for="o in origins" :key="o.asn">
            <p class="dns-as">
              <a
                class="mono dns-asn"
                :href="`https://bgp.tools/as/${o.asn}`"
                target="_blank"
                rel="noopener"
                >AS{{ o.asn }}</a
              >
              <span v-if="o.name" class="dns-asname">{{ o.name }}</span>
            </p>
            <p class="dns-meta mono">
              <!-- One prefix is worth naming; several are worth counting, with
                   the list on hover — quoting the first would imply it covered
                   the rest. -->
              <span v-if="o.prefixes.length === 1">{{ o.prefixes[0] }}</span>
              <span v-else-if="o.prefixes.length" :title="o.prefixes.join('\n')">
                {{ o.prefixes.length }} prefixes
              </span>
              <span v-if="o.registry" class="dns-reg">{{ o.registry }}</span>
              <span v-if="o.cc" class="dns-cc" :title="`Registry country for the allocation — not a geolocation`">
                {{ o.cc }}
              </span>
            </p>
          </li>
        </ul>
      </template>
      <p v-else-if="originsPending" class="dns-note muted dns-sub">Looking up the origin AS…</p>
    </template>

    <p class="dns-foot">
      Live lookup through <span class="mono">1.1.1.1</span>, from your browser;
      the origin AS comes from Team Cymru over the same resolver. Today's answer
      — not corpus data, and not what the observed client necessarily resolved
      at the time. The country is the registry's allocation, not where the
      machine is.
    </p>
  </aside>
</template>

<style scoped lang="scss" src="~/styles/components/dns-panel.scss"></style>

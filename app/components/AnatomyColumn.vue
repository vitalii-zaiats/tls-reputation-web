<script setup lang="ts">
import type { DecodedValue } from "~/api/types"
/**
 * One decoded ClientHello list — ciphers, extensions, curves or sig-algs — as an
 * indexed "[i] 0xXXXX  NAME" column. Four of these in a collapsing grid give the
 * RFC-appendix density the reference page is after. GREASE and the post-quantum
 * curve are tagged; only the PQ curve earns the amber dot (it is the trust tell).
 *
 * entries: [{ value: "0x1301", name: "TLS_AES_128_GCM_SHA256" }]
 */
interface Props {
  title: string
  entries?: DecodedValue[]
  sorted?: boolean
  note?: string
}
const props = withDefaults(defineProps<Props>(), {
  entries: () => [],
  sorted: false,
  note: "",
})

// GREASE reserved values (RFC 8701): 0x{0a,1a,...,fa}{same}.
const GREASE = new Set(
  ["0a", "1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "aa", "ba", "ca", "da", "ea", "fa"].map(
    (b) => `0x${b}${b}`,
  ),
)

function tag(entry: DecodedValue): "pq" | "grease" | "unassigned" | null {
  if (entry.value === "0x11ec") return "pq"
  if (GREASE.has(entry.value)) return "grease"
  if (/^unknown|unassigned/i.test(entry.name)) return "unassigned"
  return null
}

const rows = computed(() => props.entries.map((e, i) => ({ ...e, i, tag: tag(e) })))
</script>

<template>
  <div class="col">
    <div class="col-head">
      <span class="mono title">{{ title }}</span>
      <span class="mono count">({{ entries.length }})</span>
      <span v-if="sorted" class="mono tag tag--sorted">sorted</span>
    </div>

    <div v-if="!rows.length" class="empty mono">none advertised</div>
    <ol v-else class="rows">
      <li v-for="r in rows" :key="r.i + r.value" class="r" :class="{ 'r--pq': r.tag === 'pq' }">
        <span class="ord mono faint">{{ r.i }}</span>
        <span class="hex mono">
          <span v-if="r.tag === 'pq'" class="pq-dot" aria-hidden="true"></span>{{ r.value }}
        </span>
        <span class="name">
          {{ r.name }}
          <span v-if="r.tag === 'pq'" class="tag tag--pq mono">PQ</span>
          <span v-else-if="r.tag === 'grease'" class="tag tag--grease mono">GREASE</span>
        </span>
      </li>
    </ol>

    <p v-if="note" class="footnote">{{ note }}</p>
  </div>
</template>

<style scoped lang="scss" src="~/styles/components/anatomy-column.scss"></style>

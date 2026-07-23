<script setup lang="ts">
/**
 * What a decoy actually sees, replayed as a capture transcript: raw
 * ClientHello bytes arrive (0x16 — a TLS handshake record), the hello is
 * parsed, ja3/ja4 are computed and one (fingerprint, sni) row is stored.
 * Pure theatre — the values are shaped like a real capture but nothing here
 * is live. SSR renders the finished transcript (so no-JS readers still get
 * the content); on mount the client replays it in a loop. Under
 * prefers-reduced-motion the replay never starts and the static transcript
 * stands. A hidden copy of the full transcript sizes the panel, so the
 * replay never changes the layout height.
 */
interface Line {
  cls?: string
  label?: string
  text: string
  note?: string
  type?: number
  ok?: boolean
  d: number
}

const LINES: Line[] = [
  { cls: "meta", text: "decoy peer · inbound session", d: 600 },
  {
    cls: "hex",
    label: "bytes",
    text: "16 03 01 02 00 01 00 01 fc 03 03 …",
    note: "← handshake",
    type: 16,
    d: 420,
  },
  { label: "msg", text: "ClientHello", d: 280 },
  { cls: "sni", label: "sni", text: "login.example.com", d: 280 },
  { label: "vers", text: "TLS 1.3", d: 240 },
  { label: "ciph", text: "1301 1302 1303 c02b c02f …", d: 240 },
  { label: "alpn", text: "h2 http/1.1", d: 420 },
  { cls: "rule", text: "", d: 300 },
  { cls: "hash", label: "ja3", text: "579ccef312d18482fc42e2b822ca2430", type: 14, ok: true, d: 460 },
  { cls: "hash", label: "ja4", text: "t13d1516h2_8daaf6152771_02713d6af862", type: 16, ok: true, d: 460 },
  { cls: "store", text: "stored → (fingerprint, sni) · observations +1", ok: true, d: 0 },
]

// Fully-shown line count + chars of the line currently being typed.
// Starts complete, so SSR and the first client paint show the whole
// transcript; the replay loop takes over after mount.
const p = ref({ line: LINES.length, chars: 0 })

const vis = (i: number) => {
  const l = LINES[i]
  if (!l) return ""
  if (i < p.value.line) return l.text
  if (i === p.value.line && l.type) return l.text.slice(0, p.value.chars)
  return ""
}

let stop = false
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function replay() {
  while (!stop) {
    p.value = { line: 0, chars: 0 }
    for (let i = 0; i < LINES.length && !stop; i++) {
      const l = LINES[i]
      if (!l) continue
      if (l.type) {
        for (let c = 0; c <= l.text.length && !stop; c += 2) {
          p.value = { line: i, chars: c }
          await sleep(l.type)
        }
      }
      p.value = { line: i + 1, chars: 0 }
      await sleep(l.d)
    }
    await sleep(4200)
  }
}

onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  replay()
})
onBeforeUnmount(() => {
  stop = true
})
</script>

<template>
  <div
    class="feed panel"
    role="img"
    aria-label="Replay of a decoy capture: ClientHello bytes arrive, the hello is parsed, ja3 and ja4 fingerprints are computed, and one fingerprint-and-SNI pair is stored."
  >
    <div class="head">
      <span class="dot" aria-hidden="true"></span>
      decoy-peer · capture
    </div>

    <div class="body" aria-hidden="true">
      <!-- invisible full transcript: fixes the panel size during replay -->
      <div class="layer sizer">
        <div v-for="(l, i) in LINES" :key="`s${i}`" :class="['line', l.cls]">
          <span v-if="l.label" class="lbl">{{ l.label }}</span>
          <span class="txt">{{ l.text }}</span>
          <span v-if="l.ok" class="ok">✓</span>
          <span v-if="l.note" class="note">{{ l.note }}</span>
        </div>
      </div>

      <div class="layer live">
        <template v-for="(l, i) in LINES" :key="`l${i}`">
          <div v-if="i <= p.line" :class="['line', l.cls]">
            <span v-if="l.label" class="lbl">{{ l.label }}</span>
            <span v-if="l.cls === 'hex'" class="txt">
              <span class="b0">{{ vis(i).slice(0, 2) }}</span>{{ vis(i).slice(2) }}
            </span>
            <span v-else class="txt">{{ vis(i) }}</span>
            <span v-if="l.ok && i < p.line" class="ok">✓</span>
            <span v-if="l.note && i < p.line" class="note">{{ l.note }}</span>
            <span v-if="i === p.line" class="caret"></span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss" src="~/styles/components/capture-feed.scss"></style>

// Auto-imported by Nuxt across pages/components.

type Numish = number | null | undefined

export const formatNum = (n: Numish): string =>
  n === null || n === undefined ? "—" : Number(n).toLocaleString("en-US")

export const formatSpread = (n: Numish): string =>
  n === null || n === undefined ? "—" : Number(n).toFixed(3)

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "—"
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return "—"
  }
}

// A 0..1 fraction as a percent. Tiny non-zero shares round to "<0.1%" rather
// than a misleading "0.0%"; below 10% keeps one decimal, above it reads as an
// integer.
export const formatShare = (frac: Numish): string => {
  if (frac === null || frac === undefined) return "—"
  const pct = frac * 100
  if (pct > 0 && pct < 0.1) return "<0.1%"
  return `${pct.toFixed(pct < 10 ? 1 : 0)}%`
}

// Collapse a long hash/identifier to head…tail, keeping both ends legible. The
// full value belongs in a title attribute on the element.
export const truncateMiddle = (s: string | null | undefined, head = 12, tail = 8): string => {
  if (!s) return "—"
  const str = String(s)
  return str.length <= head + tail + 1 ? str : `${str.slice(0, head)}…${str.slice(-tail)}`
}

// A genuine browser offers h2 before http/1.1. The reverse order is a small
// anomaly worth flagging (some impersonation stacks get it wrong).
export const isAlpnReversed = (alpn: string[] | null | undefined): boolean => {
  if (!alpn) return false
  const h2 = alpn.indexOf("h2")
  const h1 = alpn.indexOf("http/1.1")
  return h2 > -1 && h1 > -1 && h1 < h2
}

// Pure derivations of the "lead read" shown at the top of the detail pages, so
// both views stay declarative and the wording lives in one place. None of these
// rate trust — they characterise the *shape* of a client or a domain. Trust
// verdicts, and the reserved --green/--red spread scale, are deliberately out.
//
// Auto-imported by Nuxt (app/utils).
import type { DomainDetail, FingerprintDetail } from "~/api/types"

export type VerdictTone = "notable" | "neutral" | "unestablished"

export interface Verdict {
  tone: VerdictTone
  label: string
  lead: string
}

// The post-quantum key share (X25519MLKEM768). Only current real browsers send
// it; its absence on a browser-shaped hello is how curl-impersonate / uTLS give
// themselves away.
export const hasMlkem = (fp: FingerprintDetail): boolean =>
  (fp.curves || []).some((c) => c.value === "0x11ec")

const BROWSER_NAME = /chrom|firefox|safari|webkit|edge|brave|opera/i

// Does this fingerprint look like a browser — so that the MLKEM "tell" is even
// meaningful? A *named* client is browser-ish only if its catalogue name says so:
// Node.js is stability multi_build but not a browser, and a library that happens
// to send a post-quantum key share (Node 22 / OpenSSL 3.5 does) must not be read
// as one. An *unnamed* client is inferred from per-connection self-randomisation,
// the behaviour browsers exhibit — `multi_build` is the class libraries fall
// into, so it is deliberately not browser-ish.
export const browserShaped = (fp: FingerprintDetail): boolean => {
  const name = fp.known?.name
  if (name) return BROWSER_NAME.test(name)
  return fp.stability?.class === "randomizing"
}

// The minimum observations before the stability classifier commits (mirrors the
// backend's _STABILITY_MIN_OBSERVATIONS).
const MIN_OBS = 16

export function fingerprintVerdict(fp: FingerprintDetail): Verdict {
  const st = fp.stability
  if (st.class === "unknown") {
    return {
      tone: "unestablished",
      label: "Unclassified",
      lead: "Too few observations to classify this stack — a handful of connections can't tell a permuting client from coincidence.",
    }
  }

  const known = fp.known
  if (known) {
    if (browserShaped(fp)) {
      return hasMlkem(fp)
        ? {
            tone: "notable",
            label: "Real modern browser",
            lead: `${known.name}: the cipher list matches the build and it offers the X25519MLKEM768 post-quantum key share only current real browsers send.`,
          }
        : {
            tone: "neutral",
            label: "Browser build, no PQ key share",
            lead: `${known.name}: a browser-shaped hello, but without the post-quantum key share a current Chrome or Firefox would send.`,
          }
    }
    return {
      tone: "neutral",
      label: "Named client",
      lead: `Matches ${known.name} in the ground-truth catalogue.`,
    }
  }

  // Unknown / unnamed.
  if (st.class === "fixed") {
    return {
      tone: "notable",
      label: "Deterministic client",
      lead: "One JA3 across every connection — a deterministic stack, the shape of a library or command-line client, with no catalogue name yet.",
    }
  }
  if (st.class === "randomizing") {
    return {
      tone: "neutral",
      label: "Randomising client",
      lead: "Reshuffles its own ClientHello per connection — browser-shaped behaviour, but no catalogue build has reproduced this exact hello.",
    }
  }
  return {
    tone: "neutral",
    label: "Multiple builds",
    lead: "A few stable builds share this JA4 — not per-connection randomisation, and not yet a named client.",
  }
}

// Why a fingerprint has no single representative JA3, phrased for the identifier
// synopsis in place of an em dash.
export function noJa3Reason(fp: FingerprintDetail): string {
  const c = fp.stability?.class
  if (c === "randomizing")
    return "permutes its ClientHello, so every connection emits a fresh JA3 — none represents it."
  if (c === "multi_build")
    return "several builds share this JA4 under different JA3s — no single value is canonical."
  return "no single JA3 is stored for this fingerprint."
}

export function sniVerdict(sni: DomainDetail): Verdict {
  const obs = sni.observations || 0
  const spread = sni.spread || 0
  const auth = sni.category === "auth"

  if (obs < MIN_OBS) {
    return {
      tone: "unestablished",
      label: "Too few observations",
      lead: "Too little traffic to read — a spread of 1.0 over three connections is noise; the same over sixty thousand is worth a look.",
    }
  }
  if (auth && spread >= 0.5) {
    return {
      tone: "notable",
      label: "Credential-stuffing shape",
      lead: "Many unrelated client stacks reach this auth endpoint in near-equal proportion — the credential-stuffing shape. The corpus records no per-connection identity and cannot confirm intent.",
    }
  }
  if (spread < 0.25) {
    return {
      tone: "neutral",
      label: "Dominated by one stack",
      lead: "One client stack dominates the traffic to this name — normal for an API or a CDN origin.",
    }
  }
  return {
    tone: "neutral",
    label: "Mixed audience",
    lead: "A mix of client stacks reach this name, none dominating.",
  }
}

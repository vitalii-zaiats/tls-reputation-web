<script setup lang="ts">
const API = "https://api.tls-reputation.com/api/v1"

const VERDICT_OUT = `{
  "ja4": "t13d1516h2_8daaf6152771_b0da82dd1658",
  "verdict": "allow",
  "known": "Google Chrome",
  "browser": true,
  "observed": true,
  "reason": "recognised Google Chrome"
}`

const GATE = `on each request:
  hello = peek_client_hello(conn)        # MSG_PEEK, before the TLS handshake
  ja4   = ja4(hello)                     # computed at the gate, not asserted

  if cookie.valid and cookie.ja4 == ja4:
      decision = cookie.verdict          # cached — no API call this request
  else:
      decision = POST /verdict {hello}   # once per session
      set_cookie(sign({ ja4, decision }))# JWT, pinned to ja4, stateless

  if decision == "deny":       block
  if decision == "challenge":  js_challenge()   # a real browser passes; headless doesn't
  forward(origin, add_headers = {
      "X-TLS-JA4":     ja4,
      "X-TLS-Verdict": decision,
  })`

useHead({ title: "Use case — gate traffic by TLS fingerprint | tls-reputation.com" })
useSeoMeta({
  description:
    "How to use tls-reputation to gate traffic by TLS fingerprint: one /verdict call turns a ClientHello into allow / challenge / deny, and a reverse proxy pins the answer to the JA4 in a stateless cookie.",
})
</script>

<template>
  <h1>Use case</h1>
  <p class="lede">
    Tell automation from real users at the <em>TLS layer</em> — before your app
    parses a request, checks a password, or spends a database query. The
    fingerprint arrives in the first packet of every connection; this turns it
    into a decision.
  </p>

  <section class="section">
    <h2>The signal</h2>
    <p class="muted narrow">
      The corpus is gathered inside a residential proxy network, so a fingerprint
      seen here is software that routes through anonymising proxies — and ranges
      across many domains doing it. That population is disproportionately
      scrapers, checkout bots, credential stuffing. <strong>Browsers are the
      exception</strong>: they have an honest reason to be proxied (a VPN) and
      they run JavaScript, so you can challenge them. Everything else — curl,
      Go's <code>net/http</code>, headless stacks — can't pass a JS challenge and
      has no honest reason to be in a proxy pool at volume.
    </p>
  </section>

  <section class="section">
    <h2>One call: <code>/verdict</code></h2>
    <p class="muted narrow">
      Hand it the base64 of a raw ClientHello record; get back the fingerprint
      and one decision. No detail to sift, unlike <NuxtLink to="/docs">the rest
      of the API</NuxtLink> — a gate has to decide fast.
    </p>

    <pre class="code"><code>curl -s {{ API }}/verdict \
  -H 'content-type: application/json' \
  -d '{"client_hello":"&lt;base64 ClientHello&gt;"}'</code></pre>

    <pre class="code"><code>{{ VERDICT_OUT }}</code></pre>

    <table class="verdicts">
      <thead>
        <tr><th>verdict</th><th>when</th><th>do</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="v v--allow">allow</span></td>
          <td>recognised client, or browser-shaped (carries the post-quantum key share almost only browsers send)</td>
          <td>let through</td>
        </tr>
        <tr>
          <td><span class="v v--challenge">challenge</span></td>
          <td>unrecognised, or seen but not clearly ranging</td>
          <td>JS challenge / CAPTCHA</td>
        </tr>
        <tr>
          <td><span class="v v--deny">deny</span></td>
          <td>unrecognised <em>and</em> reaching many domains through the proxy network</td>
          <td>block or hard-challenge</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section class="section">
    <h2>A reverse-proxy gate</h2>
    <p class="muted narrow">
      Put a thin reverse proxy in front of your origin. It peeks the ClientHello
      before the TLS handshake consumes it, asks <code>/verdict</code> <strong>once
      per session</strong>, and pins the answer to the connection's JA4 in a
      signed cookie. Every later request rides the cookie — no API call — and the
      origin just reads a header.
    </p>

    <pre class="code"><code>{{ GATE }}</code></pre>

    <p class="muted narrow">
      The cookie is a JWT, so the gate keeps no state; and it is bound to the JA4
      the gate <em>recomputes each request</em>, so a cookie lifted onto another
      client fails the check and gets re-judged — it isn't portable. JA4 (not
      JA3) because it stays constant across the ClientHello shuffling browsers do,
      so one browser keeps one JA4 for the session and the cache actually hits.
    </p>
    <p class="muted narrow">
      A working single-file PoC of exactly this lives in the project repo under
      <code>gate/</code>.
    </p>
  </section>

  <section class="section">
    <h2>The honest limit</h2>
    <p class="muted narrow">
      A fingerprint is not a secret. A JA4 is the same for everyone on a given
      Chrome build, and a determined client can <em>spoof</em> a browser's
      ClientHello and earn an <code>allow</code>. That's the point of the layering:
      the fingerprint is the cheap first filter that decides <em>who to
      challenge</em>, and the JS challenge is what a forged ClientHello still
      can't get past. The verdict is a signal, never the last word — see
      <NuxtLink to="/">the idea</NuxtLink> and
      <NuxtLink to="/fingerprint">your own fingerprint</NuxtLink>.
    </p>
  </section>
</template>

<style scoped>
.lede,
.narrow {
  max-width: 64ch;
}
.section {
  margin: 2rem 0;
}
.section h2 {
  margin-bottom: 0.6rem;
}
.section p + .code {
  margin-top: 0.5rem;
}
.code {
  margin: 0 0 0.75rem;
  padding: 1rem 1.1rem;
  overflow-x: auto;
  font-size: 0.85rem;
  line-height: 1.5;
  background: var(--panel, rgba(127, 127, 127, 0.08));
  border: 1px solid var(--border);
  border-radius: 8px;
}
.code code {
  font-family: inherit;
  white-space: pre;
}
.verdicts {
  width: 100%;
  margin-top: 1rem;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.verdicts th,
.verdicts td {
  padding: 0.55rem 0.75rem;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--border);
}
.verdicts th {
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.v {
  padding: 0.1rem 0.5rem;
  font-size: 0.82rem;
  border-radius: 999px;
  white-space: nowrap;
}
.v--allow {
  color: #1a7f37;
  background: rgba(26, 127, 55, 0.12);
}
.v--challenge {
  color: #9a6700;
  background: rgba(154, 103, 0, 0.14);
}
.v--deny {
  color: #b3261e;
  background: rgba(179, 38, 30, 0.12);
}
</style>

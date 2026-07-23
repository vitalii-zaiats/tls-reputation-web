// One 500-domain slice of the domain corpus, selected by ?p=<page>. The index
// lists one of these per page, so each crawler request is a single upstream call.
const PAGE = 500

export default defineEventHandler(async (event) => {
  const p = Math.max(0, Math.floor(Number(getQuery(event).p) || 0))
  const { items } = await $fetch<{ items: { sni?: string }[] }>(`${apiBase(event)}/snis`, {
    query: { limit: PAGE, offset: p * PAGE },
  })
  const locs = (items || [])
    .map((it) => it.sni)
    .filter((s): s is string => !!s)
    .map((s) => `${SITE_URL}/sni/${encodeURIComponent(s)}`)
  return sendXml(event, urlsetXml(locs))
})

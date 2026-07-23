// Sitemap index. The corpus is tens of thousands of URLs, so it fans out into
// child sitemaps — one static, one for fingerprints, and one per 500-domain
// page — keeping each child to a single upstream request, well inside a
// Cloudflare worker's subrequest and CPU budget. /browse renders no crawlable
// links to the detail pages, so this sitemap is how they get discovered.
const PAGE = 500

export default defineEventHandler(async (event) => {
  let snis = 0
  try {
    const stats = await $fetch<{ snis?: number }>(`${apiBase(event)}/stats`)
    snis = stats.snis ?? 0
  } catch {
    snis = 0
  }
  const sniPages = Math.max(1, Math.ceil(snis / PAGE))
  const children = [
    `${SITE_URL}/sitemap-static.xml`,
    `${SITE_URL}/sitemap-fingerprints.xml`,
    ...Array.from({ length: sniPages }, (_, p) => `${SITE_URL}/sitemap-snis.xml?p=${p}`),
  ]
  return sendXml(event, sitemapIndexXml(children))
})

// Every fingerprint detail page (/fp/<ja4|ja3>). Small enough (a few pages of
// 500) to gather in a single child. The 100k bound is a runaway guard, never
// reached at the real corpus size.
const PAGE = 500

export default defineEventHandler(async (event) => {
  const base = apiBase(event)
  const locs: string[] = []
  for (let offset = 0; offset < 100000; offset += PAGE) {
    const { items } = await $fetch<{ items: { ja4?: string; ja3?: string }[] }>(`${base}/fingerprints`, {
      query: { limit: PAGE, offset },
    })
    if (!items?.length) break
    for (const it of items) {
      const slug = it.ja4 || it.ja3
      if (slug) locs.push(`${SITE_URL}/fp/${encodeURIComponent(slug)}`)
    }
    if (items.length < PAGE) break
  }
  return sendXml(event, urlsetXml(locs))
})

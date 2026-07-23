// The evergreen, indexable routes. Dynamic detail pages live in the sibling
// child sitemaps; /embed/* is deliberately absent (it is noindex).
export default defineEventHandler((event) => {
  const routes = ["/", "/browse", "/graph", "/docs"]
  return sendXml(event, urlsetXml(routes.map((r) => SITE_URL + r)))
})

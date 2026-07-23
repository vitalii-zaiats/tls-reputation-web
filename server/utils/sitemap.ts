import type { H3Event } from "h3"

// Canonical origin for every generated URL. Fixed to the apex so the sitemap is
// identical no matter which host (a *.pages.dev preview, dev., www) served it.
export const SITE_URL = "https://tls-reputation.com"

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function urlsetXml(locs: string[]): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    locs.map((loc) => `  <url><loc>${xmlEscape(loc)}</loc></url>`).join("\n") +
    "\n</urlset>\n"
  )
}

export function sitemapIndexXml(locs: string[]): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    locs.map((loc) => `  <sitemap><loc>${xmlEscape(loc)}</loc></sitemap>`).join("\n") +
    "\n</sitemapindex>\n"
  )
}

// Sitemaps are cacheable: an hour keeps Cloudflare serving them without hammering
// the API on every crawler hit, while still refreshing as the corpus grows.
export function sendXml(event: H3Event, xml: string): string {
  setHeader(event, "content-type", "application/xml; charset=utf-8")
  setHeader(event, "cache-control", "public, max-age=3600, s-maxage=3600")
  return xml
}

export function apiBase(event: H3Event): string {
  return (useRuntimeConfig(event).public as { apiBase: string }).apiBase
}

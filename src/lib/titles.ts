/**
 * Namespaces a racer may not enter. Keeping the race inside the article
 * namespace stops people from escaping through Special:, file pages or
 * category trees. Both the Finnish and canonical English names are listed
 * because hikipedia accepts either in a link target.
 */
const BLOCKED_NAMESPACES = [
  'toiminnot', 'special',
  'tiedosto', 'file', 'image', 'media',
  'ohje', 'help',
  'käyttäjä', 'user',
  'keskustelu', 'talk',
  'malline', 'template',
  'luokka', 'category',
  'mediawiki', 'hikipedia', 'project',
  'ohje keskustelu', 'käyttäjän keskustelu', 'mallineen keskustelu',
  'luokan keskustelu', 'tiedoston keskustelu', 'hikipedia keskustelu',
]

export function normalizeTitle(title: string): string {
  return title.replace(/_/g, ' ').trim()
}

/** Case-insensitive comparison on the canonical form, for win detection. */
export function sameArticle(a: string, b: string): boolean {
  return normalizeTitle(a).toLowerCase() === normalizeTitle(b).toLowerCase()
}

export function isBlockedNamespace(title: string): boolean {
  const colon = title.indexOf(':')
  if (colon <= 0) return false
  const prefix = title.slice(0, colon).replace(/_/g, ' ').trim().toLowerCase()
  return BLOCKED_NAMESPACES.includes(prefix)
}

/**
 * Turn an href from parsed hikipedia HTML into an article title, or null when
 * the link is not a playable move (external site, red link, blocked namespace).
 */
export function articleTitleFromHref(href: string): string | null {
  if (!href) return null
  // Red links and other index.php routes are edit/action URLs, never articles.
  if (href.includes('index.php')) return null
  const match = /^(?:https?:)?(?:\/\/hikipedia\.org)?\/wiki\/([^#?]+)/.exec(href)
  if (!match) return null

  let title: string
  try {
    title = decodeURIComponent(match[1])
  } catch {
    title = match[1]
  }
  title = normalizeTitle(title)
  if (!title || isBlockedNamespace(title)) return null
  return title
}

export function articleUrl(title: string): string {
  return `https://hikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

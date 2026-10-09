import type { Article } from '../types'
import { normalizeTitle } from '../lib/titles'

const ENDPOINT = 'https://hikipedia.org/api.php'

/**
 * Hikipedia runs MediaWiki 1.39 and answers anonymous cross-origin requests
 * when `origin=*` is passed, so the game talks to it straight from the browser
 * with no proxy of our own.
 */
async function call<T = any>(
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(ENDPOINT)
  url.search = new URLSearchParams({
    format: 'json',
    formatversion: '2',
    origin: '*',
    ...params,
  }).toString()

  const res = await fetch(url.toString(), { signal })
  if (!res.ok) throw new Error(`Hikipedia vastasi: HTTP ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.info ?? 'Tuntematon virhe')
  return data
}

export class ArticleNotFound extends Error {
  readonly requested: string
  constructor(requested: string) {
    super(`Artikkelia "${requested}" ei löydy Hikipediasta.`)
    this.requested = requested
  }
}

export async function fetchArticle(title: string, signal?: AbortSignal): Promise<Article> {
  let data: any
  try {
    data = await call({
      action: 'parse',
      page: title,
      prop: 'text',
      redirects: '1',
      disableeditsection: '1',
      disablelimitreport: '1',
    }, signal)
  } catch (err) {
    if (err instanceof Error && /ei löydy|missingtitle|does not exist/i.test(err.message)) {
      throw new ArticleNotFound(title)
    }
    throw err
  }

  const text = data.parse?.text
  return {
    title: normalizeTitle(data.parse.title),
    pageid: data.parse.pageid,
    // formatversion=2 returns a plain string; guard for the legacy shape.
    html: typeof text === 'string' ? text : (text?.['*'] ?? ''),
  }
}

/** Resolve a user-typed title to its canonical form, or null if it does not exist. */
export async function resolveTitle(title: string, signal?: AbortSignal): Promise<string | null> {
  const data = await call({
    action: 'query',
    titles: title,
    redirects: '1',
    prop: 'info',
  }, signal)
  const page = data.query?.pages?.[0]
  if (!page || page.missing || page.invalid) return null
  return normalizeTitle(page.title)
}

export async function searchTitles(
  prefix: string,
  limit = 8,
  signal?: AbortSignal,
): Promise<string[]> {
  if (!prefix.trim()) return []
  const data = await call<[string, string[], string[], string[]]>({
    action: 'opensearch',
    search: prefix,
    namespace: '0',
    limit: String(limit),
    redirects: 'resolve',
  }, signal)
  return (data[1] ?? []).map(normalizeTitle)
}

/**
 * A random article that is actually raceable. `list=random` happily returns
 * one-line stubs with no outgoing links, which make for a miserable start, so
 * candidates are filtered by byte size before one is picked.
 */
export async function randomArticle(minBytes = 2500, signal?: AbortSignal): Promise<string> {
  const data = await call({
    action: 'query',
    list: 'random',
    rnnamespace: '0',
    rnlimit: '20',
    rnfilterredir: 'nonredirects',
  }, signal)

  const candidates: string[] = (data.query?.random ?? [])
    .map((p: any) => normalizeTitle(p.title))
    // hikipedia uses pseudo-namespaces like "Foorum:" inside the article space.
    .filter((t: string) => !t.includes(':'))

  if (candidates.length === 0) throw new Error('Satunnaista artikkelia ei löytynyt.')

  const info = await call({
    action: 'query',
    titles: candidates.join('|'),
    prop: 'info',
  }, signal)

  const sizeable: string[] = (info.query?.pages ?? [])
    .filter((p: any) => !p.missing && (p.length ?? 0) >= minBytes)
    .map((p: any) => normalizeTitle(p.title))

  const pool = sizeable.length > 0 ? sizeable : candidates
  return pool[Math.floor(Math.random() * pool.length)]
}

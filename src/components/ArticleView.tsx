import { useEffect, useMemo, useRef } from 'react'
import { articleTitleFromHref } from '../lib/titles'

interface Props {
  title: string
  html: string
  onNavigate: (title: string) => void
}

/**
 * Strip anything executable out of the parsed wikitext before it is injected.
 * Inline `style` attributes are kept on purpose — hikipedia's infoboxes and
 * layout tables are built from them.
 */
function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  doc.querySelectorAll('script, noscript, iframe, object, embed, form').forEach((n) => n.remove())

  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name)
    }
  })

  doc.querySelectorAll('img').forEach((img) => {
    img.setAttribute('loading', 'lazy')
    img.removeAttribute('srcset') // thumbs are plenty; avoids extra round trips
  })

  // Wide tables get their own scroll container so they cannot break the page.
  doc.querySelectorAll('table.wikitable').forEach((table) => {
    const wrap = doc.createElement('div')
    wrap.className = 'table-scroll'
    table.replaceWith(wrap)
    wrap.appendChild(table)
  })

  return doc.body.innerHTML
}

export function ArticleView({ title, html, onNavigate }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const clean = useMemo(() => sanitize(html), [html])

  // Mark every anchor as a legal move or a dead end, so the player can see
  // which links are worth clicking before spending a move on one.
  useEffect(() => {
    const root = ref.current
    if (!root) return
    root.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href') ?? ''
      if (href.startsWith('#')) {
        a.dataset.move = 'anchor'
      } else if (articleTitleFromHref(href)) {
        a.dataset.move = 'article'
      } else {
        a.dataset.move = 'blocked'
        a.setAttribute('title', 'Tämä linkki ei kuulu kisaan')
      }
      a.removeAttribute('target')
    })
  }, [clean])

  // One delegated handler for the whole article: nothing navigates the browser,
  // every article link becomes an in-game move.
  useEffect(() => {
    const root = ref.current
    if (!root) return

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest('a')
      if (!anchor || !root.contains(anchor)) return

      e.preventDefault()
      const href = anchor.getAttribute('href') ?? ''

      if (href.startsWith('#')) {
        const id = decodeURIComponent(href.slice(1))
        const target =
          root.querySelector(`#${CSS.escape(id)}`) ??
          root.querySelector(`[name="${CSS.escape(id)}"]`)
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }

      const next = articleTitleFromHref(href)
      if (next) onNavigate(next)
    }

    // Middle-click and ctrl-click would open a real tab and escape the race.
    const onAuxClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest('a')) e.preventDefault()
    }

    root.addEventListener('click', onClick)
    root.addEventListener('auxclick', onAuxClick)
    return () => {
      root.removeEventListener('click', onClick)
      root.removeEventListener('auxclick', onAuxClick)
    }
  }, [onNavigate])

  return (
    <article className="article">
      <h1 className="article-title">{title}</h1>
      <div ref={ref} dangerouslySetInnerHTML={{ __html: clean }} />
    </article>
  )
}

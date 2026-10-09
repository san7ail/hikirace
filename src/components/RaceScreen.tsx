import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchArticle } from '../api/hikipedia'
import { formatDuration, useElapsed } from '../hooks/useElapsed'
import { useNavigationLock } from '../hooks/useNavigationLock'
import { sameArticle } from '../lib/titles'
import type { Article, Step } from '../types'
import { ArticleView } from './ArticleView'

interface Props {
  start: string
  target: string
  onFinish: (outcome: 'won' | 'surrendered', path: Step[], durationMs: number) => void
}

export function RaceScreen({ start, target, onFinish }: Props) {
  const [startedAt] = useState(() => Date.now())
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [path, setPath] = useState<Step[]>([{ title: start, at: 0 }])
  const [running, setRunning] = useState(true)

  const elapsed = useElapsed(startedAt, running)

  // The path is mirrored in a ref so the fetch callback always sees the
  // current route without being rebuilt (and re-firing) on every step.
  const pathRef = useRef<Step[]>([{ title: start, at: 0 }])

  useNavigationLock(running)

  const load = useCallback(
    (title: string, record: boolean) => {
      setLoading(true)
      setError(null)
      const controller = new AbortController()

      fetchArticle(title, controller.signal)
        .then((next) => {
          if (controller.signal.aborted) return
          setArticle(next)
          window.scrollTo({ top: 0 })

          if (!record) return

          const at = Date.now() - startedAt
          const nextPath = [...pathRef.current, { title: next.title, at }]
          pathRef.current = nextPath
          setPath(nextPath)

          // MediaWiki has already followed redirects, so landing on
          // "Urho Kekkonen" counts as reaching "Urho Kaleva Kekkonen".
          if (sameArticle(next.title, target)) {
            setRunning(false)
            onFinish('won', nextPath, at)
          }
        })
        .catch((err) => {
          if (controller.signal.aborted) return
          setError(err instanceof Error ? err.message : 'Artikkelin lataus epäonnistui.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })

      return () => controller.abort()
    },
    [startedAt, target, onFinish],
  )

  useEffect(() => load(start, false), [load, start])

  const surrender = () => {
    if (!running) return
    setRunning(false)
    onFinish('surrendered', pathRef.current, Date.now() - startedAt)
  }

  const steps = path.length - 1

  return (
    <div className="race">
      <header className="race-bar">
        <div className="race-stats">
          <span className="race-clock">{formatDuration(elapsed)}</span>
          <span className="race-steps">
            {steps} {steps === 1 ? 'klikkaus' : 'klikkausta'}
          </span>
        </div>

        <div className="race-goal">
          <small>Pääse kohteeseen</small>
          <strong>{target}</strong>
        </div>

        <div className="race-actions">
          <button type="button" className="btn-surrender" onClick={surrender}>
            Luovuta
          </button>
        </div>
      </header>

      <div className="race-body">
        {error ? (
          <div className="column">
            <div className="error" role="alert">{error}</div>
            <button
              type="button"
              className="btn"
              onClick={() => load(pathRef.current[pathRef.current.length - 1].title, false)}
            >
              Yritä uudelleen
            </button>
          </div>
        ) : loading && !article ? (
          <p className="race-loading">Ladataan artikkelia…</p>
        ) : article ? (
          <ArticleView
            title={article.title}
            html={article.html}
            onNavigate={(title) => load(title, true)}
          />
        ) : null}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { resolveTitle } from '../api/hikipedia'
import { randomFromPool } from '../data/pool'
import { sameArticle } from '../lib/titles'
import { ArticlePicker } from './ArticlePicker'
import { Logo } from './Logo'

interface Props {
  playerName: string
  onBegin: (start: string, target: string) => void
  onBack: () => void
}

export function SetupScreen({ playerName, onBegin, onBack }: Props) {
  const [start, setStart] = useState('')
  const [target, setTarget] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const surprise = () => {
    const a = randomFromPool()
    setStart(a)
    setTarget(randomFromPool(a))
    setError(null)
  }

  const begin = async () => {
    setError(null)

    if (!start.trim() || !target.trim()) {
      setError('Valitse sekä lähtö- että maaliartikkeli.')
      return
    }
    if (sameArticle(start, target)) {
      setError('Lähtö ja maali eivät voi olla sama artikkeli.')
      return
    }

    setChecking(true)
    try {
      // Resolve both up front so redirects are followed before the clock runs,
      // and so a typo fails here rather than on a blank article mid-race.
      const [resolvedStart, resolvedTarget] = await Promise.all([
        resolveTitle(start),
        resolveTitle(target),
      ])

      if (!resolvedStart) {
        setError(`Hikipediasta ei löydy artikkelia "${start}".`)
        return
      }
      if (!resolvedTarget) {
        setError(`Hikipediasta ei löydy artikkelia "${target}".`)
        return
      }
      if (sameArticle(resolvedStart, resolvedTarget)) {
        setError('Lähtö ja maali ohjautuvat samaan artikkeliin.')
        return
      }

      onBegin(resolvedStart, resolvedTarget)
    } catch {
      setError('Hikipediaan ei saatu yhteyttä. Yritä uudelleen.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="screen">
      <div className="column">
        <Logo />

        {error && <div className="error" role="alert">{error}</div>}

        <h2 className="lede" style={{ marginBottom: 20 }}>Asetukset</h2>

        <ArticlePicker
          label="Lähtö"
          icon="📍"
          placeholder="Täältä…"
          value={start}
          onChange={setStart}
          avoid={target}
        />

        <ArticlePicker
          label="Maali"
          icon="🏆"
          placeholder="…tänne"
          value={target}
          onChange={setTarget}
          avoid={start}
        />

        <div className="row" style={{ marginBottom: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={surprise}>
            Arvo molemmat
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => { setStart(target); setTarget(start) }}
            disabled={!start && !target}
          >
            Vaihda suunta
          </button>
        </div>

        <button type="button" className="btn" onClick={begin} disabled={checking}>
          {checking ? 'Tarkistetaan…' : `Aloita kisa${playerName ? `, ${playerName}` : ''}`}
        </button>

        <p className="note">
          <button type="button" className="link" onClick={onBack}
            style={{ background: 'none', border: 0, padding: 0 }}>
            ← Takaisin
          </button>
        </p>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { Lobby } from '../net/useLobby'
import { resolveTitle } from '../api/hikipedia'
import { randomFromPool } from '../data/pool'
import { sameArticle } from '../lib/titles'
import { ArticlePicker } from './ArticlePicker'
import { Logo } from './Logo'
import { Scoreboard } from './Scoreboard'

interface Props {
  lobby: Lobby
  onLeave: () => void
}

export function LobbyScreen({ lobby, onLeave }: Props) {
  const view = lobby.view
  const me = view?.players.find((p) => p.id === lobby.you)
  const isHost = Boolean(me?.isHost)

  const [start, setStart] = useState('')
  const [target, setTarget] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [copied, setCopied] = useState(false)

  // Guests mirror whatever the host has chosen.
  useEffect(() => {
    if (isHost) return
    setStart(view?.start ?? '')
    setTarget(view?.target ?? '')
  }, [isHost, view?.start, view?.target])

  // The host publishes their picks so everyone sees the matchup forming.
  useEffect(() => {
    if (!isHost) return
    if (!start.trim() || !target.trim()) return
    const timer = window.setTimeout(() => lobby.send({ type: 'settings', start, target }), 400)
    return () => window.clearTimeout(timer)
  }, [isHost, start, target, lobby])

  const invite = `${location.origin}/?lobby=${view?.code ?? ''}`

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(invite)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setProblem(`Kopiointi ei onnistunut. Linkki: ${invite}`)
    }
  }

  const begin = async () => {
    setProblem(null)
    if (!start.trim() || !target.trim()) {
      setProblem('Valitse sekä lähtö- että maaliartikkeli.')
      return
    }
    if (sameArticle(start, target)) {
      setProblem('Lähtö ja maali eivät voi olla sama artikkeli.')
      return
    }
    setChecking(true)
    try {
      const [a, b] = await Promise.all([resolveTitle(start), resolveTitle(target)])
      if (!a) return setProblem(`Hikipediasta ei löydy artikkelia "${start}".`)
      if (!b) return setProblem(`Hikipediasta ei löydy artikkelia "${target}".`)
      if (sameArticle(a, b)) return setProblem('Lähtö ja maali ohjautuvat samaan artikkeliin.')

      // Send the resolved pair so every racer starts from the same canonical
      // article, then let the server fire the start signal.
      lobby.send({ type: 'settings', start: a, target: b })
      lobby.send({ type: 'start' })
    } catch {
      setProblem('Hikipediaan ei saatu yhteyttä. Yritä uudelleen.')
    } finally {
      setChecking(false)
    }
  }

  if (!view) {
    return (
      <div className="screen">
        <div className="column">
          <Logo />
          <p className="race-loading">
            {lobby.connection === 'closed' ? 'Yhteys katkesi, yhdistetään…' : 'Liitytään peliin…'}
          </p>
          <button type="button" className="btn btn-ghost" onClick={onLeave}>Peruuta</button>
        </div>
      </div>
    )
  }

  const message = problem ?? lobby.error

  return (
    <div className="screen">
      <div className="column">
        <Logo />

        {message && <div className="error" role="alert">{message}</div>}
        {lobby.connection !== 'open' && (
          <div className="error" role="status">Yhteys poikki — yritetään uudelleen…</div>
        )}

        <div className="lobby-head">
          <div>
            <small>Pelikoodi</small>
            <strong className="lobby-code">{view.code}</strong>
          </div>
          <button type="button" className="btn-surrender" onClick={copyInvite}>
            {copied ? 'Kopioitu!' : 'Kutsu kavereita'}
          </button>
        </div>

        <h2 className="lede" style={{ marginBottom: 14 }}>
          Pelaajat ({view.players.length})
        </h2>
        <Scoreboard players={view.players} you={lobby.you} />

        <h2 className="lede" style={{ margin: '26px 0 14px' }}>Asetukset</h2>

        {isHost ? (
          <>
            <ArticlePicker
              label="Lähtö" icon="📍" placeholder="Täältä…"
              value={start} onChange={setStart} avoid={target}
            />
            <ArticlePicker
              label="Maali" icon="🏆" placeholder="…tänne"
              value={target} onChange={setTarget} avoid={start}
            />

            <div className="row" style={{ marginBottom: 20 }}>
              <button
                type="button" className="btn btn-ghost"
                onClick={() => {
                  const a = randomFromPool()
                  setStart(a)
                  setTarget(randomFromPool(a))
                }}
              >
                Arvo molemmat
              </button>
              <button
                type="button" className="btn btn-ghost"
                onClick={() => { setStart(target); setTarget(start) }}
                disabled={!start && !target}
              >
                Vaihda suunta
              </button>
            </div>

            <button type="button" className="btn" onClick={begin} disabled={checking}>
              {checking ? 'Tarkistetaan…' : `Aloita kisa (${view.players.length})`}
            </button>
          </>
        ) : (
          <>
            <div className="matchup">
              <div><small>Lähtö</small><strong>{view.start || '— odottaa isäntää —'}</strong></div>
              <div><small>Maali</small><strong>{view.target || '— odottaa isäntää —'}</strong></div>
            </div>
            <p className="race-loading">Odotetaan että isäntä aloittaa kisan…</p>
          </>
        )}

        <p className="note">
          <button
            type="button" className="link"
            style={{ background: 'none', border: 0, padding: 0 }}
            onClick={onLeave}
          >
            ← Poistu pelistä
          </button>
        </p>
      </div>
    </div>
  )
}

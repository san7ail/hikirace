import { useCallback, useEffect, useState } from 'react'
import { FinishScreen } from './components/FinishScreen'
import { HomeScreen } from './components/HomeScreen'
import { LobbyScreen } from './components/LobbyScreen'
import { RaceScreen } from './components/RaceScreen'
import { SetupScreen } from './components/SetupScreen'
import { createLobby, probeLobby, useLobby } from './net/useLobby'
import { isLobbyCode } from '../shared/protocol'
import type { Outcome, RaceConfig, RaceResult, Step } from './types'

type Phase =
  | { name: 'home' }
  | { name: 'setup' }
  | { name: 'lobby' }
  | { name: 'race'; config: RaceConfig; multi: boolean }
  | { name: 'finish'; result: RaceResult; multi: boolean }

const NAME_KEY = 'hikirace.name'

/** A ?lobby=CODE link drops you straight onto the join screen. */
function codeFromUrl(): string {
  const value = new URLSearchParams(location.search).get('lobby')?.toUpperCase() ?? ''
  return isLobbyCode(value) ? value : ''
}

export default function App() {
  const [phase, setPhase] = useState<Phase>({ name: 'home' })
  const [playerName, setPlayerName] = useState(() => localStorage.getItem(NAME_KEY) ?? '')
  const [lobbyCode, setLobbyCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [homeError, setHomeError] = useState<string | null>(null)
  const [initialCode] = useState(codeFromUrl)

  const lobby = useLobby(lobbyCode, playerName)
  const { go, clearGo, send: sendToLobby } = lobby

  const rememberName = (name: string) => {
    setPlayerName(name)
    try {
      localStorage.setItem(NAME_KEY, name)
    } catch {
      // Private browsing; playing without a remembered name is fine.
    }
  }

  // The host pressing Start is what moves everyone into the race at once.
  useEffect(() => {
    if (!go) return
    setPhase({ name: 'race', config: { start: go.start, target: go.target }, multi: true })
    clearGo()
  }, [go, clearGo])

  // A rematch sends the room back to the lobby; follow it.
  useEffect(() => {
    if (lobby.view?.phase === 'lobby' && phase.name === 'finish' && phase.multi) {
      setPhase({ name: 'lobby' })
    }
  }, [lobby.view?.phase, phase])

  const openLobby = async (code: string) => {
    setHomeError(null)
    setLobbyCode(code)
    setPhase({ name: 'lobby' })
    // Drop the invite parameter so a later refresh does not re-join silently.
    window.history.replaceState(null, '', location.pathname)
  }

  const handleCreate = async () => {
    setBusy(true)
    setHomeError(null)
    try {
      await openLobby(await createLobby())
    } catch {
      setHomeError('Pelin luonti epäonnistui. Onko palvelin käynnissä?')
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async (code: string) => {
    setBusy(true)
    setHomeError(null)
    try {
      const probe = await probeLobby(code)
      if (!probe.exists) {
        setHomeError(`Peliä koodilla ${code} ei löytynyt.`)
        return
      }
      if (probe.phase !== 'lobby' && !probe.member) {
        setHomeError('Kisa on jo käynnissä. Odota että isäntä aloittaa uuden kierroksen.')
        return
      }
      await openLobby(code)
    } catch {
      setHomeError('Peliin liittyminen epäonnistui.')
    } finally {
      setBusy(false)
    }
  }

  const leaveLobby = useCallback(() => {
    lobby.leave()
    setLobbyCode(null)
    setPhase({ name: 'home' })
  }, [lobby])

  const finish = useCallback(
    (outcome: Outcome, path: Step[], durationMs: number) => {
      setPhase((current) => {
        if (current.name !== 'race') return current

        if (current.multi) {
          const titles = path.map((step) => step.title)
          const clicks = Math.max(0, path.length - 1)
          sendToLobby(
            outcome === 'won'
              ? { type: 'finish', clicks, durationMs, path: titles }
              : { type: 'surrender', clicks, path: titles },
          )
        }

        return {
          name: 'finish',
          multi: current.multi,
          result: { config: current.config, outcome, path, durationMs },
        }
      })
    },
    [sendToLobby],
  )

  const reportProgress = useCallback(
    (clicks: number, current: string) => sendToLobby({ type: 'progress', clicks, current }),
    [sendToLobby],
  )

  switch (phase.name) {
    case 'home':
      return (
        <HomeScreen
          name={playerName}
          onNameChange={rememberName}
          onSolo={() => setPhase({ name: 'setup' })}
          onCreateLobby={handleCreate}
          onJoinLobby={handleJoin}
          busy={busy}
          error={homeError}
          initialCode={initialCode}
        />
      )

    case 'setup':
      return (
        <SetupScreen
          playerName={playerName}
          onBack={() => setPhase({ name: 'home' })}
          onBegin={(start, target) =>
            setPhase({ name: 'race', config: { start, target }, multi: false })
          }
        />
      )

    case 'lobby':
      return <LobbyScreen lobby={lobby} onLeave={leaveLobby} />

    case 'race':
      return (
        <RaceScreen
          // Remounting on a rematch gives a clean clock and route.
          key={`${phase.config.start}→${phase.config.target}`}
          start={phase.config.start}
          target={phase.config.target}
          onFinish={finish}
          opponents={phase.multi ? lobby.view?.players : undefined}
          you={lobby.you}
          onProgress={phase.multi ? reportProgress : undefined}
        />
      )

    case 'finish':
      return (
        <FinishScreen
          result={phase.result}
          playerName={playerName}
          lobby={phase.multi ? lobby.view : undefined}
          you={lobby.you}
          canRematch={!phase.multi || Boolean(lobby.view?.players.find((p) => p.id === lobby.you)?.isHost)}
          onRematch={() => {
            if (phase.multi) lobby.send({ type: 'rematch' })
            else setPhase({ name: 'race', config: phase.result.config, multi: false })
          }}
          onNewRace={() => setPhase(phase.multi ? { name: 'lobby' } : { name: 'setup' })}
        />
      )
  }
}

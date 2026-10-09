import { formatDuration } from '../hooks/useElapsed'
import { articleUrl } from '../lib/titles'
import type { RaceResult } from '../types'
import type { LobbyView } from '../../shared/protocol'
import { Kekkonen } from './Kekkonen'
import { Logo } from './Logo'
import { Scoreboard } from './Scoreboard'
import { SnakeGame } from './SnakeGame'

interface Props {
  result: RaceResult
  playerName: string
  onRematch: () => void
  onNewRace: () => void
  /** Present in a multiplayer race: live standings while others still run. */
  lobby?: LobbyView | null
  you?: string
  canRematch?: boolean
}

export function FinishScreen({
  result, playerName, onRematch, onNewRace, lobby, you, canRematch = true,
}: Props) {
  const won = result.outcome === 'won'
  const clicks = Math.max(0, result.path.length - 1)
  const stillRacing = lobby
    ? lobby.players.filter((p) => p.finishedAt === null && !p.surrendered).length
    : 0

  return (
    <div className="screen">
      <div className="column">
        <Logo />
        {won && <Kekkonen size={88} />}

        <div className="result-card">
          <h2 className="result-headline">
            {won
              ? `Perillä${playerName ? `, ${playerName}` : ''}!`
              : 'Kisa keskeytetty'}
          </h2>
          <p style={{ margin: 0, fontWeight: 700 }}>
            {result.config.start} → {result.config.target}
          </p>

          <div className="result-figures">
            <div>
              <span>{formatDuration(result.durationMs)}</span>
              aikaa
            </div>
            <div>
              <span>{clicks}</span>
              {clicks === 1 ? 'klikkaus' : 'klikkausta'}
            </div>
          </div>
        </div>

        {lobby && (
          <>
            <h3 style={{ marginTop: 0 }}>
              Tilanne{stillRacing > 0 && ` — ${stillRacing} vielä matkalla`}
            </h3>
            <Scoreboard players={lobby.players} you={you ?? ''} racing />
            <p className="note" style={{ textAlign: 'left', marginBottom: 26 }}>
              {stillRacing > 0
                ? 'Taulukko päivittyy kun muut pääsevät perille.'
                : 'Kaikki maalissa. Isäntä voi aloittaa uusinnan.'}
            </p>

            {/* This screen is a waiting room too: for the stragglers, then
                for the host to call a rematch. */}
            <SnakeGame />
          </>
        )}

        <h3 style={{ marginTop: 0 }}>Reitti</h3>
        <ol className="path">
          {result.path.map((step, i) => (
            <li key={`${step.title}-${i}`}>
              <a
                className="link"
                href={articleUrl(step.title)}
                target="_blank"
                rel="noreferrer noopener"
              >
                {step.title}
              </a>
              <time>{formatDuration(step.at)}</time>
            </li>
          ))}
        </ol>

        <div className="row">
          {canRematch && (
            <button type="button" className="btn btn-ghost" onClick={onRematch}>
              Uusinta
            </button>
          )}
          <button type="button" className="btn" onClick={onNewRace}>
            {lobby ? 'Takaisin aulaan' : 'Uusi kisa'}
          </button>
        </div>
      </div>
    </div>
  )
}

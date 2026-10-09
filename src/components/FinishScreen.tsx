import { formatDuration } from '../hooks/useElapsed'
import { articleUrl } from '../lib/titles'
import type { RaceResult } from '../types'
import { Kekkonen } from './Kekkonen'
import { Logo } from './Logo'

interface Props {
  result: RaceResult
  playerName: string
  onRematch: () => void
  onNewRace: () => void
}

export function FinishScreen({ result, playerName, onRematch, onNewRace }: Props) {
  const won = result.outcome === 'won'
  const clicks = Math.max(0, result.path.length - 1)

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
          <button type="button" className="btn btn-ghost" onClick={onRematch}>
            Uusinta
          </button>
          <button type="button" className="btn" onClick={onNewRace}>
            Uusi kisa
          </button>
        </div>
      </div>
    </div>
  )
}

import { formatDuration } from '../hooks/useElapsed'
import type { PlayerView } from '../../shared/protocol'

/** Finished players first by time, then those still running by clicks. */
export function rank(players: PlayerView[]): PlayerView[] {
  return [...players].sort((a, b) => {
    if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt
    if (a.finishedAt !== null) return -1
    if (b.finishedAt !== null) return 1
    if (a.surrendered !== b.surrendered) return a.surrendered ? 1 : -1
    return a.clicks - b.clicks
  })
}

function status(player: PlayerView): string {
  if (player.finishedAt !== null) return formatDuration(player.finishedAt)
  if (player.surrendered) return 'luovutti'
  if (!player.connected) return 'poissa'
  return `${player.clicks} klik.`
}

export function Scoreboard({
  players,
  you,
  racing,
}: {
  players: PlayerView[]
  you: string
  racing?: boolean
}) {
  return (
    <ul className="scoreboard">
      {rank(players).map((player, i) => (
        <li key={player.id} data-you={player.id === you} data-done={player.finishedAt !== null}>
          {racing && <span className="place">{i + 1}.</span>}
          <span className="who">
            {player.name}
            {player.isHost && <span className="tag">isäntä</span>}
            {player.id === you && <span className="tag tag-you">sinä</span>}
            {/* Only populated for players allowed to watch — see protocol. */}
            {player.finishedAt === null && !player.surrendered && player.current && (
              <small className="whereabouts">nyt: {player.current}</small>
            )}
          </span>
          <span className="score">{status(player)}</span>
        </li>
      ))}
    </ul>
  )
}

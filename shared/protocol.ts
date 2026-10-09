/** Wire format shared by the browser client and the Cloudflare Worker. */

export type LobbyPhase = 'lobby' | 'racing' | 'results'

export interface PlayerView {
  id: string
  name: string
  connected: boolean
  isHost: boolean
  /** Links clicked so far this race. */
  clicks: number
  /** ms from the start signal to reaching the target, or null if still going. */
  finishedAt: number | null
  surrendered: boolean
  /**
   * The route taken. Only populated once the race is over for everyone —
   * during a race it would hand opponents a ready-made answer.
   */
  path: string[] | null
  /**
   * The article this player is standing on. Sent only to players who have
   * already finished or surrendered: they cannot use it to win, and watching
   * the stragglers flail is half the fun. Still-racing players see null.
   */
  current: string | null
}

export interface LobbyView {
  code: string
  phase: LobbyPhase
  start: string | null
  target: string | null
  players: PlayerView[]
}

export type ClientMessage =
  | { type: 'settings'; start: string; target: string }
  | { type: 'start' }
  | { type: 'progress'; clicks: number; current: string }
  | { type: 'finish'; clicks: number; durationMs: number; path: string[] }
  | { type: 'surrender'; clicks: number; path: string[] }
  | { type: 'rematch' }

export type ServerMessage =
  | { type: 'welcome'; you: string; lobby: LobbyView }
  | { type: 'state'; lobby: LobbyView }
  | { type: 'go'; start: string; target: string }
  | { type: 'error'; message: string }

export const LOBBY_CODE_LENGTH = 5
/** No I/O/0/1 — these get misread when someone reads a code out loud. */
export const LOBBY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function isLobbyCode(value: string): boolean {
  return (
    value.length === LOBBY_CODE_LENGTH &&
    [...value].every((c) => LOBBY_ALPHABET.includes(c))
  )
}

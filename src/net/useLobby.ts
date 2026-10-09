import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ClientMessage, LobbyView, ServerMessage } from '../../shared/protocol'

const ID_KEY = 'hikirace.playerId'

/**
 * A stable per-browser id. Keeping it in localStorage means a refresh
 * mid-race reclaims the same slot and score instead of creating a ghost.
 */
function playerId(): string {
  try {
    const existing = localStorage.getItem(ID_KEY)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    localStorage.setItem(ID_KEY, fresh)
    return fresh
  } catch {
    return crypto.randomUUID()
  }
}

export type Connection = 'connecting' | 'open' | 'closed'

export interface Lobby {
  view: LobbyView | null
  you: string
  connection: Connection
  error: string | null
  /** Set when the host starts a race; cleared once the screen has consumed it. */
  go: { start: string; target: string } | null
  send: (message: ClientMessage) => void
  clearGo: () => void
  leave: () => void
}

export function useLobby(code: string | null, name: string): Lobby {
  const you = useMemo(playerId, [])
  const [view, setView] = useState<LobbyView | null>(null)
  const [connection, setConnection] = useState<Connection>('closed')
  const [error, setError] = useState<string | null>(null)
  const [go, setGo] = useState<{ start: string; target: string } | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<number | null>(null)
  const leftRef = useRef(false)
  // Read inside the reconnect loop without making it a dependency.
  const nameRef = useRef(name)
  nameRef.current = name

  useEffect(() => {
    if (!code) return
    leftRef.current = false
    let attempt = 0

    const open = () => {
      if (leftRef.current) return
      setConnection('connecting')

      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const url =
        `${protocol}//${location.host}/api/lobby/${code}/ws` +
        `?id=${encodeURIComponent(you)}&name=${encodeURIComponent(nameRef.current)}`

      const socket = new WebSocket(url)
      socketRef.current = socket

      socket.onopen = () => {
        attempt = 0
        setConnection('open')
        setError(null)
      }

      socket.onmessage = (event) => {
        let message: ServerMessage
        try {
          message = JSON.parse(event.data)
        } catch {
          return
        }
        if (message.type === 'welcome' || message.type === 'state') {
          setView(message.lobby)
        } else if (message.type === 'go') {
          setGo({ start: message.start, target: message.target })
        } else if (message.type === 'error') {
          setError(message.message)
        }
      }

      socket.onclose = () => {
        setConnection('closed')
        if (leftRef.current) return
        if (attempt >= 6) {
          setError('Yhteyttä peliin ei saatu. Tarkista pelikoodi.')
          return
        }
        // Backing off keeps a dropped network from hammering the Worker.
        const delay = Math.min(8000, 500 * 2 ** attempt++)
        retryRef.current = window.setTimeout(open, delay)
      }

      socket.onerror = () => socket.close()
    }

    open()

    return () => {
      leftRef.current = true
      if (retryRef.current) window.clearTimeout(retryRef.current)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [code, you])

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }, [])

  const leave = useCallback(() => {
    leftRef.current = true
    socketRef.current?.close()
    setView(null)
  }, [])

  const clearGo = useCallback(() => setGo(null), [])

  // A stable object: consumers memoise callbacks against it, and a fresh
  // identity on every websocket tick would invalidate all of them.
  return useMemo(
    () => ({ view, you, connection, error, go, send, clearGo, leave }),
    [view, you, connection, error, go, send, clearGo, leave],
  )
}

export async function createLobby(): Promise<string> {
  const res = await fetch('/api/lobby', { method: 'POST' })
  if (!res.ok) throw new Error('Pelin luonti epäonnistui.')
  const body = (await res.json()) as { code: string }
  return body.code
}

export interface LobbyProbe {
  exists: boolean
  phase: 'lobby' | 'racing' | 'results'
  /** True when this browser already holds a slot, so it may rejoin a race. */
  member: boolean
}

export async function probeLobby(code: string): Promise<LobbyProbe> {
  const res = await fetch(`/api/lobby/${code}?id=${encodeURIComponent(playerId())}`)
  if (!res.ok) return { exists: false, phase: 'lobby', member: false }
  return (await res.json()) as LobbyProbe
}

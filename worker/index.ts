import { DurableObject } from 'cloudflare:workers'
import {
  LOBBY_ALPHABET,
  LOBBY_CODE_LENGTH,
  isLobbyCode,
  type ClientMessage,
  type LobbyView,
  type PlayerView,
  type ServerMessage,
} from '../shared/protocol'

export interface Env {
  ASSETS: Fetcher
  LOBBY: DurableObjectNamespace<LobbyRoom>
}

interface Player {
  id: string
  name: string
  joinedAt: number
  clicks: number
  finishedAt: number | null
  surrendered: boolean
  path: string[]
}

interface Stored {
  claimed: boolean
  phase: 'lobby' | 'racing' | 'results'
  hostId: string | null
  start: string | null
  target: string | null
  startedAt: number | null
  players: Record<string, Player>
}

const EMPTY: Stored = {
  claimed: false,
  phase: 'lobby',
  hostId: null,
  start: null,
  target: null,
  startedAt: null,
  players: {},
}

/** One Durable Object per lobby code: the single source of truth for a race. */
export class LobbyRoom extends DurableObject<Env> {
  private data: Stored = { ...EMPTY, players: {} }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Hibernated sockets outlive this object's memory, so rehydrate first.
    ctx.blockConcurrencyWhile(async () => {
      this.data = (await ctx.storage.get<Stored>('data')) ?? { ...EMPTY, players: {} }
    })
  }

  private async save() {
    await this.ctx.storage.put('data', this.data)
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.endsWith('/claim')) {
      if (this.data.claimed) return new Response('taken', { status: 409 })
      this.data.claimed = true
      await this.save()
      return new Response('ok')
    }

    if (url.pathname.endsWith('/exists')) {
      // `member` lets a player who is already in the room reconnect to a race
      // in progress, while still turning away newcomers once it has started.
      const who = url.searchParams.get('id')
      return Response.json({
        exists: this.data.claimed,
        phase: this.data.phase,
        member: Boolean(who && this.data.players[who]),
      })
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }

    const id = url.searchParams.get('id')
    const name = (url.searchParams.get('name') || '').trim().slice(0, 24)
    if (!id) return new Response('missing id', { status: 400 })
    if (!this.data.claimed) return new Response('no such lobby', { status: 404 })

    const existing = this.data.players[id]
    if (existing) {
      // Reconnect: keep their score, refresh the display name.
      if (name) existing.name = name
    } else {
      if (this.data.phase !== 'lobby') {
        return new Response('race already started', { status: 409 })
      }
      this.data.players[id] = {
        id,
        name: name || 'Pelaaja',
        joinedAt: Date.now(),
        clicks: 0,
        finishedAt: null,
        surrendered: false,
        path: [],
      }
    }
    if (!this.data.hostId || !this.data.players[this.data.hostId]) {
      this.data.hostId = id
    }
    await this.save()

    const pair = new WebSocketPair()
    // Hibernation keeps the lobby free of idle charges between races.
    this.ctx.acceptWebSocket(pair[1], [id])

    const welcome: ServerMessage = { type: 'welcome', you: id, lobby: this.view() }
    pair[1].send(JSON.stringify(welcome))
    this.broadcast({ type: 'state', lobby: this.view() }, id)

    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string') return
    const senderId = this.ctx.getTags(ws)[0]
    const player = this.data.players[senderId]
    if (!player) return

    let msg: ClientMessage
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }

    const isHost = this.data.hostId === senderId

    switch (msg.type) {
      case 'settings': {
        if (!isHost || this.data.phase !== 'lobby') return
        this.data.start = String(msg.start).slice(0, 200)
        this.data.target = String(msg.target).slice(0, 200)
        break
      }

      case 'start': {
        if (!isHost || this.data.phase !== 'lobby') return
        if (!this.data.start || !this.data.target) {
          ws.send(JSON.stringify({ type: 'error', message: 'Valitse lähtö ja maali.' } satisfies ServerMessage))
          return
        }
        this.data.phase = 'racing'
        this.data.startedAt = Date.now()
        for (const p of Object.values(this.data.players)) {
          p.clicks = 0
          p.finishedAt = null
          p.surrendered = false
          p.path = []
        }
        await this.save()
        this.broadcast({ type: 'go', start: this.data.start, target: this.data.target })
        this.broadcast({ type: 'state', lobby: this.view() })
        return
      }

      case 'progress': {
        if (this.data.phase !== 'racing') return
        player.clicks = Math.max(0, Math.min(9999, Math.floor(msg.clicks)))
        break
      }

      case 'finish': {
        if (this.data.phase !== 'racing' || player.finishedAt !== null) return
        player.clicks = Math.max(0, Math.floor(msg.clicks))
        player.finishedAt = Math.max(0, Math.floor(msg.durationMs))
        player.path = msg.path.slice(0, 500).map((t) => String(t).slice(0, 200))
        this.settleIfDone()
        break
      }

      case 'surrender': {
        if (this.data.phase !== 'racing' || player.finishedAt !== null || player.surrendered) return
        player.surrendered = true
        player.clicks = Math.max(0, Math.floor(msg.clicks))
        player.path = msg.path.slice(0, 500).map((t) => String(t).slice(0, 200))
        this.settleIfDone()
        break
      }

      case 'rematch': {
        if (!isHost) return
        this.data.phase = 'lobby'
        this.data.startedAt = null
        for (const p of Object.values(this.data.players)) {
          p.clicks = 0
          p.finishedAt = null
          p.surrendered = false
          p.path = []
        }
        break
      }
    }

    await this.save()
    this.broadcast({ type: 'state', lobby: this.view() })
  }

  async webSocketClose(ws: WebSocket) {
    const id = this.ctx.getTags(ws)[0]
    // A disconnected player keeps their slot and score — they may be
    // refreshing. Only the host role moves on, so the lobby stays usable.
    if (this.data.hostId === id) {
      const next = this.connectedIds().find((other) => other !== id)
      if (next) this.data.hostId = next
    }
    await this.save()
    this.broadcast({ type: 'state', lobby: this.view() }, id)
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws)
  }

  /** Once nobody is still running, reveal the routes and show the results. */
  private settleIfDone() {
    const racers = Object.values(this.data.players)
    const live = racers.filter((p) => p.finishedAt === null && !p.surrendered)
    if (live.length === 0) {
      this.data.phase = 'results'
    }
  }

  private connectedIds(): string[] {
    return this.ctx
      .getWebSockets()
      .filter((s) => s.readyState === WebSocket.READY_STATE_OPEN)
      .map((s) => this.ctx.getTags(s)[0])
      .filter(Boolean)
  }

  private view(): LobbyView {
    const connected = new Set(this.connectedIds())
    const revealPaths = this.data.phase === 'results'

    const players: PlayerView[] = Object.values(this.data.players)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({
        id: p.id,
        name: p.name,
        connected: connected.has(p.id),
        isHost: this.data.hostId === p.id,
        clicks: p.clicks,
        finishedAt: p.finishedAt,
        surrendered: p.surrendered,
        path: revealPaths ? p.path : null,
      }))

    return {
      code: this.ctx.id.name ?? '',
      phase: this.data.phase,
      start: this.data.start,
      target: this.data.target,
      players,
    }
  }

  private broadcast(message: ServerMessage, exceptId?: string) {
    const payload = JSON.stringify(message)
    for (const socket of this.ctx.getWebSockets()) {
      if (exceptId && this.ctx.getTags(socket)[0] === exceptId) continue
      try {
        socket.send(payload)
      } catch {
        // Socket is going away; the close handler will tidy up.
      }
    }
  }
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LOBBY_CODE_LENGTH))
  return [...bytes].map((b) => LOBBY_ALPHABET[b % LOBBY_ALPHABET.length]).join('')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/lobby' && request.method === 'POST') {
      // Collisions are vanishingly rare at 32^5, but claiming is atomic so a
      // few retries make it impossible to hand out a code twice.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomCode()
        const room = env.LOBBY.get(env.LOBBY.idFromName(code))
        const claimed = await room.fetch(`https://lobby/${code}/claim`, { method: 'POST' })
        if (claimed.ok) return Response.json({ code })
      }
      return Response.json({ error: 'Pelikoodia ei saatu luotua.' }, { status: 503 })
    }

    const match = /^\/api\/lobby\/([A-Z0-9]+)(\/ws)?$/.exec(url.pathname)
    if (match) {
      const code = match[1]
      if (!isLobbyCode(code)) return Response.json({ error: 'Virheellinen koodi.' }, { status: 400 })

      const room = env.LOBBY.get(env.LOBBY.idFromName(code))
      if (match[2]) return room.fetch(request)

      const who = url.searchParams.get('id') ?? ''
      const info = await room.fetch(
        `https://lobby/${code}/exists?id=${encodeURIComponent(who)}`,
      )
      return new Response(info.body, { status: info.status, headers: info.headers })
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

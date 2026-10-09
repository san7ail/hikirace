import { useCallback, useEffect, useRef, useState } from 'react'

const GRID = 17
const START_INTERVAL = 170
const MIN_INTERVAL = 70
/** Every food eaten shaves this much off the step interval. */
const SPEEDUP = 4
const BEST_KEY = 'hikirace.snakeBest'

type Point = { x: number; y: number }
type Status = 'idle' | 'running' | 'paused' | 'over'

interface Game {
  snake: Point[]
  dir: Point
  /** Turns taken this tick are buffered so a fast double-tap cannot reverse. */
  queue: Point[]
  food: Point
  interval: number
  acc: number
  last: number
}

const RIGHT = { x: 1, y: 0 }

function placeFood(snake: Point[]): Point {
  const free: Point[] = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y })
    }
  }
  return free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 }
}

function freshGame(): Game {
  const snake = [
    { x: 8, y: 8 },
    { x: 7, y: 8 },
    { x: 6, y: 8 },
  ]
  return {
    snake,
    dir: RIGHT,
    queue: [],
    food: placeFood(snake),
    interval: START_INTERVAL,
    acc: 0,
    last: 0,
  }
}

/**
 * Something to do while the host makes up their mind. Deliberately scoped to
 * the lobby: it listens for keys only while the board itself has focus, so
 * arrow keys still drive the article autocomplete next to it.
 */
export function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  gameRef.current ??= freshGame()
  const frameRef = useRef<number>(0)
  const statusRef = useRef<Status>('idle')

  const [status, setStatus] = useState<Status>('idle')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => {
    const stored = Number(localStorage.getItem(BEST_KEY))
    return Number.isFinite(stored) ? stored : 0
  })

  const setPhase = useCallback((next: Status) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const styles = getComputedStyle(canvas)
    const bg = styles.getPropertyValue('--bg-field').trim() || '#f0ffa0'
    const ink = styles.getPropertyValue('--blue').trim() || '#2c38ac'
    const pale = styles.getPropertyValue('--bg').trim() || '#f6ffbf'

    const size = canvas.width / (window.devicePixelRatio || 1)
    const cell = size / GRID
    const game = gameRef.current!

    ctx.save()
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, size, size)

    // food
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.arc((game.food.x + 0.5) * cell, (game.food.y + 0.5) * cell, cell * 0.3, 0, Math.PI * 2)
    ctx.fill()

    // body, head brightest
    game.snake.forEach((part, i) => {
      const pad = i === 0 ? cell * 0.06 : cell * 0.14
      ctx.fillStyle = ink
      ctx.globalAlpha = i === 0 ? 1 : Math.max(0.45, 1 - i * 0.035)
      ctx.fillRect(part.x * cell + pad, part.y * cell + pad, cell - pad * 2, cell - pad * 2)
    })
    ctx.globalAlpha = 1

    // eyes, so the head reads as a head
    const head = game.snake[0]
    ctx.fillStyle = pale
    const ex = (head.x + 0.5) * cell
    const ey = (head.y + 0.5) * cell
    const off = cell * 0.17
    const across = { x: game.dir.y, y: game.dir.x }
    for (const sign of [1, -1]) {
      ctx.beginPath()
      ctx.arc(
        ex + across.x * off * sign + game.dir.x * off * 0.6,
        ey + across.y * off * sign + game.dir.y * off * 0.6,
        cell * 0.09, 0, Math.PI * 2,
      )
      ctx.fill()
    }
    ctx.restore()
  }, [])

  const step = useCallback(() => {
    const game = gameRef.current!

    const turn = game.queue.shift()
    if (turn) game.dir = turn

    const head = game.snake[0]
    const next = { x: head.x + game.dir.x, y: head.y + game.dir.y }

    const hitWall = next.x < 0 || next.y < 0 || next.x >= GRID || next.y >= GRID
    // The tail tip moves out of the way this tick, so it is not a collision.
    const hitSelf = game.snake.slice(0, -1).some((p) => p.x === next.x && p.y === next.y)
    if (hitWall || hitSelf) {
      setPhase('over')
      setBest((current) => {
        const high = Math.max(current, game.snake.length - 3)
        try {
          localStorage.setItem(BEST_KEY, String(high))
        } catch {
          // Private browsing: the best score just will not persist.
        }
        return high
      })
      return
    }

    game.snake.unshift(next)
    if (next.x === game.food.x && next.y === game.food.y) {
      game.food = placeFood(game.snake)
      game.interval = Math.max(MIN_INTERVAL, game.interval - SPEEDUP)
      setScore(game.snake.length - 3)
    } else {
      game.snake.pop()
    }
  }, [setPhase])

  // One rAF loop with an accumulator: steady steps regardless of frame rate.
  useEffect(() => {
    const loop = (now: number) => {
      frameRef.current = requestAnimationFrame(loop)
      const game = gameRef.current!

      if (statusRef.current === 'running') {
        if (!game.last) game.last = now
        game.acc += now - game.last
        game.last = now
        while (game.acc >= game.interval && statusRef.current === 'running') {
          game.acc -= game.interval
          step()
        }
      } else {
        game.last = 0
      }
      draw()
    }

    frameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameRef.current)
  }, [step, draw])

  // Crisp on high-DPI screens, and redrawn whenever the box resizes.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const css = canvas.clientWidth || 280
      canvas.width = css * dpr
      canvas.height = css * dpr
      canvas.style.height = `${css}px`
      draw()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [draw])

  // Leaving the tab mid-game pauses rather than silently killing the run.
  useEffect(() => {
    const onHidden = () => {
      if (document.hidden && statusRef.current === 'running') setPhase('paused')
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [setPhase])

  const restart = useCallback(() => {
    gameRef.current = freshGame()
    setScore(0)
    setPhase('running')
  }, [setPhase])

  const steer = useCallback((dir: Point) => {
    const game = gameRef.current!
    const last = game.queue.at(-1) ?? game.dir
    // No instant 180s — that would be an unavoidable self-collision.
    if (last.x === -dir.x && last.y === -dir.y) return
    if (last.x === dir.x && last.y === dir.y) return
    if (game.queue.length < 2) game.queue.push(dir)
  }, [])

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const dirs: Record<string, Point> = {
      ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
    }
    const dir = dirs[e.key] ?? dirs[e.key.toLowerCase()]

    if (dir) {
      e.preventDefault() // otherwise the page scrolls under the board
      if (statusRef.current === 'idle' || statusRef.current === 'over') restart()
      else if (statusRef.current === 'running') steer(dir)
      return
    }

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (statusRef.current === 'running') setPhase('paused')
      else if (statusRef.current === 'paused') setPhase('running')
      else restart()
    }
  }

  // Swipe support, so it is playable on a phone while waiting.
  const touch = useRef<Point | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
    if (statusRef.current === 'idle' || statusRef.current === 'over') restart()
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const from = touch.current
    if (!from) return
    const t = e.touches[0]
    const dx = t.clientX - from.x
    const dy = t.clientY - from.y
    if (Math.hypot(dx, dy) < 24) return
    e.preventDefault()
    steer(Math.abs(dx) > Math.abs(dy)
      ? { x: Math.sign(dx), y: 0 }
      : { x: 0, y: Math.sign(dy) })
    touch.current = { x: t.clientX, y: t.clientY }
  }

  const overlay =
    status === 'idle' ? { title: 'Matopeli', hint: 'Klikkaa ja paina nuolinäppäintä' }
    : status === 'paused' ? { title: 'Tauolla', hint: 'Välilyönti jatkaa' }
    : status === 'over' ? { title: `Mato kuoli — ${score}`, hint: 'Välilyönti aloittaa alusta' }
    : null

  return (
    <section className="snake">
      <div className="snake-head">
        <h3>Matopeli</h3>
        <span className="snake-score">
          {score} <small>paras {best}</small>
        </span>
      </div>

      <div className="snake-board">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label="Matopeli: ohjaa nuolinäppäimillä"
          onKeyDown={onKeyDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onClick={() => { if (statusRef.current === 'idle') restart() }}
        />
        {overlay && (
          <button
            type="button"
            className="snake-overlay"
            onClick={(e) => {
              e.currentTarget.parentElement?.querySelector('canvas')?.focus()
              if (statusRef.current === 'paused') setPhase('running')
              else restart()
            }}
          >
            <strong>{overlay.title}</strong>
            <small>{overlay.hint}</small>
          </button>
        )}
      </div>
    </section>
  )
}

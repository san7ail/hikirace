import { useEffect } from 'react'

function isTextEntry(node: EventTarget | null): boolean {
  const el = node as HTMLElement | null
  if (!el || !el.tagName) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  )
}

/**
 * While a race is running the only legal move is clicking a link in the
 * article. This blocks the ways a browser lets you rewind instead:
 *
 *   - Backspace outside a text field (legacy "go back" on some browsers)
 *   - Alt+Left / Alt+Right
 *   - the Back button and back-gesture, via a self-restoring history entry
 *   - accidental reloads and tab closes, via beforeunload
 *
 * Deliberately NOT blocked: Ctrl+F. Searching the page you are standing on is
 * part of the game.
 */
export function useNavigationLock(active: boolean): void {
  useEffect(() => {
    if (!active) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' && !isTextEntry(e.target)) {
        e.preventDefault()
        return
      }
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
      }
    }

    // Park an extra entry on the stack, then put it back every time the player
    // pops it. Back therefore lands on the race again instead of leaving it.
    const guard = () => window.history.pushState({ hikirace: true }, '', window.location.href)
    guard()

    const onPopState = () => guard()

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    window.addEventListener('popstate', onPopState)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [active])
}

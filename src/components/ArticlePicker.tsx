import { useEffect, useId, useRef, useState } from 'react'
import { randomArticle, searchTitles } from '../api/hikipedia'
import { randomFromPool } from '../data/pool'

interface Props {
  label: string
  icon: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  /** Avoid rolling the same article as the other field. */
  avoid?: string
}

export function ArticlePicker({ label, icon, placeholder, value, onChange, avoid }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [rolling, setRolling] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  // Debounced autocomplete. The abort controller keeps a slow response from
  // overwriting the suggestions for a newer query.
  useEffect(() => {
    const query = value.trim()
    if (!query || !open) {
      setSuggestions([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchTitles(query, 8, controller.signal)
        .then((hits) => {
          setSuggestions(hits)
          setHighlighted(-1)
        })
        .catch(() => { /* aborted or offline: leave the list as it is */ })
    }, 180)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [value, open])

  useEffect(() => {
    const onDocumentDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentDown)
    return () => document.removeEventListener('mousedown', onDocumentDown)
  }, [])

  const choose = (title: string) => {
    onChange(title)
    setOpen(false)
    setSuggestions([])
  }

  const roll = async () => {
    setRolling(true)
    try {
      choose(await randomArticle())
    } catch {
      // Hikipedia unreachable or slow: the curated pool still gives a real race.
      choose(randomFromPool(avoid))
    } finally {
      setRolling(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      choose(suggestions[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="field">
      <div className="field-hint">
        <span aria-hidden="true">{icon}</span>
        {label}
      </div>
      <div className="picker" ref={boxRef}>
        <div className="picker-row">
          <input
            className="input"
            placeholder={placeholder}
            value={value}
            onChange={(e) => { onChange(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={open && suggestions.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
          />
          <button
            type="button"
            className="dice"
            onClick={roll}
            disabled={rolling}
            title="Arvo satunnainen artikkeli"
            aria-label="Arvo satunnainen artikkeli"
          >
            {rolling ? '…' : <DiceIcon />}
          </button>
        </div>

        {open && suggestions.length > 0 && (
          <ul className="suggestions" id={listId} role="listbox">
            {suggestions.map((title, i) => (
              <li key={title} role="option" aria-selected={i === highlighted}>
                <button
                  type="button"
                  data-active={i === highlighted}
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => choose(title)}
                >
                  {title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function DiceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="8.5" cy="8.5" r="1.6" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.6" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="1.6" fill="currentColor" />
      <circle cx="8.5" cy="15.5" r="1.6" fill="currentColor" />
    </svg>
  )
}

import { useState } from 'react'
import { isLobbyCode } from '../../shared/protocol'
import { Kekkonen } from './Kekkonen'
import { Logo } from './Logo'

interface Props {
  name: string
  onNameChange: (name: string) => void
  onSolo: () => void
  onCreateLobby: () => void
  onJoinLobby: (code: string) => void
  busy: boolean
  error: string | null
  initialCode?: string
}

export function HomeScreen({
  name, onNameChange, onSolo, onCreateLobby, onJoinLobby, busy, error, initialCode = '',
}: Props) {
  const [code, setCode] = useState(initialCode)
  const joinable = isLobbyCode(code.trim().toUpperCase())

  return (
    <div className="screen">
      <div className="column">
        <Logo />
        <Kekkonen size={104} />

        <p className="lede">
          Pääse artikkelista toiseen pelkkiä Hikipedian linkkejä seuraten.
          Ei takaisin-nappia, ei osoiteriviä — vain linkkejä.
        </p>

        {error && <div className="error" role="alert">{error}</div>}

        <div className="field">
          <label htmlFor="player-name">Nimesi</label>
          <input
            id="player-name"
            className="input"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Urho"
            maxLength={24}
            autoComplete="off"
          />
        </div>

        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault()
            if (joinable) onJoinLobby(code.trim().toUpperCase())
          }}
        >
          <div className="picker-row">
            <input
              className="input"
              placeholder="Pelikoodi"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 5))}
              maxLength={5}
              autoComplete="off"
              aria-label="Pelikoodi"
            />
            <button
              type="submit"
              className="btn"
              style={{ width: 170 }}
              disabled={!joinable || busy}
            >
              Liity peliin
            </button>
          </div>
        </form>

        <button type="button" className="btn" onClick={onCreateLobby} disabled={busy}>
          {busy ? 'Hetki…' : 'Luo uusi peli'}
        </button>

        <p className="note">
          tai{' '}
          <button
            type="button"
            className="link"
            style={{ background: 'none', border: 0, padding: 0 }}
            onClick={onSolo}
          >
            pelaa yksin
          </button>
        </p>
      </div>
    </div>
  )
}

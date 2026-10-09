import { Kekkonen } from './Kekkonen'
import { Logo } from './Logo'

interface Props {
  name: string
  onNameChange: (name: string) => void
  onStart: () => void
}

export function HomeScreen({ name, onNameChange, onStart }: Props) {
  return (
    <div className="screen">
      <div className="column">
        <Logo />
        <Kekkonen size={104} />

        <p className="lede">
          Pääse artikkelista toiseen pelkkiä Hikipedian linkkejä seuraten.
          Ei takaisin-nappia, ei osoiteriviä — vain linkkejä.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onStart()
          }}
        >
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

          <button type="submit" className="btn">Luo uusi kisa</button>
        </form>

        <div className="field disabled-block" style={{ marginTop: 20 }} aria-hidden="true">
          <div className="picker-row">
            <input className="input" placeholder="Pelikoodi" disabled />
            <button type="button" className="btn" style={{ width: 160 }} disabled>
              Liity peliin
            </button>
          </div>
        </div>
        <p className="note">Moninpeli kavereiden kanssa on vielä työn alla.</p>
      </div>
    </div>
  )
}

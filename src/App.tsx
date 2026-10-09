import { useCallback, useState } from 'react'
import { FinishScreen } from './components/FinishScreen'
import { HomeScreen } from './components/HomeScreen'
import { RaceScreen } from './components/RaceScreen'
import { SetupScreen } from './components/SetupScreen'
import type { Outcome, RaceConfig, RaceResult, Step } from './types'

type Phase =
  | { name: 'home' }
  | { name: 'setup' }
  | { name: 'race'; config: RaceConfig }
  | { name: 'finish'; result: RaceResult }

const NAME_KEY = 'hikirace.name'

export default function App() {
  const [phase, setPhase] = useState<Phase>({ name: 'home' })
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem(NAME_KEY) ?? '',
  )

  const rememberName = (name: string) => {
    setPlayerName(name)
    try {
      localStorage.setItem(NAME_KEY, name)
    } catch {
      // Private browsing: playing without a remembered name is fine.
    }
  }

  const finish = useCallback(
    (outcome: Outcome, path: Step[], durationMs: number) => {
      setPhase((current) =>
        current.name === 'race'
          ? { name: 'finish', result: { config: current.config, outcome, path, durationMs } }
          : current,
      )
    },
    [],
  )

  switch (phase.name) {
    case 'home':
      return (
        <HomeScreen
          name={playerName}
          onNameChange={rememberName}
          onStart={() => setPhase({ name: 'setup' })}
        />
      )

    case 'setup':
      return (
        <SetupScreen
          playerName={playerName}
          onBack={() => setPhase({ name: 'home' })}
          onBegin={(start, target) => setPhase({ name: 'race', config: { start, target } })}
        />
      )

    case 'race':
      return (
        <RaceScreen
          // Remounts on a rematch so the clock and route start clean.
          key={`${phase.config.start}→${phase.config.target}`}
          start={phase.config.start}
          target={phase.config.target}
          onFinish={finish}
        />
      )

    case 'finish':
      return (
        <FinishScreen
          result={phase.result}
          playerName={playerName}
          onRematch={() => setPhase({ name: 'race', config: phase.result.config })}
          onNewRace={() => setPhase({ name: 'setup' })}
        />
      )
  }
}

export interface Article {
  /** Canonical title as MediaWiki resolved it (redirects followed). */
  title: string
  pageid: number
  html: string
}

export interface Step {
  title: string
  /** ms since race start when this article was opened */
  at: number
}

export type Outcome = 'won' | 'surrendered'

export interface RaceConfig {
  start: string
  target: string
}

export interface RaceResult {
  config: RaceConfig
  outcome: Outcome
  path: Step[]
  durationMs: number
}

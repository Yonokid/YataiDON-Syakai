export interface Score {
  hash: string
  title: Record<string, string>
  subtitle: Record<string, string>
  level: number
  difficulty: number
  crown: number
  rank: number
  score: number
  good: number
  ok: number
  bad: number
  drumroll: number
  max_combo: number
}

export interface UserData {
  username: string
  scores: Score[]
}

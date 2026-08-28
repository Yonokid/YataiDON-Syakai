import type { NameplateColor } from './components/Nameplate.vue'

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

export interface UnlockedTitle {
  number: number
  name: string
}

export interface UserData {
  username: string
  title: string
  nameplate_color: NameplateColor
  unlocked_titles: UnlockedTitle[]
  import_requested: boolean
  import_completed: boolean
  chara_color_1: string
  chara_color_2: string
  chara_color_3: string
  chara_head_index: number
  chara_body_index: number
  chara_cos_index: number
  chara_is_costume: boolean
  scores: Score[]
}

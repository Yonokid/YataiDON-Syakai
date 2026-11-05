import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const DIFFICULTY_KEYS = ['easy', 'normal', 'hard', 'oni', 'ura', 'tower', 'dan']
const LANGUAGE_STORAGE_KEY = 'yataidon_song_language'

export const SONG_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '简体中文' },
  { code: 'zh_tw', label: '繁體中文' },
]

export const songLanguage = ref(localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? 'en')
watch(songLanguage, (code) => localStorage.setItem(LANGUAGE_STORAGE_KEY, code))

// Identifies a song across its difficulties. Independent of the display language, so
// switching language can't merge or split songs whose translations are partial.
export function songGroupKey(title: Record<string, string>) {
  return title.en ?? Object.values(title)[0] ?? ''
}

export function useSongDisplay() {
  const { t } = useI18n()

  function songTitle(title: Record<string, string>) {
    return title[songLanguage.value] ?? (songGroupKey(title) || t('common.untitled'))
  }

  function difficultyLabel(difficulty: number) {
    const key = DIFFICULTY_KEYS[difficulty]
    return key ? t(`common.difficulties.${key}`) : t('common.difficultyN', { n: difficulty })
  }

  return { songTitle, difficultyLabel }
}

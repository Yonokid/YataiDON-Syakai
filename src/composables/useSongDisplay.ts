import { useI18n } from 'vue-i18n'

const DIFFICULTY_KEYS = ['easy', 'normal', 'hard', 'oni', 'ura', 'tower', 'dan']

export function useSongDisplay() {
  const { t } = useI18n()

  function songTitle(title: Record<string, string>) {
    return title.en ?? Object.values(title)[0] ?? t('common.untitled')
  }

  function difficultyLabel(difficulty: number) {
    const key = DIFFICULTY_KEYS[difficulty]
    return key ? t(`common.difficulties.${key}`) : t('common.difficultyN', { n: difficulty })
  }

  return { songTitle, difficultyLabel }
}

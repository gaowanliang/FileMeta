import { createI18n } from 'vue-i18n'
import en from './en.js'
import zh from './zh.js'

const i18n = createI18n({
  legacy: false,
  locale: navigator.language.startsWith('zh') ? 'zh' : 'en',
  fallbackLocale: 'en',
  messages: { en, zh },
})

export default i18n

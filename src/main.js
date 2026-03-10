import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'primeicons/primeicons.css'

import App from './App.vue'
import i18n from './locales/index.js'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(i18n)

app.mount('#app')

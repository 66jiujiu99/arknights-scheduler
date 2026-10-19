import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initApp } from './stores/session'
import './assets/styles/main.css'

await initApp()

createApp(App).use(router).mount('#app')

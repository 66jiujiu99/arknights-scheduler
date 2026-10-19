import { createRouter, createWebHashHistory } from 'vue-router'
import { store } from '../stores/session'

const routes = [
  { path: '/', redirect: () => (store.session ? '/setup' : '/login') },
  { path: '/login', name: 'Login', component: () => import('../views/LoginView.vue') },
  { path: '/setup', name: 'Setup', component: () => import('../views/SetupView.vue'), meta: { auth: true } },
  { path: '/plan', name: 'Plan', component: () => import('../views/PlanView.vue'), meta: { auth: true } },
  { path: '/about', name: 'About', component: () => import('../views/AboutView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  if (to.meta.auth && !store.session) return { name: 'Login' }
  if (to.name === 'Login' && store.session) return { name: 'Setup' }
  return true
})

export default router

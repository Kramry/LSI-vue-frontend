
import { createApp } from 'vue'
import './assets/main.css'
import App from './App.vue'
import router from './router'
import { initializeAnalytics, trackFileAccess, trackPageView, trackRouteActivity } from './services/analytics'

initializeAnalytics()

router.afterEach((to) => {
  const routePath = to.matched.at(-1)?.path || to.path
  const safePagePath = to.path.replace(/\/\d+(?=\/|$)/g, '/:id')
  const pageTitle = String(to.meta.title ?? to.name ?? routePath)
  trackPageView(safePagePath, pageTitle, to.fullPath)
  trackRouteActivity(routePath, to.query.payment)
})

document.addEventListener('click', (event) => trackFileAccess(event.target))

createApp(App)
  .use(router)
  .mount('#app')

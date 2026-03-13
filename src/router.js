import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import ScannerView from './views/ScannerView.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeView
  },
  {
    path: '/sku/:name',
    name: 'Scanner',
    component: ScannerView,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
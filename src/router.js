import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import ScannerView from './views/ScannerView.vue'
import ReportsView from './views/ReportsView.vue'

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
  },
  {
    path: '/reports/:name',
    name: 'Reports',
    component: ReportsView,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
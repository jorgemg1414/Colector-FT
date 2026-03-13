<script setup>
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const isOffline = ref(false)

// Configurar modo oscuro automático
onMounted(() => {
  // Quasar ya detecta el modo oscuro del sistema automáticamente
  // Solo necesitamos activar la detección automática
  $q.dark.set('auto')
  
  // Detectar conexión
  isOffline.value = !navigator.onLine
  
  window.addEventListener('online', () => {
    isOffline.value = false
    $q.notify({
      type: 'positive',
      message: 'Conexión restaurada',
      position: 'top'
    })
  })
  
  window.addEventListener('offline', () => {
    isOffline.value = true
    $q.notify({
      type: 'warning',
      message: 'Modo offline - Los datos se guardarán localmente',
      position: 'top'
    })
  })
})
</script>

<template>
  <div class="app-container" :class="{ 'is-offline': isOffline }">
    <router-view />
    <div v-if="isOffline" class="offline-indicator">
      <q-icon name="cloud_off" />
      <span>Modo Offline</span>
    </div>
  </div>
</template>

<style>
.app-container {
  min-height: 100vh;
}

.offline-indicator {
  position: fixed;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #ff9800;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  z-index: 1000;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}
</style>

<style>
* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
}

body.body--dark {
  background-color: #121212;
}
</style>

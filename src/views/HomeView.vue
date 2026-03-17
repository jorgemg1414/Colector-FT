<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

const router = useRouter()
const $q = useQuasar()

const inventoryName = ref('')
const inventories = ref([])

// Cargar datos guardados al iniciar
onMounted(() => {
  loadInventories()
  // Limpiar el campo de nombre al iniciar/recargar
  inventoryName.value = ''
})

const savedDataInfo = computed(() => {
  return inventories.value.length > 0 ? `${inventories.value.length} inventarios guardados` : 'No hay inventarios guardados'
})

function loadInventories() {
  const savedData = localStorage.getItem('colectorData')
  if (savedData) {
    try {
      const data = JSON.parse(savedData)
      // NO cargar el inventoryName aquí para que aparezca vacío al recargar
      
      if (data.inventories) {
        // Convertir objeto a array y ordenar por fecha (más reciente primero)
        inventories.value = Object.values(data.inventories)
          .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
      }
    } catch (e) {
      console.error('Error loading data:', e)
    }
  }
}

function startInventory() {
  if (!inventoryName.value.trim()) {
    $q.notify({
      type: 'warning',
      message: 'Por favor, ingresa un nombre para el inventario.',
      position: 'top'
    })
    return
  }
  
  // Verificar si ya existe un inventario con ese nombre
  const exists = inventories.value.find(inv => inv.name === inventoryName.value)
  
  if (exists) {
    $q.dialog({
      title: 'Inventario Existente',
      message: `Ya existe un inventario con el nombre "${inventoryName.value}". ¿Qué deseas hacer?`,
      cancel: true,
      options: {
        type: 'radio',
        model: 'open',
        items: [
          { label: 'Abrir inventario existente', value: 'open' },
          { label: 'Crear nuevo (se perderán los datos anteriores)', value: 'new' }
        ]
      }
    }).onOk(option => {
      if (option === 'new') {
        // Eliminar el inventario existente antes de crear uno nuevo
        deleteInventory(inventoryName.value, false)
      }
      // Navegar a la ruta del inventario
      router.push(`/sku/${encodeURIComponent(inventoryName.value)}`)
    })
  } else {
    // Navegar a la ruta del inventario
    router.push(`/sku/${encodeURIComponent(inventoryName.value)}`)
  }
}

function openInventory(name) {
  router.push(`/sku/${encodeURIComponent(name)}`)
}

function deleteInventory(name, confirm = true) {
  const doDelete = () => {
    const savedData = localStorage.getItem('colectorData')
    if (savedData) {
      try {
        const data = JSON.parse(savedData)
        if (data.inventories && data.inventories[name]) {
          delete data.inventories[name]
          localStorage.setItem('colectorData', JSON.stringify(data))
          loadInventories()
          $q.notify({
            type: 'positive',
            message: `Inventario "${name}" eliminado.`,
            position: 'top'
          })
        }
      } catch (e) {
        console.error('Error deleting inventory:', e)
      }
    }
  }

  if (confirm) {
    $q.dialog({
      title: 'Eliminar Inventario',
      message: `¿Estás seguro de que quieres eliminar el inventario "${name}"? Esta acción no se puede deshacer.`,
      cancel: true,
      ok: 'Eliminar'
    }).onOk(doDelete)
  } else {
    doDelete()
  }
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function toggleDarkMode() {
  $q.dark.toggle()
}
</script>

<template>
  <div class="home-view">
    <header>
      <div class="header-content">
        <h1>Colector de Inventario</h1>
        <q-btn
          flat
          :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
          @click="toggleDarkMode"
          class="dark-mode-btn"
        />
      </div>
    </header>
    <main class="home-main">
      <!-- Sección para crear nuevo inventario -->
      <div class="home-card">
        <h2>Crear Nuevo Inventario</h2>
        <p>Ingresa un nombre para tu inventario:</p>
        <q-input
          v-model="inventoryName"
          filled
          label="Nombre del inventario"
          @keyup.enter="startInventory"
          class="name-input"
        >
          <template v-slot:append>
            <q-icon name="edit" />
          </template>
        </q-input>
        <q-btn 
          color="primary" 
          label="Comenzar Inventario" 
          @click="startInventory" 
          class="start-btn"
          size="lg"
        />
      </div>

      <!-- Sección de historial de inventarios -->
      <div class="history-card">
        <h2>Historial de Inventarios</h2>
        <p class="text-grey">{{ savedDataInfo }}</p>
        
        <div v-if="inventories.length > 0" class="inventory-list">
          <q-list bordered separator>
            <q-item 
              v-for="inventory in inventories" 
              :key="inventory.name"
              class="inventory-item"
            >
              <q-item-section>
                <q-item-label class="text-weight-bold">{{ inventory.name }}</q-item-label>
                <q-item-label caption>
                  {{ Object.keys(inventory.inventory).length }} productos | 
                  {{ formatDate(inventory.lastModified) }}
                </q-item-label>
              </q-item-section>
              
              <q-item-section side>
                <div class="action-buttons">
                  <q-btn 
                    flat 
                    round 
                    color="primary" 
                    icon="visibility" 
                    @click="openInventory(inventory.name)"
                    size="sm"
                  >
                    <q-tooltip>Abrir</q-tooltip>
                  </q-btn>
                  <q-btn 
                    flat 
                    round 
                    color="negative" 
                    icon="delete" 
                    @click="deleteInventory(inventory.name)"
                    size="sm"
                  >
                    <q-tooltip>Eliminar</q-tooltip>
                  </q-btn>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
        
        <div v-else class="no-inventories">
          <q-icon name="inventory_2" size="48px" color="grey-5" />
          <p>No hay inventarios guardados</p>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

header {
  background-color: #1976D2;
  color: white;
  padding: 0;
  padding-block: 0;
  padding-inline: 0;
  text-align: center;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: none;
  line-height: 1;
}

body.dark header {
  background-color: #0d47a1;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 40px;
}

header h1 {
  margin: 0px;
  font-size: 1.2rem;
}

.dark-mode-btn {
  position: absolute;
  right: 10px;
  color: white;
}

.home-main {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.home-card {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  text-align: center;
}

body.body--dark .home-card {
  background: #1e1e1e;
}

.history-card {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  flex: 1;
}

body.body--dark .history-card {
  background: #1e1e1e;
}

.home-card h2, .history-card h2 {
  margin-top: 0;
  color: #1976D2;
  font-size: 1.2rem;
}

body.body--dark .home-card h2, body.body--dark .history-card h2 {
  color: #64b5f6;
}

.home-card p {
  color: #666;
  margin-bottom: 20px;
}

body.body--dark .home-card p {
  color: #aaaaaa;
}

.home-card, .history-card {
  color: #333;
}

body.body--dark .home-card, body.body--dark .history-card {
  color: #e0e0e0;
}

.name-input {
  margin-bottom: 20px;
}

.start-btn {
  width: 100%;
  padding: 12px;
  font-size: 1.1rem;
}

.inventory-list {
  margin-top: 15px;
}

.inventory-item {
  border-radius: 8px;
  margin-bottom: 5px;
}

.action-buttons {
  display: flex;
  gap: 5px;
}

.no-inventories {
  text-align: center;
  padding: 30px;
  color: #999;
}

body.body--dark .no-inventories {
  color: #777;
}

.no-inventories p {
  margin-top: 10px;
}

.file-upload-section {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 15px;
}

.file-input {
  flex: 1;
}

/* Estilos para elementos de Quasar en modo oscuro */
body.body--dark .q-item {
  color: #e0e0e0;
  background-color: #1e1e1e;
}

body.body--dark .q-item__label {
  color: #e0e0e0;
}

body.body--dark .q-item__label.caption {
  color: #aaaaaa;
}

body.body--dark .q-input--filled {
  background-color: #2a2a2a;
}

body.body--dark .q-field__label {
  color: #aaaaaa;
}

body.body--dark .q-field__control {
  color: #e0e0e0;
}

body.body--dark .q-field__input {
  color: #e0e0e0;
}

body.body--dark .q-list--bordered {
  border-color: #333;
}

body.body--dark .q-item--separator {
  border-color: #333;
}

body.body--dark .q-btn {
  color: #e0e0e0;
}

body.body--dark .q-file--filled {
  background-color: #2a2a2a;
}

body.body--dark .text-grey {
  color: #aaaaaa !important;
}
</style>
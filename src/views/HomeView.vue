<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

const router = useRouter()
const $q = useQuasar()

const inventoryName = ref('')
const inventories = ref([])
const allowedSkus = ref([]) // Lista de SKUs permitidos
const file = ref(null) // Archivo seleccionado

// Cargar datos guardados al iniciar
onMounted(() => {
  loadInventories()
  loadAllowedSkus()
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

function loadAllowedSkus() {
  const savedSkus = localStorage.getItem('allowedSkus')
  if (savedSkus) {
    try {
      allowedSkus.value = JSON.parse(savedSkus)
    } catch (e) {
      console.error('Error loading allowed SKUs:', e)
    }
  }
}

function handleFileUpload(selectedFile) {
  if (!selectedFile) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target.result
    // Dividir por líneas y limpiar espacios
    const skus = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
    
    if (skus.length > 0) {
      allowedSkus.value = skus
      localStorage.setItem('allowedSkus', JSON.stringify(skus))
      $q.notify({
        type: 'positive',
        message: `Se cargaron ${skus.length} SKUs permitidos.`,
        position: 'top'
      })
    } else {
      $q.notify({
        type: 'warning',
        message: 'El archivo está vacío o no contiene SKUs válidos.',
        position: 'top'
      })
    }
  }
  
  reader.onerror = () => {
    $q.notify({
      type: 'negative',
      message: 'Error al leer el archivo.',
      position: 'top'
    })
  }
  
  reader.readAsText(selectedFile)
}

function clearAllowedSkus() {
  $q.dialog({
    title: 'Eliminar SKUs Permitidos',
    message: '¿Estás seguro de que quieres eliminar la lista de SKUs permitidos?',
    cancel: true,
    ok: 'Eliminar'
  }).onOk(() => {
    allowedSkus.value = []
    localStorage.removeItem('allowedSkus')
    $q.notify({
      type: 'positive',
      message: 'Lista de SKUs permitidos eliminada.',
      position: 'top'
    })
  })
}
</script>

<template>
  <div class="home-view">
    <header>
      <h1>Colector de Inventario</h1>
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

      <!-- Sección de carga de archivo de SKUs -->
      <div class="history-card">
        <h2>Lista de SKUs Permitidos</h2>
        <p class="text-grey">
          Carga un archivo .txt con un SKU por línea para comparar al escanear.
          <span v-if="allowedSkus.length > 0">({{ allowedSkus.length }} SKUs cargados)</span>
        </p>
        
        <div class="file-upload-section">
          <q-file
            v-model="file"
            filled
            label="Seleccionar archivo .txt"
            accept=".txt"
            @update:model-value="handleFileUpload"
            class="file-input"
          >
            <template v-slot:prepend>
              <q-icon name="attach_file" />
            </template>
          </q-file>
          
          <q-btn 
            v-if="allowedSkus.length > 0"
            flat 
            color="negative" 
            label="Eliminar Lista" 
            @click="clearAllowedSkus"
            size="sm"
            class="q-ml-md"
          />
        </div>
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
  padding: 1rem;
  text-align: center;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

header h1 {
  margin: 0;
  font-size: 1.2rem;
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

.history-card {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  flex: 1;
}

.home-card h2, .history-card h2 {
  margin-top: 0;
  color: #1976D2;
  font-size: 1.2rem;
}

.home-card p {
  color: #666;
  margin-bottom: 20px;
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
</style>
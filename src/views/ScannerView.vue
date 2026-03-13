<script setup>
import { ref, reactive, watch, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CameraScanner from '../components/CameraScanner.vue'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()

// Obtener el nombre del inventario de la ruta
const inventoryName = computed(() => route.params.name)

// Estados del escáner
const skuInput = ref('')
const skuInputRef = ref(null) // Referencia al input para enfocar
const searchQuery = ref('')
const inventory = reactive({})
const showQuantityModal = ref(false)
const tempSku = ref('')
const quantity = ref(1)
const tempProductName = ref('')
const editingSku = ref(null) // Para edición directa
const showCameraModal = ref(false)

// Base de datos vacía - permite cualquier SKU
const productsDB = {}

// Lista de SKUs permitidos (cargada desde localStorage)
const allowedSkus = ref([])

// Computed para el total de piezas
const totalPiezas = computed(() => {
  return Object.values(inventory).reduce((sum, item) => sum + item.cantidad, 0)
})

// Computed para productos filtrados
const filteredInventory = computed(() => {
  if (!searchQuery.value.trim()) {
    return inventory
  }
  
  const query = searchQuery.value.toLowerCase()
  const filtered = {}
  
  for (const [sku, item] of Object.entries(inventory)) {
    if (sku.toLowerCase().includes(query) || 
        item.nombre.toLowerCase().includes(query)) {
      filtered[sku] = item
    }
  }
  
  return filtered
})

// Función para guardar en localStorage
const saveToStorage = () => {
  const savedData = localStorage.getItem('colectorData')
  let data = {}
  
  if (savedData) {
    try {
      data = JSON.parse(savedData)
    } catch (e) {
      console.error('Error parsing saved data:', e)
    }
  }
  
  // Actualizar solo el inventario actual (usando el nombre como clave)
  if (!data.inventories) {
    data.inventories = {}
  }
  
  data.inventories[inventoryName.value] = {
    name: inventoryName.value,
    inventory: { ...inventory },
    lastModified: new Date().toISOString()
  }
  
  // Guardar también el nombre actual para el home
  data.inventoryName = inventoryName.value
  
  localStorage.setItem('colectorData', JSON.stringify(data))
}

// Función para cargar desde localStorage
const loadFromStorage = () => {
  const savedData = localStorage.getItem('colectorData')
  if (savedData) {
    try {
      const data = JSON.parse(savedData)
      
      // Cargar inventario específico si existe
      if (data.inventories && data.inventories[inventoryName.value]) {
        const savedInventory = data.inventories[inventoryName.value].inventory
        Object.keys(savedInventory).forEach(key => {
          inventory[key] = savedInventory[key]
        })
      }
    } catch (e) {
      console.error('Error loading data:', e)
    }
  }
  
  // Cargar lista de SKUs permitidos
  const savedSkus = localStorage.getItem('allowedSkus')
  if (savedSkus) {
    try {
      allowedSkus.value = JSON.parse(savedSkus)
    } catch (e) {
      console.error('Error loading allowed SKUs:', e)
    }
  }
}

// Observar cambios para guardar automáticamente
watch(inventory, () => {
  saveToStorage()
}, { deep: true })

// Watcher para buscar en tiempo real

// Cargar datos al iniciar
onMounted(() => {
  loadFromStorage()
})

// Funciones del Escáner
function addItem() {
  const input = skuInput.value.trim().toUpperCase()
  if (!input) return

  let sku = input
  let productName = 'Producto Sin Nombre'
  let isAllowed = true
  
  // Verificar si hay una lista de SKUs permitidos
  if (allowedSkus.value.length > 0) {
    // Si el SKU no está en la lista de permitidos
    if (!allowedSkus.value.includes(sku)) {
      isAllowed = false
      // Registrar el SKU no permitido
      logUnauthorizedSku(sku)
    }
  }
  
  // Si el SKU existe en la base de datos, usar su nombre
  if (productsDB[sku]) {
    productName = productsDB[sku]
  }
  
  // Agregar el producto al inventario (se agrega siempre, permitido o no)
  addProductToInventory(sku, productName)
}

function logUnauthorizedSku(sku) {
  // Obtener los SKUs no autorizados guardados
  const savedUnauthorized = localStorage.getItem('unauthorizedSkus')
  let unauthorizedSkus = []
  
  if (savedUnauthorized) {
    try {
      unauthorizedSkus = JSON.parse(savedUnauthorized)
    } catch (e) {
      console.error('Error parsing unauthorized SKUs:', e)
    }
  }
  
  // Añadir el nuevo SKU con fecha
  unauthorizedSkus.push({
    sku: sku,
    timestamp: new Date().toISOString(),
    inventoryName: inventoryName.value
  })
  
  // Guardar de nuevo (limitar a los últimos 1000 para no llenar el storage)
  if (unauthorizedSkus.length > 1000) {
    unauthorizedSkus = unauthorizedSkus.slice(-1000)
  }
  
  localStorage.setItem('unauthorizedSkus', JSON.stringify(unauthorizedSkus))
}

function addProductToInventory(sku, productName) {
  // Guardar el SKU y nombre temporalmente
  tempSku.value = sku
  tempProductName.value = productName
  
  // Mostrar el modal para ingresar cantidad
  showQuantityModal.value = true
  
  // Resetear cantidad a 1 por defecto
  quantity.value = 1
  
  skuInput.value = ''
}

function confirmQuantity() {
  const sku = tempSku.value
  const qty = parseInt(quantity.value) || 1

  if (inventory[sku]) {
    inventory[sku].cantidad += qty
  } else {
    inventory[sku] = {
      nombre: tempProductName.value,
      cantidad: qty,
      ubicacion: 'General'
    }
  }

  closeModal()
}

function closeModal() {
  showQuantityModal.value = false
  tempSku.value = ''
  quantity.value = 1
}

function incrementItem(sku) {
  if (inventory[sku]) {
    inventory[sku].cantidad += 1
  }
}

function decrementItem(sku) {
  if (inventory[sku]) {
    if (inventory[sku].cantidad > 1) {
      inventory[sku].cantidad -= 1
    } else {
      removeItem(sku)
    }
  }
}

function removeItem(sku) {
  $q.dialog({
    title: 'Eliminar Producto',
    message: `¿Estás seguro de eliminar ${inventory[sku].nombre}?`,
    cancel: true,
    ok: 'Eliminar'
  }).onOk(() => {
    delete inventory[sku]
  })
}

// Función para editar cantidad directamente
function startEditQuantity(sku) {
  editingSku.value = sku
}

function saveEditQuantity(sku, event) {
  const newValue = parseInt(event.target.value)
  if (newValue && newValue > 0) {
    inventory[sku].cantidad = newValue
  }
  editingSku.value = null
}

function cancelEditQuantity() {
  editingSku.value = null
}

// Función para descargar TXT
function downloadTxt() {
  if (Object.keys(inventory).length === 0) {
    $q.notify({
      type: 'warning',
      message: 'No hay productos para descargar.',
      position: 'top'
    })
    return
  }

  // Generar contenido del archivo TXT
  // Formato: SKU,Cantidad (ej. 16,5)
  let content = ''
  for (const sku in inventory) {
    content += `${sku},${inventory[sku].cantidad}\n`
  }

  // Crear el blob y descargar
  const blob = new Blob([content], { type: 'text/plain' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  
  // Nombre fijo del archivo
  const fileName = 'colector.txt'
  
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)

  $q.notify({
    type: 'positive',
    message: `Archivo ${fileName} descargado.`,
    position: 'top'
  })
}

function goHome() {
  router.push('/')
}

function downloadUnauthorizedTxt() {
  // Obtener los SKUs no autorizados
  const savedUnauthorized = localStorage.getItem('unauthorizedSkus')
  if (!savedUnauthorized) {
    $q.notify({
      type: 'warning',
      message: 'No hay SKUs no permitidos registrados.',
      position: 'top'
    })
    return
  }
  
  let unauthorizedSkus = []
  try {
    unauthorizedSkus = JSON.parse(savedUnauthorized)
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: 'Error al leer los SKUs no permitidos.',
      position: 'top'
    })
    return
  }
  
  if (unauthorizedSkus.length === 0) {
    $q.notify({
      type: 'warning',
      message: 'No hay SKUs no permitidos registrados.',
      position: 'top'
    })
    return
  }
  
  // Formato: SKU,Fecha,Inventario
  let content = 'SKU,Fecha,Inventario\n'
  unauthorizedSkus.forEach(item => {
    content += `${item.sku},${item.timestamp},${item.inventoryName}\n`
  })
  
  // Crear el blob y descargar
  const blob = new Blob([content], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  
  const fileName = 'skus_no_permitidos.csv'
  
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
  
  $q.notify({
    type: 'positive',
    message: `Archivo ${fileName} descargado (${unauthorizedSkus.length} registros).`,
    position: 'top'
  })
}

function handleCodeScanned(code) {
  skuInput.value = code
  addItem()
}
</script>

<template>
  <div class="scanner-view">
    <header>
      <div class="header-content">
        <q-btn flat icon="arrow_back" @click="goHome" class="back-btn" />
        <h1>{{ inventoryName }}</h1>
      </div>
    </header>
    <main>
      <!-- Sección de Escaneo -->
      <section class="scanner-section">
        <h2>Escanear SKU</h2>
        <div class="scanner-container">
          <q-input
            ref="skuInputRef"
            v-model="skuInput"
            filled
            label="Apunte y escanee..."
            @keyup.enter="addItem"
            autofocus
            class="sku-input"
          >
            <template v-slot:prepend>
              <q-btn 
                flat 
                round 
                dense 
                icon="photo_camera" 
                @click="showCameraModal = true"
                class="camera-btn"
              />
            </template>
            <template v-slot:append>
              <q-icon name="qr_code_scanner" />
            </template>
          </q-input>
          <q-btn color="primary" label="OK" @click="addItem" class="scan-btn" />
        </div>
      </section>

      <!-- Resumen de Inventario -->
      <section class="summary-section" v-if="Object.keys(inventory).length > 0">
        <div class="summary-card">
          <div class="summary-item">
            <span class="summary-label">Total Productos:</span>
            <span class="summary-value">{{ Object.keys(filteredInventory).length }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Total Piezas:</span>
            <span class="summary-value total-piezas">{{ totalPiezas }}</span>
          </div>
        </div>
      </section>
      
      <!-- Indicador de SKUs Permitidos -->
      <div v-if="allowedSkus.length > 0" class="allowed-skus-indicator">
        <q-icon name="check_circle" color="positive" />
        <span>Lista de SKUs permitidos activa ({{ allowedSkus.length }} items)</span>
      </div>

      <!-- Búsqueda -->
      <section class="search-section" v-if="Object.keys(inventory).length > 0">
        <q-input
          v-model="searchQuery"
          filled
          placeholder="Buscar por SKU o nombre..."
          dense
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
          <template v-slot:append>
            <q-icon 
              v-if="searchQuery" 
              name="close" 
              class="cursor-pointer" 
              @click="searchQuery = ''" 
            />
          </template>
        </q-input>
      </section>

      <!-- Sección de Inventario -->
      <section class="inventory-section">
        <div class="section-header">
          <h2>Inventario ({{ Object.keys(filteredInventory).length }} items)</h2>
          <div class="download-buttons">
            <q-btn 
              color="secondary" 
              icon="download" 
              label="TXT" 
              @click="downloadTxt" 
              size="sm"
              :disable="Object.keys(inventory).length === 0"
            />
            <q-btn 
              color="negative" 
              icon="download" 
              label="No Permitidos" 
              @click="downloadUnauthorizedTxt" 
              size="sm"
              outline
            />
          </div>
        </div>
        <q-markup-table flat bordered>
          <thead>
            <tr>
              <th class="text-left">Producto</th>
              <th class="text-center">Cant.</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, sku) in filteredInventory" :key="sku">
              <td class="text-left">
                <div class="product-info">
                  <span class="sku-code">{{ sku }}</span>
                  <span class="product-name">{{ item.nombre }}</span>
                </div>
              </td>
              <td class="text-center">
                <!-- Edición directa de cantidad -->
                <div v-if="editingSku === sku" class="edit-quantity">
                  <q-input
                    :model-value="item.cantidad"
                    @update:model-value="val => inventory[sku].cantidad = parseInt(val) || 1"
                    type="number"
                    min="1"
                    dense
                    autofocus
                    @blur="cancelEditQuantity()"
                    @keyup.enter="cancelEditQuantity()"
                    class="edit-input"
                  />
                </div>
                <div v-else class="quantity-display" @click="startEditQuantity(sku)">
                  <q-badge color="primary" :label="item.cantidad" class="quantity-badge" />
                </div>
              </td>
              <td class="text-right">
                <q-btn-group outline>
                  <q-btn color="positive" icon="add" @click="incrementItem(sku)" size="sm" />
                  <q-btn color="negative" icon="remove" @click="decrementItem(sku)" size="sm" />
                  <q-btn color="grey" icon="delete" @click="removeItem(sku)" size="sm" />
                </q-btn-group>
              </td>
            </tr>
            <tr v-if="Object.keys(filteredInventory).length === 0">
              <td colspan="3" class="text-center text-grey">
                {{ searchQuery ? 'No se encontraron productos' : 'No hay productos' }}
              </td>
            </tr>
          </tbody>
        </q-markup-table>
      </section>
    </main>

    <!-- Modal para Cantidad -->
    <q-dialog v-model="showQuantityModal" persistent>
      <q-card style="min-width: 300px">
        <q-card-section class="text-center">
          <div class="text-h6">Ingresar Cantidad</div>
          <div class="text-subtitle2 text-grey">{{ tempProductName }} ({{ tempSku }})</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="quantity-control">
            <q-btn round color="primary" icon="remove" @click="quantity > 1 ? quantity-- : null" size="lg" />
            <q-input 
              v-model.number="quantity" 
              type="number" 
              min="1" 
              outlined 
              input-class="text-center text-h5"
              class="qty-input"
            />
            <q-btn round color="primary" icon="add" @click="quantity++" size="lg" />
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancelar" color="grey" v-close-popup />
          <q-btn flat label="Aceptar" color="primary" @click="confirmQuantity" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <CameraScanner 
      v-model="showCameraModal" 
      @code-scanned="handleCodeScanned" 
    />

    <footer>
      <p>Colector v1.0 - Mobile Ready</p>
    </footer>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  margin: 0;
  padding: 0;
  background-color: #f0f2f5;
  -webkit-font-smoothing: antialiased;
}

.scanner-view {
  padding-bottom: 60px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  background-color: #1976D2;
  color: white;
  padding: 0.5rem;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.back-btn {
  color: white;
}

header h1 {
  margin: 0;
  font-size: 1rem;
  flex: 1;
  text-align: center;
}

main {
  flex: 1;
  padding: 15px;
}

/* Scanner Section */
.scanner-section {
  margin-bottom: 20px;
}

.scanner-container {
  display: flex;
  gap: 10px;
  background: white;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

.sku-input {
  flex: 1;
}

.scan-btn {
  height: 56px;
  font-weight: bold;
}

/* Summary Section */
.summary-section {
  margin-bottom: 15px;
}

.summary-card {
  display: flex;
  justify-content: space-around;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

.summary-item {
  text-align: center;
}

.summary-label {
  display: block;
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 5px;
}

.summary-value {
  font-size: 1.2rem;
  font-weight: bold;
  color: #1976D2;
}

.total-piezas {
  color: #28a745;
  font-size: 1.4rem;
}

.allowed-skus-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #e8f5e9;
  color: #2e7d32;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 15px;
  font-size: 0.9rem;
}

/* Search Section */
.search-section {
  margin-bottom: 15px;
}

/* Inventory Table */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.download-buttons {
  display: flex;
  gap: 5px;
}

.inventory-section h2 {
  font-size: 1rem;
  margin: 0;
  color: #555;
}

.product-info {
  display: flex;
  flex-direction: column;
}

.sku-code {
  font-size: 0.8rem;
  color: #888;
  font-weight: bold;
}

.product-name {
  font-size: 1rem;
  color: #333;
  margin-top: 2px;
}

.quantity-badge {
  font-size: 1.1rem;
  padding: 5px 15px;
  cursor: pointer;
}

.quantity-display {
  cursor: pointer;
}

.edit-quantity {
  display: flex;
  justify-content: center;
}

.edit-input {
  width: 60px;
}

.quantity-control {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin: 20px 0;
}

.qty-input {
  width: 80px;
}

.camera-btn {
  color: #1976D2;
}

footer {
  text-align: center;
  padding: 15px;
  background-color: #333;
  color: white;
  position: fixed;
  bottom: 0;
  width: 100%;
  font-size: 0.9rem;
}
</style>

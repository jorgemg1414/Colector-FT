<script setup>
import { ref, reactive, watch, onMounted, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CameraScanner from '../components/CameraScanner.vue'
import { useProductStore } from '../stores/products'
import { useFileStore } from '../stores/file'
import * as XLSX from 'xlsx'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const productStore = useProductStore()
const fileStore = useFileStore()

const inventoryName = computed(() => route.params.name)

// Estados del escáner
const skuInput = ref('')
const skuInputRef = ref(null)
const searchQuery = ref('')
const inventory = reactive({})
const showQuantityModal = ref(false)
const tempSku = ref('')
const quantity = ref(1)
const tempProductName = ref('')
const tempIsInEntrada = ref(false)
const editingSku = ref(null)
const showCameraModal = ref(false)
const loading = ref(false)
const fileInputRef = ref(null)
const qtyInputRef = ref(null)

// SKUs de traspaso de entrada
const entradaSkus = ref({})

// ── Nuevas features ──────────────────────────────────────────
// Modo rápido: suma 1 sin mostrar modal de cantidad
const fastScanMode = ref(false)

// Conexión a base de datos de productos
const useDatabase = ref(false)

// Deshacer último escaneo
const lastAction = ref(null) // { sku, productName, wasNew, previousQty }

// Flash visual al escanear
const scanFlash = ref('') // 'success' | 'error' | ''

// Historial de acciones
const actionHistory = ref([])
const showHistoryModal = ref(false)
// ─────────────────────────────────────────────────────────────

// ── Computed ──────────────────────────────────────────────────
const totalPiezas = computed(() =>
  Object.values(inventory).reduce((sum, item) => sum + item.cantidad, 0)
)

const filteredInventory = computed(() => {
  if (!searchQuery.value.trim()) return inventory
  const query = searchQuery.value.toLowerCase()
  const filtered = {}
  for (const [sku, item] of Object.entries(inventory)) {
    if (sku.toLowerCase().includes(query) || item.nombre.toLowerCase().includes(query)) {
      filtered[sku] = item
    }
  }
  return filtered
})
// ─────────────────────────────────────────────────────────────

// ── Sonido ────────────────────────────────────────────────────
function playBeep(success = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    if (success) {
      oscillator.frequency.setValueAtTime(880, ctx.currentTime)
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.15)
    } else {
      oscillator.frequency.setValueAtTime(220, ctx.currentTime)
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.4)
    }
  } catch (e) {
    // Audio no soportado, continuar sin sonido
  }
}
// ─────────────────────────────────────────────────────────────

// ── Vibración ─────────────────────────────────────────────────
function vibrate(success = true) {
  if ('vibrate' in navigator) {
    navigator.vibrate(success ? 50 : [100, 50, 100])
  }
}
// ─────────────────────────────────────────────────────────────

// ── Flash visual ──────────────────────────────────────────────
function triggerFlash(success = true) {
  scanFlash.value = success ? 'success' : 'error'
  setTimeout(() => { scanFlash.value = '' }, 300)
}
// ─────────────────────────────────────────────────────────────

// ── Historial ─────────────────────────────────────────────────
function addToHistory(entry) {
  actionHistory.value.unshift({ ...entry, timestamp: new Date().toISOString() })
  if (actionHistory.value.length > 100) {
    actionHistory.value = actionHistory.value.slice(0, 100)
  }
  saveHistoryToStorage()
}

function saveHistoryToStorage() {
  localStorage.setItem(`history_${inventoryName.value}`, JSON.stringify(actionHistory.value))
}

function loadHistoryFromStorage() {
  const saved = localStorage.getItem(`history_${inventoryName.value}`)
  if (!saved) return
  try { actionHistory.value = JSON.parse(saved) } catch (e) {}
}

function formatHistoryTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}
// ─────────────────────────────────────────────────────────────

// ── Deshacer último escaneo ───────────────────────────────────
function undoLastScan() {
  if (!lastAction.value) return
  const { sku, productName, wasNew, previousQty } = lastAction.value

  if (wasNew) {
    delete inventory[sku]
  } else {
    inventory[sku].cantidad = previousQty
  }

  addToHistory({ sku, productName, quantity: 0, action: 'undo' })
  lastAction.value = null

  $q.notify({ type: 'warning', message: 'Último escaneo deshecho.', position: 'top' })
  nextTick(() => { skuInputRef.value?.focus() })
}
// ─────────────────────────────────────────────────────────────

// ── Storage ───────────────────────────────────────────────────
const saveToStorage = () => {
  const savedData = localStorage.getItem('colectorData')
  let data = {}
  if (savedData) {
    try { data = JSON.parse(savedData) } catch (e) {}
  }
  if (!data.inventories) data.inventories = {}
  data.inventories[inventoryName.value] = {
    name: inventoryName.value,
    inventory: { ...inventory },
    lastModified: new Date().toISOString()
  }
  data.inventoryName = inventoryName.value
  localStorage.setItem('colectorData', JSON.stringify(data))
}

const loadFromStorage = () => {
  const savedData = localStorage.getItem('colectorData')
  if (savedData) {
    try {
      const data = JSON.parse(savedData)
      if (data.inventories && data.inventories[inventoryName.value]) {
        const savedInventory = data.inventories[inventoryName.value].inventory
        Object.keys(savedInventory).forEach(key => {
          inventory[key] = savedInventory[key]
        })
      }
    } catch (e) {}
  }
  const savedEntrada = localStorage.getItem('entradaSkus')
  if (savedEntrada) {
    try { entradaSkus.value = JSON.parse(savedEntrada) } catch (e) {}
  }
}
// ─────────────────────────────────────────────────────────────

// ── Traspaso de entrada ───────────────────────────────────────
function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result
    if (typeof content !== 'string') return
    const lines = content.split('\n')
    const entradaData = {}
    lines.forEach(line => {
      const trimmed = line.trim().toUpperCase()
      if (!trimmed) return
      const parts = trimmed.split(',')
      const sku = parts[0].trim()
      const cantidad = parts[1] ? parseInt(parts[1].trim()) : 0
      if (sku) entradaData[sku] = cantidad
    })
    entradaSkus.value = entradaData
    localStorage.setItem('entradaSkus', JSON.stringify(entradaData))
    $q.notify({
      type: 'positive',
      message: `${Object.keys(entradaData).length} SKUs cargados para traspaso de entrada.`,
      position: 'top'
    })
  }
  reader.readAsText(file)
  event.target.value = ''
}

function clearEntradaSkus() {
  entradaSkus.value = {}
  localStorage.removeItem('entradaSkus')
  $q.notify({ type: 'info', message: 'Lista de traspaso de entrada limpiada.', position: 'top' })
}
// ─────────────────────────────────────────────────────────────

// ── Watchers ──────────────────────────────────────────────────
watch(inventory, () => { saveToStorage() }, { deep: true })

watch(fastScanMode, (val) => {
  localStorage.setItem('fastScanMode', val.toString())
})

watch(useDatabase, (val) => {
  localStorage.setItem('useDatabase', val.toString())
})
// ─────────────────────────────────────────────────────────────

// ── onMounted ─────────────────────────────────────────────────
onMounted(() => {
  loadFromStorage()
  loadHistoryFromStorage()
  const savedFastMode = localStorage.getItem('fastScanMode')
  if (savedFastMode !== null) {
    fastScanMode.value = savedFastMode === 'true'
  }
  const savedUseDatabase = localStorage.getItem('useDatabase')
  if (savedUseDatabase !== null) {
    useDatabase.value = savedUseDatabase === 'true'
  }
})
// ─────────────────────────────────────────────────────────────

// ── Lógica de escaneo ─────────────────────────────────────────
async function addItem() {
  const input = skuInput.value.trim().toUpperCase()
  if (!input) return
  loading.value = true
  try {
    const sku = input
    let isInEntrada = false
    if (Object.keys(entradaSkus.value).length > 0) {
      isInEntrada = sku in entradaSkus.value
    }

    let productName = sku
    if (useDatabase.value) {
      const descrip = await productStore.fetchProductDescription(sku)
      if (descrip === null) {
        $q.notify({
          type: 'warning',
          message: `SKU ${sku}: sin descripción en la base de datos`,
          position: 'top',
          timeout: 2000
        })
      }
      productName = descrip || sku
    }

    addProductToInventory(sku, productName, isInEntrada)
  } finally {
    loading.value = false
  }
}

function addProductToInventory(sku, productName, isInEntrada = false) {
  if (fastScanMode.value) {
    // Modo rápido: suma 1 directo sin modal
    const wasNew = !inventory[sku]
    const previousQty = inventory[sku]?.cantidad ?? 0

    if (inventory[sku]) {
      inventory[sku].cantidad += 1
    } else {
      inventory[sku] = { nombre: productName, cantidad: 1, enEntrada: isInEntrada }
    }

    lastAction.value = { sku, productName, wasNew, previousQty }
    addToHistory({ sku, productName, quantity: 1, action: wasNew ? 'add' : 'increment' })
    playBeep(true)
    vibrate(true)
    triggerFlash(true)
    skuInput.value = ''
    nextTick(() => { skuInputRef.value?.focus() })
  } else {
    // Modo normal: mostrar modal de cantidad
    tempSku.value = sku
    tempProductName.value = productName
    tempIsInEntrada.value = isInEntrada
    quantity.value = 1
    skuInput.value = ''
    showQuantityModal.value = true
  }
}

function confirmQuantity() {
  const sku = tempSku.value
  const qty = parseInt(quantity.value) || 1
  const wasNew = !inventory[sku]
  const previousQty = inventory[sku]?.cantidad ?? 0

  if (inventory[sku]) {
    inventory[sku].cantidad += qty
  } else {
    inventory[sku] = {
      nombre: tempProductName.value,
      cantidad: qty,
      enEntrada: tempIsInEntrada.value
    }
  }

  lastAction.value = { sku, productName: tempProductName.value, wasNew, previousQty }
  addToHistory({ sku, productName: tempProductName.value, quantity: qty, action: wasNew ? 'add' : 'increment' })
  playBeep(true)
  vibrate(true)
  triggerFlash(true)

  closeModal()
}

function cancelQuantity() {
  showQuantityModal.value = false
  tempSku.value = ''
  quantity.value = 1
  nextTick(() => { skuInputRef.value?.focus() })
}

function closeModal() {
  showQuantityModal.value = false
  tempSku.value = ''
  quantity.value = 1
  nextTick(() => { skuInputRef.value?.focus() })
}
// ─────────────────────────────────────────────────────────────

// ── Acciones de tabla ─────────────────────────────────────────
function incrementItem(sku) {
  if (inventory[sku]) inventory[sku].cantidad += 1
}

function decrementItem(sku) {
  if (!inventory[sku]) return
  if (inventory[sku].cantidad > 1) {
    inventory[sku].cantidad -= 1
  } else {
    removeItem(sku)
  }
}

function removeItem(sku) {
  $q.dialog({
    title: 'Eliminar Producto',
    message: `¿Estás seguro de eliminar ${inventory[sku].nombre}?`,
    cancel: true,
    ok: 'Eliminar'
  }).onOk(() => { delete inventory[sku] })
}

function startEditQuantity(sku) {
  editingSku.value = sku
}

function cancelEditQuantity() {
  editingSku.value = null
}
// ─────────────────────────────────────────────────────────────

// ── Exportar ──────────────────────────────────────────────────
function downloadTxt() {
  if (Object.keys(inventory).length === 0) {
    $q.notify({ type: 'warning', message: 'No hay productos para descargar.', position: 'top' })
    return
  }
  let content = ''
  for (const sku in inventory) content += `${sku},${inventory[sku].cantidad}\n`
  const blob = new Blob([content], { type: 'text/plain' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'colector.txt'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
  $q.notify({ type: 'positive', message: 'Archivo colector.txt descargado.', position: 'top' })
}

async function sendToServer() {
  if (Object.keys(inventory).length === 0) {
    $q.notify({ type: 'warning', message: 'No hay productos para enviar.', position: 'top' })
    return
  }
  const result = await fileStore.uploadInventoryFile(inventory, inventoryName.value)
  if (result.success) {
    $q.notify({ type: 'positive', message: 'Inventario enviado al servidor correctamente.', position: 'top' })
  } else {
    $q.notify({ type: 'negative', message: `Error al enviar: ${result.error}`, position: 'top' })
  }
}

function downloadExcel() {
  if (Object.keys(inventory).length === 0) {
    $q.notify({ type: 'warning', message: 'No hay productos para descargar.', position: 'top' })
    return
  }
  const data = []
  for (const sku in inventory) {
    data.push({ SKU: sku, Producto: inventory[sku].nombre, Cantidad: inventory[sku].cantidad })
  }
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
  const date = new Date().toISOString().split('T')[0]
  const fileName = `${inventoryName.value}_inventario_${date}.xlsx`
  XLSX.writeFile(wb, fileName)
  $q.notify({ type: 'positive', message: `Archivo ${fileName} descargado.`, position: 'top' })
}
// ─────────────────────────────────────────────────────────────

// ── Navegación ────────────────────────────────────────────────
function goHome() {
  router.push('/')
}

function goToReports() {
  router.push(`/reports/${encodeURIComponent(inventoryName.value)}`)
}

function toggleDarkMode() {
  $q.dark.toggle()
}

function handleCodeScanned(code) {
  skuInput.value = code
  addItem()
}
// ─────────────────────────────────────────────────────────────
</script>

<template>
  <!-- Flash visual al escanear -->
  <div
    v-if="scanFlash"
    :class="['scan-flash', scanFlash === 'success' ? 'scan-flash--success' : 'scan-flash--error']"
  />

  <div class="scanner-view">
    <header>
      <div class="header-content">
        <q-btn flat icon="arrow_back" @click="goHome" class="back-btn" />
        <h1>{{ inventoryName }}</h1>
        <q-btn
          flat
          :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
          @click="toggleDarkMode"
          class="dark-mode-btn"
        />
      </div>
    </header>

    <main>
      <!-- Sección de Escaneo -->
      <section class="scanner-section">
        <div class="scanner-header">
          <h4>Escanear SKU</h4>
          <div class="scanner-toggles">
            <!-- Toggle modo rápido -->
            <div class="fast-mode-toggle">
              <q-toggle v-model="fastScanMode" color="positive" dense />
              <span class="fast-mode-label" :class="{ 'fast-mode-label--active': fastScanMode }">
                Modo rápido
              </span>
              <q-icon name="help_outline" size="16px" color="grey-6" class="q-ml-xs">
                <q-tooltip max-width="200px">
                  Suma 1 automáticamente al escanear, sin pedir cantidad
                </q-tooltip>
              </q-icon>
            </div>
            <!-- Toggle base de datos -->
            <div class="fast-mode-toggle">
              <q-toggle v-model="useDatabase" color="info" dense />
              <span class="fast-mode-label" :class="{ 'fast-mode-label--active': useDatabase }">
                Base de datos
              </span>
              <q-icon name="help_outline" size="16px" color="grey-6" class="q-ml-xs">
                <q-tooltip max-width="200px">
                  Consulta el nombre del producto al servidor al escanear
                </q-tooltip>
              </q-icon>
            </div>
          </div>
        </div>

        <div class="scanner-container">
          <q-input
            ref="skuInputRef"
            v-model="skuInput"
            filled
            label="Apunte y escanee..."
            @keyup.enter="addItem"
            autofocus
            class="sku-input"
            :disable="loading"
          >
            <template v-slot:prepend>
              <q-btn
                flat round dense icon="photo_camera"
                @click="showCameraModal = true"
                class="camera-btn"
                :disable="loading"
              />
            </template>
            <template v-slot:append>
              <q-spinner-dots v-if="loading" color="primary" size="24px" />
              <q-icon v-else name="qr_code_scanner" />
            </template>
          </q-input>
          <q-btn color="primary" label="OK" @click="addItem" class="scan-btn" :loading="loading" />
        </div>

        <!-- Botón Deshacer último escaneo -->
        <transition name="undo-slide">
          <div v-if="lastAction" class="undo-bar">
            <q-btn
              color="warning"
              text-color="dark"
              icon="undo"
              :label="`Deshacer: ${lastAction.productName}`"
              @click="undoLastScan"
              unelevated
              no-caps
              class="undo-btn"
              size="sm"
            />
          </div>
        </transition>
      </section>

      <!-- Resumen de Inventario -->
      <section class="summary-section" v-if="Object.keys(inventory).length > 0">
        <div class="summary-card">
          <div class="summary-item">
            <span class="summary-label">Total Productos</span>
            <span class="summary-value">{{ Object.keys(inventory).length }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Total Piezas</span>
            <span class="summary-value total-piezas">{{ totalPiezas }}</span>
          </div>
          <div class="summary-item">
            <q-btn
              flat dense
              icon="history"
              label="Historial"
              color="primary"
              @click="showHistoryModal = true"
              size="sm"
              no-caps
            />
          </div>
        </div>
      </section>

      <!-- Indicador de Traspaso de Entrada -->
      <div class="entrada-section">
        <div v-if="Object.keys(entradaSkus).length > 0" class="entrada-indicator">
          <q-icon name="check_circle" color="positive" />
          <span>Traspaso de entrada activo ({{ Object.keys(entradaSkus).length }} items)</span>
          <q-btn flat dense icon="close" size="sm" @click="clearEntradaSkus" color="negative" />
        </div>
        <q-btn
          v-else
          outline color="primary" icon="upload_file"
          label="Cargar traspaso de entrada"
          @click="triggerFileInput" size="sm"
        />
        <input ref="fileInputRef" type="file" accept=".txt" style="display: none" @change="handleFileUpload" />
      </div>

      <!-- Búsqueda -->
      <section class="search-section" v-if="Object.keys(inventory).length > 0">
        <q-input v-model="searchQuery" filled placeholder="Buscar por SKU o nombre..." dense>
          <template v-slot:prepend><q-icon name="search" /></template>
          <template v-slot:append>
            <q-icon v-if="searchQuery" name="close" class="cursor-pointer" @click="searchQuery = ''" />
          </template>
        </q-input>
      </section>

      <!-- Sección de Inventario -->
      <section class="inventory-section">
        <div class="section-header">
          <h2>Inventario ({{ Object.keys(filteredInventory).length }} items)</h2>
          <div class="actions-container">
            <div class="download-buttons">
              <q-btn
                color="secondary" icon="download" label="TXT"
                @click="downloadTxt" size="sm"
                :disable="Object.keys(inventory).length === 0"
              />
              <q-btn
                color="primary" icon="table_view" label="Excel"
                @click="downloadExcel" size="sm"
                :disable="Object.keys(inventory).length === 0"
              />
              <q-btn
                color="positive" icon="cloud_upload" label="Enviar"
                @click="sendToServer" size="sm"
                :loading="fileStore.uploading"
                :disable="Object.keys(inventory).length === 0"
              />
            </div>
            <q-btn
              color="accent" icon="compare_arrows" label="Comparativa"
              @click="goToReports" class="comparativa-btn"
              :disable="Object.keys(inventory).length === 0"
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
                <div v-if="editingSku === sku" class="edit-quantity">
                  <q-input
                    :model-value="item.cantidad"
                    @update:model-value="val => inventory[sku].cantidad = parseInt(val) || 1"
                    type="number" min="1" dense autofocus
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

    <!-- Modal de Cantidad -->
    <q-dialog v-model="showQuantityModal" persistent @show="() => qtyInputRef?.select()">
      <q-card style="min-width: 300px">
        <q-card-section class="text-center">
          <div class="text-h6">Ingresar Cantidad</div>
          <div class="text-subtitle2 text-grey">{{ tempProductName }}</div>
          <div class="text-caption text-grey">SKU: {{ tempSku }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <div class="quantity-control">
            <q-btn round color="primary" icon="remove" @click="quantity > 1 ? quantity-- : null" size="lg" />
            <q-input
              ref="qtyInputRef"
              v-model.number="quantity"
              type="number" min="1" outlined
              input-class="text-center text-h5"
              class="qty-input"
            />
            <q-btn round color="primary" icon="add" @click="quantity++" size="lg" />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" color="grey" @click="cancelQuantity" />
          <q-btn flat label="Aceptar" color="primary" @click="confirmQuantity" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Modal de Historial -->
    <q-dialog v-model="showHistoryModal">
      <q-card style="min-width: 320px; max-width: 500px; width: 90vw">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Historial de escaneos</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section style="max-height: 60vh; overflow-y: auto; padding-top: 8px">
          <div v-if="actionHistory.length === 0" class="text-center text-grey q-pa-lg">
            <q-icon name="history" size="40px" class="q-mb-sm" />
            <div>No hay acciones registradas aún</div>
          </div>
          <q-list v-else separator>
            <q-item v-for="(entry, idx) in actionHistory" :key="idx" dense>
              <q-item-section avatar>
                <q-icon
                  :name="entry.action === 'undo' ? 'undo' : entry.action === 'add' ? 'add_circle' : 'add'"
                  :color="entry.action === 'undo' ? 'warning' : entry.action === 'add' ? 'positive' : 'primary'"
                  size="20px"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ entry.productName }}</q-item-label>
                <q-item-label caption>
                  {{ entry.sku }}
                  <span v-if="entry.action !== 'undo'"> · +{{ entry.quantity }}</span>
                  <span v-else class="text-warning"> · deshecho</span>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label caption>{{ formatHistoryTime(entry.timestamp) }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>

    <CameraScanner v-model="showCameraModal" @code-scanned="handleCodeScanned" />

    <footer>
      <p>Colector v1.0 - Mobile Ready</p>
    </footer>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }

/* ── Flash visual ─────────────────────────────────────────── */
.scan-flash {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  animation: flash-fade 0.3s ease-out forwards;
}
.scan-flash--success { background: rgba(33, 186, 69, 0.35); }
.scan-flash--error   { background: rgba(193, 0, 21, 0.35); }

@keyframes flash-fade {
  0%   { opacity: 1; }
  100% { opacity: 0; }
}
/* ─────────────────────────────────────────────────────────── */

/* ── Deshacer ─────────────────────────────────────────────── */
.undo-bar {
  margin-top: 8px;
}
.undo-btn {
  width: 100%;
  border-radius: 6px;
}

/* Transición de entrada/salida del botón deshacer */
.undo-slide-enter-active,
.undo-slide-leave-active {
  transition: all 0.25s ease;
}
.undo-slide-enter-from,
.undo-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
/* ─────────────────────────────────────────────────────────── */

/* ── Modo rápido ──────────────────────────────────────────── */
.scanner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 6px;
}

.scanner-toggles {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.fast-mode-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
}

.fast-mode-label {
  font-size: 0.8rem;
  color: #666;
  transition: color 0.2s;
}
.fast-mode-label--active {
  color: #21BA45;
  font-weight: 600;
}

body.body--dark .fast-mode-label { color: #aaa; }
body.body--dark .fast-mode-label--active { color: #66bb6a; }
/* ─────────────────────────────────────────────────────────── */

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  margin: 0;
  padding: 0;
  background-color: #f0f2f5;
  -webkit-font-smoothing: antialiased;
}

body.body--dark { background-color: #121212; }

.scanner-view {
  padding-bottom: 60px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  background-color: #1976D2;
  color: white;
  padding: 0;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: none;
  line-height: 1;
}

body.body--dark header { background-color: #0d47a1; }

.header-content {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  position: relative;
}

.back-btn { color: white; }

header h1 {
  margin: 0;
  font-size: 1.2rem;
  flex: 1;
  text-align: center;
}

.dark-mode-btn {
  position: absolute;
  right: 10px;
  color: white;
}

main {
  flex: 1;
  padding: 15px;
}

.scanner-section { margin-bottom: 20px; }

.scanner-section h4 {
  font-size: 0.9rem;
  color: #1976D2;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
}

body.body--dark .scanner-section h4 { color: #64b5f6; }

.scanner-container {
  display: flex;
  gap: 10px;
  background: white;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

body.body--dark .scanner-container { background: #1e1e1e; }

.sku-input { flex: 1; }

.scan-btn {
  height: 56px;
  font-weight: bold;
}

.summary-section { margin-bottom: 15px; }

.summary-card {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: white;
  padding: 12px 15px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

body.body--dark .summary-card { background: #1e1e1e; }

.summary-item { text-align: center; }

.summary-label {
  display: block;
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 4px;
}

body.body--dark .summary-label { color: #aaa; }

.summary-value {
  font-size: 1.2rem;
  font-weight: bold;
  color: #1976D2;
}

body.body--dark .summary-value { color: #64b5f6; }

.total-piezas {
  color: #28a745;
  font-size: 1.4rem;
}

.entrada-section { margin-bottom: 15px; }

.entrada-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #e8f5e9;
  color: #2e7d32;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.9rem;
}

.search-section { margin-bottom: 15px; }

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 10px;
}

.actions-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.download-buttons {
  display: flex;
  gap: 5px;
}

.comparativa-btn { font-weight: bold; }

.inventory-section h2 {
  font-size: 1rem;
  margin: 0;
  color: #555;
}

body.body--dark .inventory-section h2 { color: #aaa; }

.product-info {
  display: flex;
  flex-direction: column;
}

.sku-code {
  font-size: 0.8rem;
  color: #888;
  font-weight: bold;
}

body.body--dark .sku-code { color: #777; }

.product-name {
  font-size: 1rem;
  color: #333;
  margin-top: 2px;
}

body.body--dark .product-name { color: #e0e0e0; }

.quantity-badge {
  font-size: 1.1rem;
  padding: 5px 15px;
  cursor: pointer;
}

.quantity-display { cursor: pointer; }

.edit-quantity {
  display: flex;
  justify-content: center;
}

.edit-input { width: 60px; }

.quantity-control {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin: 20px 0;
}

.qty-input { width: 80px; }

.camera-btn { color: #1976D2; }

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

body.body--dark footer { background-color: #1e1e1e; }

/* Tabla en modo oscuro */
body.body--dark .q-markup-table { background: #1e1e1e; color: #e0e0e0; }
body.body--dark .q-markup-table thead tr th { color: #e0e0e0; }
body.body--dark .q-markup-table tbody tr td { color: #e0e0e0; }
body.body--dark .q-markup-table tbody tr:nth-child(even) { background: #2a2a2a; }
body.body--dark .q-markup-table tbody tr:hover { background: #333; }

/* Quasar en modo oscuro */
body.body--dark .q-input--filled { background-color: #2a2a2a; }
body.body--dark .q-field__label { color: #aaa; }
body.body--dark .q-field__control { color: #e0e0e0; }
body.body--dark .q-field__input { color: #e0e0e0; }
body.body--dark .q-btn { color: #e0e0e0; }
body.body--dark .q-card { background-color: #1e1e1e; color: #e0e0e0; }
body.body--dark .q-dialog__title { color: #e0e0e0; }
body.body--dark .q-dialog__message { color: #aaa; }
body.body--dark .text-grey { color: #aaa !important; }
body.body--dark .q-badge { background-color: #1976D2; }
</style>

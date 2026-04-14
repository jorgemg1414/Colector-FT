<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()

const inventoryName = computed(() => route.params.name)
const inventory = ref({})
const entradaSkus = ref({})
const comparisonReport = ref({
  found: [],
  notFound: [],
  extra: []
})

// Cargar inventario desde localStorage
onMounted(() => {
  loadInventory()
  loadEntradaSkus()
  generateComparisonReport()
})

function loadInventory() {
  const savedData = localStorage.getItem('colectorData')
  if (savedData) {
    try {
      const data = JSON.parse(savedData)
      
      if (data.inventories && data.inventories[inventoryName.value]) {
        inventory.value = data.inventories[inventoryName.value].inventory
      }
    } catch (e) {
      console.error('Error loading inventory:', e)
    }
  }
}

function loadEntradaSkus() {
  const savedEntrada = localStorage.getItem('entradaSkus')
  if (savedEntrada) {
    try {
      entradaSkus.value = JSON.parse(savedEntrada)
    } catch (e) {
      console.error('Error loading entrada SKUs:', e)
    }
  }
}

function generateComparisonReport() {
  const scannedSkus = Object.keys(inventory.value)
  const entrada = entradaSkus.value
  
  // SKUs del traspaso que fueron encontrados
  const found = Object.keys(entrada)
    .filter(sku => scannedSkus.includes(sku))
    .map(sku => ({
      sku,
      nombre: inventory.value[sku]?.nombre || 'Sin nombre',
      cantidadEsperada: entrada[sku] || 0,
      cantidadEscaneada: inventory.value[sku]?.cantidad || 0,
      diferencia: (entrada[sku] || 0) - (inventory.value[sku]?.cantidad || 0)
    }))
  
  // SKUs del traspaso que NO fueron encontrados
  const notFound = Object.keys(entrada).filter(sku => !scannedSkus.includes(sku))
    .map(sku => ({
      sku,
      cantidadEsperada: entrada[sku] || 0
    }))
  
  // SKUs escaneados que no están en el traspaso
  const extra = scannedSkus.filter(sku => !entrada[sku])
    .map(sku => ({
      sku,
      nombre: inventory.value[sku]?.nombre || 'Sin nombre',
      cantidadEscaneada: inventory.value[sku]?.cantidad || 0
    }))
  
  comparisonReport.value = { found, notFound, extra }
}

function goBack() {
  router.push(`/sku/${encodeURIComponent(inventoryName.value)}`)
}
</script>

<template>
  <div class="reports-view">
    <header>
      <div class="header-content">
        <q-btn flat icon="arrow_back" @click="goBack" class="back-btn" />
        <h1>Comparativa - {{ inventoryName }}</h1>
      </div>
    </header>
    
    <main>
      <!-- Sin traspaso cargado -->
      <div v-if="Object.keys(entradaSkus).length === 0" class="no-traspaso">
        <q-icon name="upload_file" size="56px" color="grey-5" />
        <p>No hay Traspaso de Entrada cargado</p>
        <p class="no-traspaso-hint">Vuelve al inventario y carga un archivo de traspaso para ver la comparativa</p>
        <q-btn outline color="primary" label="Volver al inventario" icon="arrow_back" @click="goBack" />
      </div>

      <!-- Comparación con Traspaso de Entrada -->
      <section v-if="Object.keys(entradaSkus).length > 0" class="comparison-section">
        <h2>Comparación con Traspaso de Entrada</h2>
        
        <!-- Resumen de comparación -->
        <div class="comparison-summary">
          <div class="summary-item found">
            <q-icon name="check_circle" size="32px" color="positive" />
            <div class="summary-text">
              <span class="summary-value">{{ comparisonReport.found.length }}</span>
              <span class="summary-label">Encontrados</span>
            </div>
          </div>
          <div class="summary-item not-found">
            <q-icon name="highlight_off" size="32px" color="negative" />
            <div class="summary-text">
              <span class="summary-value">{{ comparisonReport.notFound.length }}</span>
              <span class="summary-label">No encontrados</span>
            </div>
          </div>
          <div class="summary-item extra">
            <q-icon name="add_circle" size="32px" color="warning" />
            <div class="summary-text">
              <span class="summary-value">{{ comparisonReport.extra.length }}</span>
              <span class="summary-label">Extras</span>
            </div>
          </div>
        </div>

        <!-- SKUs del traspaso encontrados -->
        <div v-if="comparisonReport.found.length > 0" class="comparison-part">
          <h3>Encontrados ({{ comparisonReport.found.length }})</h3>
          <q-markup-table flat bordered dense>
            <thead>
              <tr>
                <th class="text-left">SKU</th>
                <th class="text-left">Producto</th>
                <th class="text-center">Esperada</th>
                <th class="text-center">Escaneada</th>
                <th class="text-center">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in comparisonReport.found" :key="item.sku">
                <td class="text-left">{{ item.sku }}</td>
                <td class="text-left">{{ item.nombre }}</td>
                <td class="text-center">
                  <q-badge color="grey">{{ item.cantidadEsperada }}</q-badge>
                </td>
                <td class="text-center">
                  <q-badge color="positive">{{ item.cantidadEscaneada }}</q-badge>
                </td>
                <td class="text-center">
                  <q-badge :color="item.diferencia === 0 ? 'positive' : item.diferencia > 0 ? 'negative' : 'warning'">
                    {{ item.diferencia > 0 ? '-' : '+' }}{{ Math.abs(item.diferencia) }}
                  </q-badge>
                </td>
              </tr>
            </tbody>
          </q-markup-table>
        </div>

        <!-- SKUs del traspaso NO encontrados -->
        <div v-if="comparisonReport.notFound.length > 0" class="comparison-part">
          <h3>No Encontrados ({{ comparisonReport.notFound.length }})</h3>
          <q-markup-table flat bordered dense>
            <thead>
              <tr>
                <th class="text-left">SKU</th>
                <th class="text-center">Cant. Esperada</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in comparisonReport.notFound" :key="item.sku">
                <td class="text-left">{{ item.sku }}</td>
                <td class="text-center">
                  <q-badge color="negative">{{ item.cantidadEsperada }}</q-badge>
                </td>
              </tr>
            </tbody>
          </q-markup-table>
        </div>

        <!-- SKUs extras (escaneados pero no en traspaso) -->
        <div v-if="comparisonReport.extra.length > 0" class="comparison-part">
          <h3>Extras - No están en Traslado ({{ comparisonReport.extra.length }})</h3>
          <q-markup-table flat bordered dense>
            <thead>
              <tr>
                <th class="text-left">SKU</th>
                <th class="text-left">Producto</th>
                <th class="text-center">Cant. Escaneada</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in comparisonReport.extra" :key="item.sku">
                <td class="text-left">{{ item.sku }}</td>
                <td class="text-left">{{ item.nombre }}</td>
                <td class="text-center">
                  <q-badge color="warning">{{ item.cantidadEscaneada }}</q-badge>
                </td>
              </tr>
            </tbody>
          </q-markup-table>
        </div>

      </section>
    </main>
  </div>
</template>

<style scoped>
.reports-view {
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

body.body--dark header {
  background-color: #0d47a1;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  position: relative;
}

.back-btn {
  color: white;
}

header h1 {
  margin: 0;
  font-size: 1.2rem;
  flex: 1;
  text-align: center;
}

main {
  flex: 1;
  padding: 15px;
}

.comparison-section {
  margin-bottom: 20px;
}

.comparison-section h2 {
  font-size: 1.1rem;
  margin-bottom: 15px;
  color: #1976D2;
}

body.body--dark .comparison-section h2 {
  color: #64b5f6;
}

.comparison-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.summary-item {
  background: white;
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 12px;
}

body.body--dark .summary-item {
  background: #1e1e1e;
}

.summary-text {
  display: flex;
  flex-direction: column;
}

.summary-text .summary-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
}

body.body--dark .summary-text .summary-value {
  color: #e0e0e0;
}

.summary-text .summary-label {
  font-size: 0.8rem;
  color: #666;
}

body.body--dark .summary-text .summary-label {
  color: #aaaaaa;
}

.summary-item.found .summary-value {
  color: #2e7d32;
}

.summary-item.not-found .summary-value {
  color: #c62828;
}

.summary-item.extra .summary-value {
  color: #f57c00;
}

.comparison-part {
  margin-bottom: 20px;
}

.comparison-part h3 {
  font-size: 0.95rem;
  margin-bottom: 10px;
  color: #555;
  margin-top: 15px;
}

body.body--dark .comparison-part h3 {
  color: #aaaaaa;
}

.no-traspaso {
  text-align: center;
  padding: 50px 20px;
  color: #999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

body.body--dark .no-traspaso {
  color: #777;
}

.no-traspaso p {
  margin: 0;
}

.no-traspaso-hint {
  font-size: 0.85rem;
  color: #bbb;
  max-width: 280px;
  line-height: 1.4;
}
</style>

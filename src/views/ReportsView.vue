<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()

const inventoryName = computed(() => route.params.name)
const inventory = ref({})
const totalProducts = ref(0)
const totalPieces = ref(0)
const mostScannedProducts = ref([])
const leastScannedProducts = ref([])
const productsByCategory = ref([])

// Cargar inventario desde localStorage
onMounted(() => {
  loadInventory()
})

function loadInventory() {
  const savedData = localStorage.getItem('colectorData')
  if (savedData) {
    try {
      const data = JSON.parse(savedData)
      
      if (data.inventories && data.inventories[inventoryName.value]) {
        inventory.value = data.inventories[inventoryName.value].inventory
        
        // Calcular totales
        totalProducts.value = Object.keys(inventory.value).length
        totalPieces.value = Object.values(inventory.value).reduce((sum, item) => sum + item.cantidad, 0)
        
        // Ordenar productos por cantidad (más escaneados primero)
        const sortedProducts = Object.entries(inventory.value)
          .map(([sku, item]) => ({ sku, ...item }))
          .sort((a, b) => b.cantidad - a.cantidad)
        
        mostScannedProducts.value = sortedProducts.slice(0, 10)
        leastScannedProducts.value = sortedProducts.slice(-10).reverse()
      }
    } catch (e) {
      console.error('Error loading inventory:', e)
    }
  }
}

function goBack() {
  router.push(`/sku/${encodeURIComponent(inventoryName.value)}`)
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
</script>

<template>
  <div class="reports-view">
    <header>
      <div class="header-content">
        <q-btn flat icon="arrow_back" @click="goBack" class="back-btn" />
        <h1>Reportes - {{ inventoryName }}</h1>
      </div>
    </header>
    
    <main>
      <!-- Estadísticas generales -->
      <section class="stats-section">
        <h2>Estadísticas Generales</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <q-icon name="inventory" size="48px" color="primary" />
            <div class="stat-info">
              <span class="stat-value">{{ totalProducts }}</span>
              <span class="stat-label">Productos únicos</span>
            </div>
          </div>
          
          <div class="stat-card">
            <q-icon name="shopping_cart" size="48px" color="secondary" />
            <div class="stat-info">
              <span class="stat-value">{{ totalPieces }}</span>
              <span class="stat-label">Total piezas</span>
            </div>
          </div>
          
          <div class="stat-card">
            <q-icon name="trending_up" size="48px" color="positive" />
            <div class="stat-info">
              <span class="stat-value">{{ mostScannedProducts[0]?.cantidad || 0 }}</span>
              <span class="stat-label">Más escaneado</span>
            </div>
          </div>
          
          <div class="stat-card">
            <q-icon name="trending_down" size="48px" color="negative" />
            <div class="stat-info">
              <span class="stat-value">{{ leastScannedProducts[0]?.cantidad || 0 }}</span>
              <span class="stat-label">Menos escaneado</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Productos más escaneados -->
      <section class="top-products-section">
        <h2>Productos más escaneados</h2>
        <q-markup-table flat bordered>
          <thead>
            <tr>
              <th class="text-left">Posición</th>
              <th class="text-left">SKU</th>
              <th class="text-left">Producto</th>
              <th class="text-center">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in mostScannedProducts" :key="item.sku">
              <td class="text-center">
                <q-badge :color="index === 0 ? 'yellow' : index === 1 ? 'grey' : index === 2 ? 'orange' : 'primary'">
                  {{ index + 1 }}
                </q-badge>
              </td>
              <td class="text-left">{{ item.sku }}</td>
              <td class="text-left">{{ item.nombre }}</td>
              <td class="text-center">
                <q-badge color="primary" :label="item.cantidad" />
              </td>
            </tr>
            <tr v-if="mostScannedProducts.length === 0">
              <td colspan="4" class="text-center text-grey">
                No hay productos en el inventario
              </td>
            </tr>
          </tbody>
        </q-markup-table>
      </section>

      <!-- Productos menos escaneados -->
      <section class="bottom-products-section">
        <h2>Productos menos escaneados</h2>
        <q-markup-table flat bordered>
          <thead>
            <tr>
              <th class="text-left">Posición</th>
              <th class="text-left">SKU</th>
              <th class="text-left">Producto</th>
              <th class="text-center">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in leastScannedProducts" :key="item.sku">
              <td class="text-center">{{ index + 1 }}</td>
              <td class="text-left">{{ item.sku }}</td>
              <td class="text-left">{{ item.nombre }}</td>
              <td class="text-center">
                <q-badge color="negative" :label="item.cantidad" />
              </td>
            </tr>
            <tr v-if="leastScannedProducts.length === 0">
              <td colspan="4" class="text-center text-grey">
                No hay productos en el inventario
              </td>
            </tr>
          </tbody>
        </q-markup-table>
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

.stats-section {
  margin-bottom: 20px;
}

.stats-section h2 {
  font-size: 1.1rem;
  margin-bottom: 15px;
  color: #1976D2;
}

body.body--dark .stats-section h2 {
  color: #64b5f6;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.stat-card {
  background: white;
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 15px;
}

body.body--dark .stat-card {
  background: #1e1e1e;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
}

body.body--dark .stat-value {
  color: #e0e0e0;
}

.stat-label {
  font-size: 0.8rem;
  color: #666;
}

body.body--dark .stat-label {
  color: #aaaaaa;
}

.top-products-section, .bottom-products-section {
  margin-bottom: 20px;
}

.top-products-section h2, .bottom-products-section h2 {
  font-size: 1rem;
  margin-bottom: 10px;
  color: #555;
}

body.body--dark .top-products-section h2,
body.body--dark .bottom-products-section h2 {
  color: #aaaaaa;
}
</style>

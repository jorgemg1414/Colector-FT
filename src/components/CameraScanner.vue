<script setup>
import { ref, watch, onUnmounted, nextTick } from 'vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'code-scanned'])

const showCameraModal = ref(props.modelValue)
const videoRef = ref(null)
const canvasRef = ref(null)
const capturedImage = ref(null)
const detectedCode = ref('')
const isProcessing = ref(false)
const stream = ref(null)
const lastDetectedCode = ref('')

watch(() => props.modelValue, (val) => {
  showCameraModal.value = val
  if (val) {
    resetState()
    startCamera()
  }
})

watch(showCameraModal, (val) => {
  emit('update:modelValue', val)
  if (!val) {
    stopCamera()
  }
})

function resetState() {
  capturedImage.value = null
  detectedCode.value = ''
  lastDetectedCode.value = ''
}

async function startCamera() {
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    })
    
    await nextTick()
    
    if (videoRef.value) {
      videoRef.value.srcObject = stream.value
      videoRef.value.play()
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Error al acceder a la cámara',
      position: 'top'
    })
    closeModal()
  }
}

async function capturePhoto() {
  if (isProcessing.value || !videoRef.value || !canvasRef.value) return
  
  isProcessing.value = true
  
  const video = videoRef.value
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  
  if (video.readyState !== video.HAVE_ENOUGH_DATA) {
    isProcessing.value = false
    return
  }
  
  const videoW = video.videoWidth
  const videoH = video.videoHeight
  
  const scanAreaW = 280
  const scanAreaH = 100
  
  const scaleX = videoW / video.clientWidth
  const scaleY = videoH / video.clientHeight
  
  const cropW = scanAreaW * scaleX
  const cropH = scanAreaH * scaleY
  const cropX = (videoW - cropW) / 2
  const cropY = (videoH - cropH) / 2
  
  canvas.width = cropW
  canvas.height = cropH
  
  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
  
  capturedImage.value = canvas.toDataURL('image/jpeg', 0.8)
  
  try {
    const code = await detectBarcode(canvas)
    if (code) {
      detectedCode.value = code.toUpperCase()
      lastDetectedCode.value = code.toUpperCase()
    } else {
      $q.notify({
        type: 'warning',
        message: 'No se detectó código. Intente de nuevo.',
        position: 'top'
      })
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Error al detectar código',
      position: 'top'
    })
  }
  
  isProcessing.value = false
}

async function detectBarcode(canvas) {
  if (!('BarcodeDetector' in window)) {
    $q.notify({
      type: 'warning',
      message: 'BarcodeDetector no disponible en este navegador',
      position: 'top'
    })
    return null
  }
  
  const detector = new BarcodeDetector({
    formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code']
  })
  
  try {
    const barcodes = await detector.detect(canvas)
    if (barcodes.length > 0) {
      return barcodes[0].rawValue
    }
  } catch (err) {
    console.error('BarcodeDetector error:', err)
  }
  
  return null
}

function confirmCode() {
  if (detectedCode.value) {
    emit('code-scanned', detectedCode.value)
    closeModal()
  }
}

function retakePhoto() {
  capturedImage.value = null
  detectedCode.value = ''
}

async function stopCamera() {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop())
    stream.value = null
  }
}

function closeModal() {
  stopCamera()
  showCameraModal.value = false
  emit('update:modelValue', false)
}

onUnmounted(() => {
  stopCamera()
})
</script>

<template>
  <q-dialog v-model="showCameraModal" persistent>
    <q-card style="min-width: 350px; max-width: 90vw">
      <q-card-section class="text-center q-pb-none">
        <div class="text-h6">Escanear Código</div>
        <div class="text-caption text-grey">Apunte al código y capture</div>
      </q-card-section>

      <q-card-section class="q-pa-sm">
        <div class="camera-wrapper">
          <video 
            v-show="!capturedImage"
            ref="videoRef"
            class="camera-video"
            playsinline
            muted
          />
          <img 
            v-if="capturedImage" 
            :src="capturedImage" 
            class="captured-image"
          />
          <canvas ref="canvasRef" class="camera-canvas" />
          
          <div v-if="!capturedImage" class="scan-overlay">
            <div class="scan-area"></div>
          </div>
        </div>
      </q-card-section>

      <q-card-section v-if="detectedCode" class="q-py-sm">
        <div class="detected-box">
          <div class="detected-label">Código detectado</div>
          <div class="detected-value">{{ detectedCode }}</div>
        </div>
      </q-card-section>

      <q-card-actions vertical class="q-px-md q-pb-sm">
        <q-btn
          v-if="!detectedCode"
          color="primary"
          icon="photo_camera"
          label="Capturar"
          size="lg"
          :loading="isProcessing"
          @click="capturePhoto"
          class="full-width action-btn"
        />
        <q-btn
          v-else
          color="positive"
          icon="check"
          :label="detectedCode"
          size="lg"
          @click="confirmCode"
          class="full-width action-btn"
        />
      </q-card-actions>

      <q-card-actions class="q-px-md q-pb-md" :class="{ 'justify-between': capturedImage }">
        <q-btn
          v-if="capturedImage"
          flat
          color="primary"
          icon="refresh"
          label="Nueva captura"
          @click="retakePhoto"
        />
        <q-btn
          flat
          color="grey"
          label="Cancelar"
          @click="closeModal"
          :class="{ 'ml-auto': !capturedImage }"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.camera-wrapper {
  position: relative;
  width: 100%;
  height: 250px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.camera-video,
.captured-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.captured-image {
  object-fit: contain;
}

.camera-canvas {
  display: none;
}

.scan-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.scan-area {
  width: 280px;
  height: 100px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
}

.detected-box {
  background: #e8f5e9;
  border: 2px solid #4caf50;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

.detected-label {
  font-size: 0.75rem;
  color: #2e7d32;
  margin-bottom: 4px;
}

.detected-value {
  font-size: 1.4rem;
  font-weight: bold;
  color: #1b5e20;
  font-family: monospace;
}

.action-btn {
  font-weight: 600;
}
</style>

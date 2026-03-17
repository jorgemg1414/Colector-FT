import { defineStore } from 'pinia'
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://10.20.0.85:3000'
})

export const useFileStore = defineStore('file', {
  state: () => ({
    uploading: false
  }),
  actions: {
    async uploadInventoryFile(inventory, inventoryName) {
      this.uploading = true
      try {
        // Crear contenido del archivo TXT
        let content = ''
        for (const sku in inventory) {
          content += `${sku},${inventory[sku].cantidad}\n`
        }

        // Crear Blob y File
        const blob = new Blob([content], { type: 'text/plain' })
        const file = new File([blob], `${inventoryName}.txt`, { type: 'text/plain' })

        // Crear FormData
        const formData = new FormData()
        formData.append('file', file)

        // Enviar al servidor
        const response = await api.post('/api/file/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'x-file-name': inventoryName
          }
        })

        return { success: true, data: response.data }
      } catch (error) {
        console.error('Error uploading file:', error)
        return { success: false, error: error.message }
      } finally {
        this.uploading = false
      }
    }
  }
})

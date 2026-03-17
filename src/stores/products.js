import { defineStore } from 'pinia'
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://10.20.0.85:3000'
})

export const useProductStore = defineStore('products', {
  state: () => ({
    productDescriptions: {}
  }),
  actions: {
    async fetchProductDescription(sku) {
      try {
        const response = await api.get(`/api/product/${sku}`)
        console.log(response)
        if (response.data && response.data.DESCRIP) {
          this.productDescriptions[sku] = response.data.DESCRIP
          return response.data.DESCRIP
        }
        return null
      } catch (error) {
        console.error(`Error fetching product ${sku}:`, error)
        return null
      }
    },
    getDescription(sku) {
      return this.productDescriptions[sku] || null
    }
  }
})

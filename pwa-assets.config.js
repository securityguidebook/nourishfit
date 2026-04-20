import { defineConfig, minimalPreset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimalPreset,
    apple: {
      sizes: [180],
      resizeOptions: { background: '#0a0a0f' },
    },
  },
  images: ['public/logo.svg'],
})

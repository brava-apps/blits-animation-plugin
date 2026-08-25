/// <reference types="vite/client" />

import { defineConfig } from 'vite'
import blitsVitePlugins from '@lightningjs/blits/vite'

export default defineConfig({
  base: './',
  plugins: [...blitsVitePlugins],
  resolve: {
    dedupe: ['@lightningjs/blits'],
    mainFields: ['browser', 'module', 'jsnext:main', 'jsnext'],
  },
  worker: {
    format: 'es',
  },
})

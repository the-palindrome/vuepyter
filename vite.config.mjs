import path from 'node:path'
export default {
  resolve: {
    alias: {
      vue: path.resolve(__dirname, 'vuepyter/node_modules/vue/dist/vue.esm-browser.js'),
    },
    dedupe: ['vue'],
  },
  server: {
    fs: {
      allow: [__dirname],
    },
  },
}

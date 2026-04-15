import { createApp } from 'vue'
import App from './App.vue'
import { installPyodideStub } from './pyodide-stub'

installPyodideStub()

createApp(App).mount('#app')

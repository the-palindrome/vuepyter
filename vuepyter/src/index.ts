import type { App } from 'vue'
import CodeEditor from './components/CodeEditor.vue'
import Vuepyter from './components/Vuepyter.vue'

export { Vuepyter, CodeEditor }

export {
  useVuepyterWorkspace,
  useVuepyterPyodide,
  useVuepyterStatus,
  VUEPYTER_PYODIDE,
  VUEPYTER_WORKSPACE,
  VUEPYTER_STATUS,
} from './composables/useVuepyterProvide'

export { usePyodideKernel } from './composables/usePyodideKernel'
export { useNotebookModel } from './composables/useNotebookModel'
export { useKeyboard } from './composables/useKeyboard'

export type {
  CellOutput,
  CodeEditorProps,
  KeymapConfig,
  NotebookCell,
  NotebookDocument,
  SerializedNotebookDocument,
  PyodideInterface,
  VuepyterLoadingOverlay,
  VuepyterLoadingPhase,
  VuepyterLoadingSlotProps,
  VuepyterModelValue,
  VuepyterProps,
} from './types'

export default {
  install(app: App) {
    app.component('Vuepyter', Vuepyter)
  },
}

import type { App } from 'vue'
import CodeEditor from './components/CodeEditor.vue'
import Vuepyter from './components/Vuepyter.vue'

/**
 * Primary component exports.
 */
export { Vuepyter, CodeEditor }

/**
 * Injection keys and read composables for nested integrations.
 */
export {
  useVuepyterWorkspace,
  useVuepyterPyodide,
  useVuepyterStatus,
  VUEPYTER_PYODIDE,
  VUEPYTER_WORKSPACE,
  VUEPYTER_STATUS,
} from './composables/useVuepyterProvide'

/**
 * Headless composables that power the component internals.
 */
export { usePyodideKernel } from './composables/usePyodideKernel'
export { useNotebookModel } from './composables/useNotebookModel'
export { useKeyboard } from './composables/useKeyboard'

/**
 * Public TypeScript API.
 */
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

/**
 * Default plugin export for global component registration.
 */
export default {
  install(app: App) {
    app.component('Vuepyter', Vuepyter)
  },
}

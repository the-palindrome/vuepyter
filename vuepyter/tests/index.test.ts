import { describe, expect, it, vi } from 'vitest'
import plugin, {
  CodeEditor,
  VUEPYTER_PYODIDE,
  VUEPYTER_STATUS,
  VUEPYTER_WORKSPACE,
  Vuepyter,
  useKeyboard,
  useNotebookModel,
  usePyodideKernel,
  useVuepyterPyodide,
  useVuepyterStatus,
  useVuepyterWorkspace,
} from '@/index'

describe('package entrypoint', () => {
  it('exports the public Vuepyter surface and installs the component', () => {
    const app = {
      component: vi.fn(),
    }

    plugin.install(app as never)

    expect(app.component).toHaveBeenCalledWith('Vuepyter', Vuepyter)
    expect(CodeEditor).toBeTruthy()
    expect(useKeyboard).toBeTypeOf('function')
    expect(useNotebookModel).toBeTypeOf('function')
    expect(usePyodideKernel).toBeTypeOf('function')
    expect(useVuepyterPyodide).toBeTypeOf('function')
    expect(useVuepyterWorkspace).toBeTypeOf('function')
    expect(useVuepyterStatus).toBeTypeOf('function')
    expect(VUEPYTER_PYODIDE).toBeTypeOf('symbol')
    expect(VUEPYTER_WORKSPACE).toBeTypeOf('symbol')
    expect(VUEPYTER_STATUS).toBeTypeOf('symbol')
  })
})

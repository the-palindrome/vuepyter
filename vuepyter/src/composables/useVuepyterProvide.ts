import { inject, isRef, provide, ref, shallowRef } from 'vue'
import type { InjectionKey, Ref, ShallowRef } from 'vue'
import type { KernelStatus, PyodideInterface, UseVuepyterProvideOptions, WorkspaceState } from '@/types'

export const VUEPYTER_PYODIDE: InjectionKey<ShallowRef<PyodideInterface | null>> = Symbol(
  'VUEPYTER_PYODIDE',
)
export const VUEPYTER_WORKSPACE: InjectionKey<Ref<WorkspaceState>> = Symbol('VUEPYTER_WORKSPACE')
export const VUEPYTER_STATUS: InjectionKey<Ref<KernelStatus>> = Symbol('VUEPYTER_STATUS')

function injectOrThrow<T>(key: InjectionKey<T>, name: string): T {
  const value = inject(key, null)
  if (!value) {
    throw new Error(`${name} must be used within a Vuepyter provider`)
  }
  return value
}

export function useVuepyterProvide(options: UseVuepyterProvideOptions): void {
  const pyodideRef = isRef(options.pyodide)
    ? options.pyodide
    : shallowRef<PyodideInterface | null>(options.pyodide)
  const workspaceRef = isRef(options.workspace) ? options.workspace : ref<WorkspaceState>(options.workspace)
  const statusRef = isRef(options.status) ? options.status : ref<KernelStatus>(options.status)

  provide(VUEPYTER_PYODIDE, pyodideRef)
  provide(VUEPYTER_WORKSPACE, workspaceRef)
  provide(VUEPYTER_STATUS, statusRef)
}

export function useVuepyterPyodide(): ShallowRef<PyodideInterface | null> {
  return injectOrThrow(VUEPYTER_PYODIDE, 'useVuepyterPyodide')
}

export function useVuepyterWorkspace(): Ref<WorkspaceState> {
  return injectOrThrow(VUEPYTER_WORKSPACE, 'useVuepyterWorkspace')
}

export function useVuepyterStatus(): Ref<KernelStatus> {
  return injectOrThrow(VUEPYTER_STATUS, 'useVuepyterStatus')
}

export function createVuepyterProvideDefaults(): UseVuepyterProvideOptions {
  return {
    pyodide: shallowRef<PyodideInterface | null>(null),
    workspace: ref<WorkspaceState>({}),
    status: ref<KernelStatus>('loading'),
  }
}

export const provideVuepyterContext = useVuepyterProvide

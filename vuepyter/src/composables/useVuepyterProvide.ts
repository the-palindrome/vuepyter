import { inject, isRef, provide, ref, shallowRef } from 'vue'
import type { InjectionKey, Ref, ShallowRef } from 'vue'
import type { KernelStatus, PyodideInterface, UseVuepyterProvideOptions, WorkspaceState } from '@/types'

/**
 * Injection keys used by nested Vuepyter-aware components/composables.
 */
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

/**
 * Normalizes plain values and refs, then provides a shared reactive kernel
 * context to descendant components.
 */
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

/**
 * Injects the current pyodide instance ref from Vuepyter context.
 */
export function useVuepyterPyodide(): ShallowRef<PyodideInterface | null> {
  return injectOrThrow(VUEPYTER_PYODIDE, 'useVuepyterPyodide')
}

/**
 * Injects the reactive workspace snapshot.
 */
export function useVuepyterWorkspace(): Ref<WorkspaceState> {
  return injectOrThrow(VUEPYTER_WORKSPACE, 'useVuepyterWorkspace')
}

/**
 * Injects the reactive kernel status (`loading`/`ready`/`busy`/`error`).
 */
export function useVuepyterStatus(): Ref<KernelStatus> {
  return injectOrThrow(VUEPYTER_STATUS, 'useVuepyterStatus')
}

/**
 * Utility factory used by tests and embedding scenarios.
 */
export function createVuepyterProvideDefaults(): UseVuepyterProvideOptions {
  return {
    pyodide: shallowRef<PyodideInterface | null>(null),
    workspace: ref<WorkspaceState>({}),
    status: ref<KernelStatus>('loading'),
  }
}

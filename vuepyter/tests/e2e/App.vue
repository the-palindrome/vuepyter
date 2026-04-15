<script setup lang="ts">
import { ref } from 'vue'
import { Vuepyter, type KernelUpdateMode, type SerializedNotebookDocument } from '../../src/index'

const pyodideUrl = 'data:text/javascript,export {}'

const document = ref<SerializedNotebookDocument>({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: {
    title: 'E2E Notebook',
    trusted: true,
  },
  cells: [
    {
      id: 'cell-code-1',
      cell_type: 'code',
      source: 'print("alpha")',
      metadata: {},
      execution_count: null,
      outputs: [],
    },
    {
      id: 'cell-markdown-1',
      cell_type: 'markdown',
      source: '# Markdown cell',
      metadata: {},
    },
    {
      id: 'cell-code-2',
      cell_type: 'code',
      source: 'value = 41\nvalue + 1',
      metadata: {},
      execution_count: null,
      outputs: [],
    },
  ],
})

const kernelStatus = ref('loading')
const kernelMode = ref<KernelUpdateMode>('after-execution')
const workspace = ref<Record<string, unknown>>({})
const eventLog = ref<string[]>([])
const lastError = ref('')

const pretty = (value: unknown) => JSON.stringify(value, null, 2)

const pushEvent = (entry: string) => {
  eventLog.value = [...eventLog.value.slice(-24), entry]
}

const onReady = () => {
  kernelStatus.value = 'ready'
  pushEvent('ready')
}

const onWorkspaceSync = (payload: { workspace: Record<string, unknown>; mode: KernelUpdateMode }) => {
  workspace.value = payload.workspace
  kernelMode.value = payload.mode
  pushEvent(`workspace:${payload.mode}`)
}

const onKernelUpdateMode = (payload: { mode: KernelUpdateMode }) => {
  kernelMode.value = payload.mode
  pushEvent(`kernel-mode:${payload.mode}`)
}

const onExecute = (payload: { cellId: string; source: string }) => {
  pushEvent(`execute:${payload.cellId}:${payload.source.split('\n')[0] ?? ''}`)
}

const onComplete = (payload: { cellId: string; outputs: unknown[]; error?: Error }) => {
  pushEvent(`complete:${payload.cellId}:${payload.error ? 'error' : payload.outputs.length}`)
}

const onError = (payload: { type: string; message: string }) => {
  lastError.value = `${payload.type}: ${payload.message}`
  pushEvent(`error:${payload.type}`)
}

const onModelUpdate = (value: SerializedNotebookDocument) => {
  document.value = value
  pushEvent('model-update')
}
</script>

<template>
  <div class="harness-shell">
    <main class="notebook-stage">
      <Vuepyter
        v-model="document"
        :pyodide-url="pyodideUrl"
        :autosave-interval="false"
        :show-editor-bar="true"
        :kernel-update-mode="kernelMode"
        @ready="onReady"
        @workspace:sync="onWorkspaceSync"
        @kernel:update-mode="onKernelUpdateMode"
        @cell:execute="onExecute"
        @cell:complete="onComplete"
        @error="onError"
        @update:model-value="onModelUpdate"
      />
    </main>

    <aside class="harness-panel">
      <section>
        <h2>Notebook State</h2>
        <pre data-testid="model-json">{{ pretty(document) }}</pre>
      </section>

      <section>
        <h2>Kernel</h2>
        <div data-testid="kernel-status">{{ kernelStatus }}</div>
        <div data-testid="kernel-mode">{{ kernelMode }}</div>
        <pre data-testid="workspace-json">{{ pretty(workspace) }}</pre>
      </section>

      <section>
        <h2>Events</h2>
        <pre data-testid="event-log">{{ eventLog.join('\n') }}</pre>
        <div data-testid="last-error">{{ lastError }}</div>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.harness-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.7fr);
  gap: 1rem;
  min-height: 100vh;
  padding: 1rem;
  background:
    radial-gradient(circle at top left, rgba(148, 163, 184, 0.16), transparent 32%),
    linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
}

.notebook-stage {
  min-width: 0;
}

.harness-panel {
  display: grid;
  gap: 1rem;
  align-content: start;
  padding: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(12px);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
  color: #0f172a;
}

.harness-panel h2 {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
}

.harness-panel pre,
.harness-panel div {
  margin: 0;
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 1100px) {
  .harness-shell {
    grid-template-columns: 1fr;
  }
}
</style>

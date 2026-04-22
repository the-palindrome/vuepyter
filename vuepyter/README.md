# Vuepyter

Vuepyter is a Vue 3 notebook editor with in-browser Python execution powered by Pyodide.  
It supports code/markdown/raw cells, notebook-level editing workflows, and `v-model` synchronization with nbformat-compatible data.

## Install

```bash
npm install vuepyter vue
```

Import styles once in your app:

```ts
import 'vuepyter/style.css'
```

## Quick Start

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Vuepyter, type SerializedNotebookDocument } from 'vuepyter'
import 'vuepyter/style.css'

const notebook = ref<SerializedNotebookDocument>({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: { title: 'My Notebook', trusted: true },
  cells: [
    {
      id: 'intro',
      cell_type: 'markdown',
      source: '# Hello from Vuepyter',
      metadata: {},
    },
    {
      id: 'code-1',
      cell_type: 'code',
      source: 'print("hello")',
      metadata: {},
      execution_count: null,
      outputs: [],
    },
  ],
})
</script>

<template>
  <Vuepyter v-model="notebook" />
</template>
```

## Model Shapes

`v-model` accepts:
- `NotebookDocument` (in-memory shape, `source` as `string`)
- `SerializedNotebookDocument` (nbformat-friendly shape, `source` and some output fields as `string | string[]`)

`update:modelValue` emits a `SerializedNotebookDocument`.

## Component API (`<Vuepyter />`)

### Key Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `modelValue` | `VuepyterModelValue \| null` | `null` | Notebook bound with `v-model`. |
| `pyodideUrl` | `string` | bundled CDN URL | Override Pyodide entry URL only when needed. |
| `pyodidePackages` | `string[]` | `[]` | Installed before notebook execution. |
| `pyodideInitCode` | `string` | `''` | Runs once after kernel initialization. |
| `preamble` | `string` | `''` | Inline code or `.py`/`.ipynb` path/URL loaded at startup. |
| `kernelUpdateMode` | `'after-execution' \| 'always-live'` | `'after-execution'` | `always-live` is experimental. |
| `readOnly` | `boolean` | `false` | Disables editing actions. |
| `showEditorBar` | `boolean` | `true` | Shows top/bottom toolbar. |
| `editorBarPosition` | `'top' \| 'bottom'` | `'top'` | Toolbar placement. |
| `theme` | `'light' \| 'dark' \| Record<string,string>` | `'light'` | Built-in or CSS-variable override theme. |
| `cellTypes` | `CellType[]` | `['code','markdown','raw']` | Allowed created/converted cell types. |
| `maxOutputHeight` | `number` | `400` | Max output panel height per cell. |
| `autosaveInterval` | `number \| false` | `false` | If `false`, emits are debounced; if number, periodic flush. |
| `locale` | `Record<string,string>` | `{}` | Text override dictionary. |
| `keymap` | `Partial<KeymapConfig>` | `{}` | Shortcut overrides. |
| `editorOptions` | `Partial<CodeEditorProps>` | `{}` | CodeMirror options override. |
| `loading` | `boolean` | `false` | External loading state. |
| `loadingOverlay` | `'auto' \| 'always' \| 'never'` | `'auto'` | Overlay display policy. |
| `loadingText` | `string` | `'Loading notebook...'` | Overlay label. |
| `loadingBlockInteraction` | `boolean` | `true` | Whether overlay captures pointer events. |

### Events

- `update:modelValue` -> serialized notebook snapshot
- `ready` -> `{ pyodide, workspace }`
- `cell:execute` -> `{ cellId, source }`
- `cell:complete` -> `{ cellId, outputs, error? }`
- `workspace:sync` -> `{ workspace, mode }`
- `kernel:update-mode` -> `{ mode }`
- `shortcuts:help`
- `error` -> `{ type, message, detail? }`

### Slots

- `loading` -> custom overlay UI (`{ phase, text, status, blocking }`)
- `editor` -> custom per-cell editor content passthrough
- `markdown-renderer` -> custom markdown rendering passthrough
- `bar-prepend`, `bar-left`, `bar-center`, `bar-right`, `bar-append` -> toolbar extension slots

### Exposed Methods (`ref` on Vuepyter)

- `executeAllCells(): Promise<void>`
- `setKernelUpdateMode(mode: 'after-execution' | 'always-live'): void`
- `getKernelUpdateMode(): 'after-execution' | 'always-live'`

## Exported Utilities

```ts
import VuepyterPlugin, {
  Vuepyter,
  CodeEditor,
  usePyodideKernel,
  useNotebookModel,
  useKeyboard,
  useVuepyterPyodide,
  useVuepyterWorkspace,
  useVuepyterStatus,
} from 'vuepyter'
```

- Default export is a Vue plugin registering `<Vuepyter />`.
- Named exports include component + composables + injection helpers.

## Pyodide, Browser, and SSR Notes

- Vuepyter executes Python in the browser; it should be mounted client-side in SSR apps.
- `preamble` accepts inline code or a fetchable path/URL to `.py` or `.ipynb`.
- `kernelUpdateMode="always-live"` instruments top-level loops for more frequent workspace sync; it is not full streaming execution.

## Theming

Use `theme="light"` / `theme="dark"` or pass CSS variables:

```vue
<Vuepyter
  v-model="notebook"
  :theme="{
    '--vuepyter-bg': '#0f172a',
    '--vuepyter-cell-bg': '#111827',
    '--vuepyter-content-max-width': '1200px',
  }"
/>
```

## License

MIT

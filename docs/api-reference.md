# Vuepyter API Reference

Vuepyter exposes a compact public surface: one top-level notebook component, one reusable code editor component, a small set of composables, and the notebook data types used throughout the package.

This reference documents the public API that is exported from `vuepyter/src/index.ts`.

## Package Exports

Vuepyter exports these public entries:

- The default plugin export, which registers `Vuepyter` globally.
- `Vuepyter`, the top-level notebook component.
- `CodeEditor`, the CodeMirror-based editor component.
- `useNotebookModel`, `usePyodideKernel`, `useKeyboard`, and the Vuepyter provide/inject helpers.
- `useVuepyterWorkspace`, `useVuepyterPyodide`, `useVuepyterStatus`, and the related injection symbols.
- Core types such as `NotebookDocument`, `SerializedNotebookDocument`, `NotebookCell`, `CellOutput`, and `VuepyterProps`.

The default plugin registers only `Vuepyter`. Import `CodeEditor` as a named export when you need it directly.

## `Vuepyter`

`Vuepyter` is the root component. It owns notebook state normalization, Pyodide lifecycle, execution, autosave timing, save/download behavior, theming, and the top-level event contract.

### Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `modelValue` | `VuepyterModelValue \| null` | `null` | Accepts either a normalized notebook document or a serialized nbformat-style document. Vuepyter normalizes the input internally. |
| `pyodideUrl` | `string` | bundled CDN URL | Overrides the Pyodide runtime source. Use this for self-hosted or mirrored runtimes. |
| `pyodidePackages` | `string[]` | `[]` | Installs extra packages through `micropip` during kernel initialization. |
| `pyodideInitCode` | `string` | `''` | Runs once after Pyodide loads and before notebook execution starts. |
| `kernelUpdateMode` | `'after-execution' \| 'always-live'` | `'after-execution'` | Controls when Vuepyter syncs the Python workspace back into Vue. `always-live` is experimental. |
| `readOnly` | `boolean` | `false` | Disables mutating cell operations and editor writes. |
| `showEditorBar` | `boolean` | `true` | Shows or hides the notebook toolbar and menus. |
| `editorBarPosition` | `'top' \| 'bottom'` | `'top'` | Renders the editor bar above or below the notebook. |
| `theme` | `'light' \| 'dark' \| Record<string, string>` | `'light'` | Uses a preset theme or merges custom CSS variables on top of the preset. |
| `maxOutputHeight` | `number` | `400` | Sets the maximum scrollable output height for visible code outputs. |
| `cellTypes` | `('code' \| 'markdown' \| 'raw')[]` | `['code', 'markdown', 'raw']` | Limits which cell kinds users can create from the toolbar. |
| `autosaveInterval` | `number \| false` | `false` | When `false`, model updates are debounced. When a positive number, updates flush on that interval. |
| `locale` | `Partial<VuepyterLocale> \| Record<string, string>` | `{}` | Overrides built-in UI labels. The component accepts a flexible string map for additional labels used by the editor bar. |
| `keymap` | `Partial<KeymapConfig>` | `{}` | Overrides the default Jupyter-style shortcut map. |
| `editorOptions` | `Partial<CodeEditorProps>` | `{}` | Sets shared CodeMirror options for notebook cell editors. |

### `v-model` Behavior

`Vuepyter` accepts both normalized and serialized notebook values. The component emits `update:modelValue` with a serialized notebook document, which means multiline `source` and `text` fields are arrays in emitted values.

Unknown notebook, cell, and output keys are preserved during normalization and serialization. This helps Vuepyter round-trip metadata and custom fields without stripping them out.

### Events

| Event | Payload | When it fires |
| --- | --- | --- |
| `update:modelValue` | `SerializedNotebookDocument` | After notebook changes flush through the internal save queue. |
| `ready` | `{ pyodide, workspace }` | After the Pyodide kernel initializes and the first workspace sync completes. |
| `cell:execute` | `{ cellId, source }` | Immediately before a code cell executes. |
| `cell:complete` | `{ cellId, outputs, error? }` | After a cell finishes, with either outputs only or outputs plus an execution error. |
| `workspace:sync` | `{ workspace, mode }` | After Vuepyter syncs Python globals into the exposed workspace object. |
| `kernel:update-mode` | `{ mode }` | After the kernel update mode changes through the editor bar or exposed method. |
| `shortcuts:help` | none | When the user triggers the keyboard shortcuts help action. |
| `error` | `{ type, message, detail? }` | When kernel initialization, execution, interruption, or workspace sync fails. |

### Slots

`Vuepyter` exposes two slot groups: notebook chrome slots and per-cell rendering slots.

#### Editor Bar Slots

These slots render inside the editor bar and do not receive slot props:

- `bar-prepend`
- `bar-left`
- `bar-center`
- `bar-right`
- `bar-append`

Use these slots to add custom controls or metadata without replacing the built-in notebook UI.

#### Cell Rendering Slots

`editor` overrides the per-cell editor surface. It receives these slot props:

- `cell`
- `index`
- `update-source`
- `run-cell`

`markdown-renderer` overrides markdown preview rendering. It receives these slot props:

- `cell`
- `source`

### Exposed Methods

Access exposed methods through a template ref:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Vuepyter } from 'vuepyter'

const vuepyterRef = ref<InstanceType<typeof Vuepyter> | null>(null)

async function runAll() {
  await vuepyterRef.value?.executeAllCells()
}
</script>

<template>
  <Vuepyter ref="vuepyterRef" v-model="notebook" />
</template>
```

The root component exposes these methods:

- `executeAllCells()`
- `setKernelUpdateMode(mode)`
- `getKernelUpdateMode()`

## `CodeEditor`

`CodeEditor` is the public CodeMirror wrapper used by notebook cells. Use it directly if you want Vuepyter’s editor behavior without the full notebook shell.

### Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `modelValue` | `string` | `''` | Editor text content. |
| `language` | `'python' \| 'markdown' \| 'raw'` | `'python'` | Selects the language extension. |
| `readOnly` | `boolean` | `false` | Disables edits. |
| `lineNumbers` | `boolean` | `true` | Shows or hides line numbers. |
| `lineWrapping` | `boolean` | `true` | Enables wrapped lines. |
| `indentUnit` | `number` | `4` | Sets indentation width. |
| `tabSize` | `number` | `4` | Sets the CodeMirror tab size. |
| `placeholder` | `string` | `''` | Adds placeholder content when the editor is empty. |
| `autofocus` | `boolean` | `false` | Focuses the editor after mount. |
| `extensions` | `Extension[]` | `[]` | Appends extra CodeMirror extensions. |
| `dark` | `boolean` | `false` | Switches CodeMirror to the dark theme. |

### Events

| Event | Payload | Notes |
| --- | --- | --- |
| `update:modelValue` | `string` | Fires on text changes. |
| `execute` | `boolean` | Emits `true` for advance behavior and `false` for stay behavior. |
| `split` | `number` | Emits the cursor offset for split-cell behavior. |
| `exit` | none | Fires when edit mode exits. |
| `focus` | none | Fires when the editor gains focus. |
| `blur` | none | Fires when the editor loses focus. |
| `cursor` | `{ line, col }` | Reports cursor position changes. |
| `navigateUp` | none | Fires when the caret is at the top and the user presses `ArrowUp`. |
| `navigateDown` | none | Fires when the caret is at the bottom and the user presses `ArrowDown`. |

### Built-In Editor Shortcuts

`CodeEditor` handles these shortcuts directly:

- `Shift+Enter` executes and advances.
- `Mod+Enter` executes and stays on the current cell.
- `Mod+Shift+-` emits a split request.
- `Escape` exits edit mode.
- `ArrowUp` and `ArrowDown` can move to adjacent cells when the caret is already at the start or end of the document.

## Data Types

### Notebook shapes

- `NotebookDocument` is the normalized in-memory form. Multiline fields are stored as plain strings.
- `SerializedNotebookDocument` is the nbformat-friendly form. Multiline fields are stored as arrays of lines.

### Cells

Vuepyter supports these cell types:

- `code`
- `markdown`
- `raw`

Code cells include `execution_count` and `outputs`. Markdown and raw cells keep `source` and `metadata` only.

### Outputs

Vuepyter models notebook outputs with these common shapes:

- `stream`
- `execute_result`
- `display_data`
- `error`

Unknown output types are normalized into `display_data` with fallback `text/plain` output so the notebook remains renderable.

## `useNotebookModel`

`useNotebookModel(options)` manages notebook structure and active-cell state. It is the right composable when you want notebook CRUD behavior outside the default `Vuepyter` component.

### Options

- `modelValue`
- `allowedCellTypes`

### Returned state

- `notebook`
- `cells`
- `activeCellId`
- `activeCellIndex`

### Returned methods

- `setNotebook(value)`
- `setActiveCellId(cellId)`
- `setActiveCellIndex(index)`
- `createCell(cellType?, overrides?)`
- `addCell(index?, cellType?)`
- `insertCell(cell, index?)`
- `updateCell(cellIdOrIndex, patch)`
- `setCellSource(cellIdOrIndex, source)`
- `setCellType(cellIdOrIndex, cellType)`
- `setCellOutputs(cellIdOrIndex, outputs, executionCount?)`
- `clearOutputs(cellIdOrIndex?)`
- `resetExecutionState()`
- `deleteCell(index)`
- `removeCell(cellId)`
- `moveCell(fromIndex, toIndex)`
- `getCellById(cellId)`
- `serialize()`
- `toNbformatDocument()`

### Notes

- Missing or empty notebooks get a starter code cell by default.
- Allowed cell types fall back to `['code', 'markdown', 'raw']` when the provided list is empty or invalid.
- Converting a cell to `code` clears outputs and resets `execution_count`.

## `usePyodideKernel`

`usePyodideKernel(options)` creates a reactive Pyodide-backed execution kernel. `Vuepyter` uses this composable internally, but you can use it on its own when you need lower-level control.

### Options

- `pyodideUrl`
- `pyodidePackages`
- `pyodideInitCode`
- `getWorkspaceUpdateMode`
- `onReady`
- `onError`
- `onExecute`
- `onComplete`
- `onWorkspaceSync`

### Returned state

- `pyodide`
- `status`
- `statusRef`
- `workspace`
- `executionCount`
- `isReady`
- `isBusy`

### Returned methods

- `initialize(force?)`
- `executeCell(requestOrCellId, source?)`
- `restart()`
- `restartKernel()`
- `interrupt()`
- `interruptExecution()`
- `syncWorkspace()`
- `setWorkspaceVariable(name, value)`
- `destroy()`

### Notes

- Initialization always preloads `micropip`, then installs `pyodidePackages`, then runs `pyodideInitCode`.
- Execution is serialized internally, so concurrent `executeCell()` calls run one after another.
- `always-live` mode syncs workspace state during execution, but it is a best-effort mode intended for top-level `for` and `while` loops rather than full streaming output.

## `useKeyboard`

`useKeyboard(options)` handles Jupyter-style command and edit mode shortcuts. `Notebook.vue` uses it to implement command-mode selection, multi-key sequences, and save/run shortcuts.

### Key options

- `keymap`
- `readOnly`
- `activeCellIndex`
- `cellCount`
- `mode`
- `enabled`
- `target`
- `deleteSequenceTimeout`
- callback hooks such as `onRunCell`, `onAddCell`, `onDeleteCell`, `onChangeCellType`, `onShowShortcuts`, and `onSave`

### Return value

- `mode`
- `isCommandMode`
- `isEditMode`
- `setMode(mode)`
- `handleKeydown(event)`
- `onKeydown(event)`

### Notes

- `Ctrl+S` and `Mod+S` are treated as global save shortcuts.
- Command-mode shortcuts are suppressed when the event target is an editable element.
- Multi-stroke sequences such as `D D`, `I I`, and `0 0` are supported through the default keymap.

## Provide / Inject Helpers

Vuepyter exports three injection keys and four helper functions:

- `VUEPYTER_PYODIDE`
- `VUEPYTER_WORKSPACE`
- `VUEPYTER_STATUS`
- `useVuepyterProvide(options)`
- `useVuepyterPyodide()`
- `useVuepyterWorkspace()`
- `useVuepyterStatus()`
- `createVuepyterProvideDefaults()`

`Vuepyter` calls `useVuepyterProvide()` internally so descendants can read the active kernel, workspace, and status without prop drilling. The injectors throw if you call them outside a Vuepyter provider.

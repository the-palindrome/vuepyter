# Getting Started with Vuepyter

Vuepyter renders and edits Jupyter notebooks inside a Vue 3 application. It accepts a notebook through `v-model`, normalizes the document internally, and runs Python cells in the browser with Pyodide.

Vuepyter works best in client-rendered views. The editor can appear inside an SSR app, but the component itself should mount on the client because Pyodide depends on browser APIs.

## Install the Package

Install Vuepyter alongside Vue 3:

```bash
npm install vuepyter vue
```

Import the stylesheet once before you render the component:

```ts
import 'vuepyter/style.css'
```

The stylesheet is required. Without it, the notebook shell, CodeMirror editor, and output area render without the expected layout.

## Render Your First Notebook

Start with a serialized notebook document if you want the `v-model` shape to stay stable after edits. Vuepyter accepts both normalized and serialized notebook values, but it emits serialized notebook documents when the model updates.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Vuepyter, type SerializedNotebookDocument } from 'vuepyter'
import 'vuepyter/style.css'

const notebook = ref<SerializedNotebookDocument>({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: {
    title: 'Hello Vuepyter',
    kernelspec: {
      name: 'python3',
      display_name: 'Python 3',
    },
  },
  cells: [
    {
      id: 'intro',
      cell_type: 'markdown',
      metadata: {},
      source: ['# Hello from Vuepyter\n', '\n', 'This notebook runs in the browser.\n'],
    },
    {
      id: 'run-me',
      cell_type: 'code',
      metadata: {},
      execution_count: null,
      outputs: [],
      source: ['print("Hello from Python")\n'],
    },
  ],
})
</script>

<template>
  <Vuepyter v-model="notebook" />
</template>
```

Vuepyter fills in missing notebook structure as needed. If you pass a partial notebook or omit cell ids, the component normalizes the document before it renders.

## Understand the Save Model

Vuepyter supports two save paths:

- It emits `update:modelValue` with a serialized notebook document.
- It downloads an `.ipynb` file when the user triggers save from the editor bar or keyboard shortcut.

By default, model updates are debounced by 150 ms. Set `autosaveInterval` to a positive number if you want Vuepyter to queue changes and emit them on a fixed interval instead.

```vue
<Vuepyter v-model="notebook" :autosave-interval="2000" />
```

The save action always flushes pending changes immediately before the browser download starts.

## Configure Pyodide

Vuepyter loads a bundled Pyodide runtime by default. You can keep the defaults for most cases, or override the runtime URL, preload extra packages, and run initialization code before the first cell executes.

```vue
<script setup lang="ts">
const packages = ['numpy', 'pandas']
const initCode = [
  'import math',
  'PI = math.pi',
].join('\n')
</script>

<template>
  <Vuepyter
    v-model="notebook"
    :pyodide-packages="packages"
    :pyodide-init-code="initCode"
    preamble="./preamble.py"
  />
</template>
```

`preamble` accepts inline Python or a path/URL to a `.py` or `.ipynb` file. Vuepyter executes it during kernel startup, before the component reports `ready`, so imports and variables from the preamble are available to notebook cells immediately.

Use `v-model` to load and persist notebook document content. Use `preamble` only for one-time startup code that should run before cells execute.

Use `pyodideUrl` when you need a self-hosted mirror or a pinned runtime source:

```vue
<Vuepyter
  v-model="notebook"
  pyodide-url="/vendor/pyodide/pyodide.mjs"
/>
```

## React to Kernel Events

Vuepyter emits lifecycle events that help you observe execution and inspect live workspace state. The most useful hooks are `ready`, `cell:execute`, `cell:complete`, `workspace:sync`, and `error`.

```vue
<script setup lang="ts">
function onReady(payload: { workspace: { value: Record<string, unknown> } }) {
  console.log('Kernel ready', payload.workspace.value)
}

function onWorkspaceSync(payload: { workspace: Record<string, unknown> }) {
  console.log('Workspace changed', payload.workspace)
}
</script>

<template>
  <Vuepyter
    v-model="notebook"
    @ready="onReady"
    @workspace:sync="onWorkspaceSync"
  />
</template>
```

`workspace:sync` fires after cell execution in the default mode. If you enable `kernelUpdateMode="always-live"`, Vuepyter attempts additional workspace syncs while long-running top-level loops execute.

## Customize the Notebook Shell

Vuepyter exposes a small set of high-value customization props:

- `theme` switches between the built-in `light` and `dark` presets or applies your own CSS variable map.
- `editorOptions` forwards CodeMirror options such as line numbers, wrapping, indentation, and extensions.
- `keymap` lets you override the default Jupyter-style shortcuts.
- `cellTypes` limits the cell kinds users can create from the toolbar.

This example applies a custom theme and hides the editor bar:

```vue
<Vuepyter
  v-model="notebook"
  :show-editor-bar="false"
  :theme="{
    '--vuepyter-bg': '#ffffff',
    '--vuepyter-cell-bg': '#ffffff',
    '--vuepyter-cell-active-border': '#0f766e',
  }"
/>
```

## Use Vuepyter in SSR Apps

Vuepyter should mount only on the client. The component initializes Pyodide on mount, and the fallback loader needs `document` to inject the runtime script.

In SSR frameworks, wrap the component in your client-only pattern and defer notebook rendering until the browser takes over. You do not need to disable SSR for the whole route, only for the Vuepyter subtree.

## What Vuepyter Renders

Vuepyter supports three cell types:

- `code`
- `markdown`
- `raw`

Code cell outputs support these primary render paths:

- `stream` output as text
- `error` output with ANSI-colored traceback formatting
- `display_data` and `execute_result` with sanitized `text/html`
- `image/png` output as an image
- other MIME data as plain text fallback

The markdown renderer supports headings, emphasis, links, images, fenced code blocks, lists, and KaTeX math. It is a custom markdown subset, not a full CommonMark or GFM implementation.

## Next Steps

- Follow the full [Build a Notebook App](./tutorial-build-a-notebook-app.md) tutorial for a richer integration.
- Keep the [API Reference](./api-reference.md) nearby when you add events, slots, or custom editor behavior.
- Read [Troubleshooting](./troubleshooting.md) if Pyodide or SSR integration behaves differently than expected.

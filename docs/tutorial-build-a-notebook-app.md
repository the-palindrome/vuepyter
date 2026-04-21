# Build a Notebook App with Vuepyter

Vuepyter gives a Vue 3 app an in-browser notebook editor with a Pyodide-backed Python runtime. It accepts notebook data through `v-model`, renders notebook cells, and executes Python code entirely in the browser.

This tutorial shows the package-consumer flow. It covers installation, a working `v-model` setup, client-only rendering, Pyodide configuration, and the main customization points exposed by [`vuepyter/src/components/Vuepyter.vue`](../vuepyter/src/components/Vuepyter.vue).

## What You Build

The finished page renders a notebook, keeps the notebook JSON in sync with Vue state, and listens to the runtime lifecycle. It uses the published package import path instead of the repository's local `dist/` files.

The repository includes a similar standalone demo in [`examples/quickstart/quickstart.html`](../examples/quickstart/quickstart.html). That example is useful when you want to compare the tutorial code with a working local HTML page.

## Install the Package

Install Vuepyter alongside Vue. Vuepyter targets Vue 3.4+ and modern browsers.

Import the stylesheet once before you render the component. The package exports `vuepyter/style.css` for application use.

```bash
npm install vuepyter vue
```

```ts
import 'vuepyter/style.css'
```

## Create a Minimal Notebook Page

Start with a normal Vue component and keep the notebook in a `ref`. Vuepyter accepts either a normalized notebook object or a serialized nbformat-style object, so you can begin with plain notebook JSON.

The component below shows a complete starting point. It renders the notebook, listens to key events, and keeps a copy of the synchronized Python workspace.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Vuepyter } from 'vuepyter'
import 'vuepyter/style.css'

const notebook = ref({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: {
    title: 'demo.ipynb',
    kernelspec: {
      name: 'python3',
      display_name: 'Python 3',
    },
    language_info: {
      name: 'python',
    },
  },
  cells: [
    {
      id: 'intro',
      cell_type: 'markdown',
      metadata: {},
      source: [
        '# Hello from Vuepyter\n',
        '\n',
        'Run the next cell to test the browser-side kernel.',
      ],
    },
    {
      id: 'run-me',
      cell_type: 'code',
      metadata: {},
      execution_count: null,
      outputs: [],
      source: [
        'x = 40 + 2\n',
        'x',
      ],
    },
  ],
})

const workspace = ref<Record<string, unknown>>({})
const kernelStatus = ref('loading')

function onReady(payload: { pyodide: unknown; workspace: { value: Record<string, unknown> } }) {
  workspace.value = payload.workspace.value
  kernelStatus.value = 'ready'
}

function onWorkspaceSync(payload: { workspace: Record<string, unknown> }) {
  workspace.value = payload.workspace
}

function onError(payload: { type: string; message: string }) {
  console.error(`[${payload.type}] ${payload.message}`)
}
</script>

<template>
  <section class="notebook-page">
    <Vuepyter
      v-model="notebook"
      @ready="onReady"
      @workspace:sync="onWorkspaceSync"
      @error="onError"
    />

    <aside class="workspace-panel">
      <h2>Kernel status: {{ kernelStatus }}</h2>
      <pre>{{ JSON.stringify(workspace, null, 2) }}</pre>
    </aside>
  </section>
</template>
```

When the component mounts, Vuepyter normalizes the notebook and loads Pyodide. After the kernel becomes ready, code cells run in the browser and `workspace:sync` emits the current Python globals as plain JavaScript data.

## Understand the `v-model` Contract

Vuepyter's `v-model` API is flexible on input and strict on output. You can pass either an in-memory notebook document or a serialized notebook document, but `update:modelValue` always emits a serialized notebook structure.

That detail matters when you store notebook state outside the component. Multiline fields such as `source`, stream output text, and rich output text are emitted in nbformat-friendly array form, even though Vuepyter may use strings internally while editing.

### What Vuepyter Accepts

Vuepyter accepts:

- A serialized notebook object that looks like an `.ipynb` file.
- A normalized in-memory document shaped like the internal notebook model.
- Initial `null` or incomplete notebook data, which Vuepyter normalizes into a valid document.

Vuepyter also preserves unknown root, cell, and output fields while normalizing and serializing. That behavior helps when your app stores notebook metadata used by other tools.

### What Vuepyter Emits

`update:modelValue` emits a serialized notebook document. Save that emitted value directly if you want to write an `.ipynb` file or send notebook JSON to an API.

The quickstart example in [`examples/quickstart/quickstart.html`](../examples/quickstart/quickstart.html) shows this pattern in practice. It binds `v-model` to a notebook ref and mirrors the current JSON in a side panel.

### A Practical Save Pattern

Keep the serialized notebook in Vue state and write it when the user saves. Vuepyter already emits debounced updates, and `autosaveInterval` lets you switch to interval-based flushing when you want less frequent writes.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Vuepyter } from 'vuepyter'

const notebook = ref()

async function saveNotebook() {
  await fetch('/api/notebooks/demo', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(notebook.value),
  })
}
</script>

<template>
  <Vuepyter v-model="notebook" :autosave-interval="5000" />
  <button type="button" @click="saveNotebook">Save</button>
</template>
```

When you do not set `autosaveInterval`, Vuepyter emits model updates on a short debounce. When you set a positive interval, Vuepyter marks notebook changes as pending and flushes them on that interval instead.

## Mount Vuepyter on the Client

Vuepyter executes code through Pyodide, so it needs a browser environment. The Pyodide runtime loads in the client, and the fallback loader path depends on browser globals such as `window` and script injection.

In a plain Vite app, a normal component mount is enough. In an SSR app such as Nuxt, render Vuepyter only on the client.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Vuepyter } from 'vuepyter'
import 'vuepyter/style.css'

const notebook = ref({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: {},
  cells: [],
})
</script>

<template>
  <ClientOnly>
    <Vuepyter v-model="notebook" />
  </ClientOnly>
</template>
```

If you render Vuepyter during SSR, the editor shell may hydrate incorrectly or the kernel may fail to initialize. The safest pattern is to mount it only after the page reaches the browser.

## Configure the Pyodide Kernel

Vuepyter exposes four main runtime props for kernel setup: `pyodideUrl`, `pyodidePackages`, `pyodideInitCode`, and `preamble`. These map directly to the browser-side Pyodide bootstrap sequence in [`vuepyter/src/composables/usePyodideKernel.ts`](../vuepyter/src/composables/usePyodideKernel.ts).

Use `pyodidePackages` to install extra packages before the notebook runs. Use `pyodideInitCode` to import modules or define helper functions once after initialization. Use `preamble` for one-time bootstrap code that should run before notebook cells, such as constants, shared helper functions, or imports that your notebook expects to exist.

```vue
<template>
  <Vuepyter
    v-model="notebook"
    pyodide-url="https://cdn.jsdelivr.net/pyodide/v0.27.3/full/pyodide.mjs"
    :pyodide-packages="['numpy', 'pandas']"
    pyodide-init-code="import math"
    preamble="./preamble.py"
  />
</template>
```

`preamble` accepts inline Python code or a path/URL to a `.py` or `.ipynb` file. Vuepyter runs `preamble` after `pyodideInitCode` and before the component emits `ready`.

Keep notebook content and kernel bootstrap setup separate. Load notebook JSON through `v-model`, and use `preamble` only for startup code that should be available to all cells.

Vuepyter also exposes `kernelUpdateMode`. The default value, `after-execution`, synchronizes the workspace after a cell completes. The alternative, `always-live`, is experimental and best-effort. It instruments top-level `for` and `while` loops for more frequent workspace sync, but it does not provide full live output streaming.

## Customize the Editor Surface

Vuepyter ships with a focused public API. Most apps customize appearance, allowed cell types, keyboard behavior, editor defaults, and toolbar placement first.

### Appearance Props

Use these props to control the visual shell:

- `theme`: Accepts `'light'`, `'dark'`, or a CSS variable map merged onto the preset theme.
- `maxOutputHeight`: Limits rendered output height before Vuepyter makes the output region scroll.
- `showEditorBar`: Shows or hides the top-level notebook toolbar.
- `editorBarPosition`: Places the toolbar at the top or bottom.
- `locale`: Overrides labels such as kernel status text and cell type labels.

The built-in theme variables live in [`vuepyter/src/constants.ts`](../vuepyter/src/constants.ts). You can override only the tokens you need.

```vue
<template>
  <Vuepyter
    v-model="notebook"
    editor-bar-position="bottom"
    :max-output-height="280"
    :theme="{
      '--vuepyter-bg': '#fffaf0',
      '--vuepyter-cell-bg': '#ffffff',
      '--vuepyter-cell-active-border': '#ea580c',
      '--vuepyter-content-max-width': '1200px',
    }"
    :locale="{
      kernelReady: 'Kernel ready',
      kernelBusy: 'Running',
    }"
  />
</template>
```

### Editing Props

Use these props to control notebook behavior:

- `readOnly`: Prevents notebook edits and suppresses editing shortcuts.
- `cellTypes`: Limits the cell types users can create from the toolbar or shortcuts.
- `keymap`: Overrides parts of the default keyboard map.
- `editorOptions`: Passes editor defaults such as line numbers, wrapping, indentation, and CodeMirror extensions.

If you provide an invalid or empty `cellTypes` list, Vuepyter falls back to `code`, `markdown`, and `raw`. That fallback keeps the editor usable even when your configuration is incomplete.

```vue
<template>
  <Vuepyter
    v-model="notebook"
    :cell-types="['code', 'markdown']"
    :keymap="{
      save: 'Mod+S',
      runCellAndAdvance: 'Shift+Enter',
    }"
    :editor-options="{
      lineNumbers: false,
      lineWrapping: true,
      indentUnit: 2,
      tabSize: 2,
    }"
  />
</template>
```

### Slots

Vuepyter exposes root toolbar slots and notebook rendering slots:

- `bar-prepend`
- `bar-left`
- `bar-center`
- `bar-right`
- `bar-append`
- `editor`
- `markdown-renderer`

Use the bar slots when you want to add controls beside the built-in toolbar. Use the `editor` and `markdown-renderer` slots when you want to replace the default code editor or markdown preview rendering for notebook cells.

## Listen to Notebook Events

Vuepyter emits notebook and kernel lifecycle events from the root component. These events are the main integration points for analytics, persistence, custom runtime behavior, and external UI.

- `update:modelValue`: Emits the serialized notebook document.
- `ready`: Fires when the kernel is initialized and exposes `{ pyodide, workspace }`.
- `cell:execute`: Fires before a code cell runs.
- `cell:complete`: Fires after a code cell finishes and includes outputs plus an optional error.
- `workspace:sync`: Fires when Vuepyter exports Python globals to JavaScript.
- `kernel:update-mode`: Fires when the kernel update mode changes.
- `shortcuts:help`: Fires when the user requests keyboard shortcut help.
- `error`: Fires when the runtime reports an initialization or execution problem.

The snippet below shows a practical event wiring pattern. It logs execution, tracks errors, and stores the current workspace snapshot.

```vue
<script setup lang="ts">
import { ref } from 'vue'

const workspace = ref({})

function onCellExecute(payload: { cellId: string; source: string }) {
  console.log('Running cell', payload.cellId, payload.source)
}

function onCellComplete(payload: { cellId: string; outputs: unknown[]; error?: Error }) {
  console.log('Finished cell', payload.cellId, payload.outputs)
  if (payload.error) {
    console.error(payload.error)
  }
}

function onWorkspaceSync(payload: { workspace: Record<string, unknown>; mode: string }) {
  workspace.value = payload.workspace
  console.log('Workspace mode:', payload.mode)
}
</script>

<template>
  <Vuepyter
    v-model="notebook"
    @cell:execute="onCellExecute"
    @cell:complete="onCellComplete"
    @workspace:sync="onWorkspaceSync"
  />
</template>
```

## Know the Practical Limits

Vuepyter follows notebook conventions closely, but a few runtime details are worth knowing up front. These details come directly from the current implementation and help avoid surprising behavior in production apps.

- Vuepyter runs Python in the browser. It does not talk to a remote Jupyter kernel by default.
- During initialization, empty or missing notebook data is normalized into a usable notebook document instead of staying empty.
- Replacing `modelValue` with `null` after mount does not currently reset the internal notebook by itself.
- Converting a cell to `code` resets its execution count and outputs.
- The markdown renderer supports a custom subset with KaTeX and sanitization, not full CommonMark or GitHub Flavored Markdown.
- Rich HTML output is sanitized before rendering.
- The `always-live` update mode improves workspace sync, not live cell output streaming.

If you need a repository-backed reference implementation, start with [`examples/quickstart/quickstart.html`](../examples/quickstart/quickstart.html). If you want a tour of the bundled demos, continue with [examples.md](./examples.md).

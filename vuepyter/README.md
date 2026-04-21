# Vuepyter

Vuepyter is a lightweight Jupyter Notebook editor for Vue 3. It renders notebook cells, keeps notebook state in sync with `v-model`, and runs Python in the browser through Pyodide.

## Documentation

The repository includes a full documentation suite for Vuepyter:

- Getting started: https://github.com/the-palindrome/vuepyter/blob/main/docs/getting-started.md
- Tutorial: https://github.com/the-palindrome/vuepyter/blob/main/docs/tutorial-build-a-notebook-app.md
- API reference: https://github.com/the-palindrome/vuepyter/blob/main/docs/api-reference.md
- Architecture: https://github.com/the-palindrome/vuepyter/blob/main/docs/architecture.md
- Examples guide: https://github.com/the-palindrome/vuepyter/blob/main/docs/examples.md
- Troubleshooting: https://github.com/the-palindrome/vuepyter/blob/main/docs/troubleshooting.md

## Install

Install Vuepyter alongside Vue:

```bash
npm install vuepyter vue
```

## Import styles

Vuepyter ships with its own stylesheet. Import it once in your app entry before you render the component:

```ts
import 'vuepyter/style.css'
```

## Use the component

Import the component directly when you want local registration in a single view:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Vuepyter } from 'vuepyter'
import 'vuepyter/style.css'

const notebook = ref({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: {
    kernelspec: {
      name: 'python3',
      display_name: 'Python 3',
    },
  },
  cells: [
    {
      id: 'welcome',
      cell_type: 'markdown',
      metadata: {},
      source: '# Hello from Vuepyter',
    },
    {
      id: 'run-me',
      cell_type: 'code',
      metadata: {},
      execution_count: null,
      outputs: [],
      source: 'print("Hello from the notebook")',
    },
  ],
})
</script>

<template>
  <Vuepyter v-model="notebook" />
</template>
```

`v-model` accepts either a notebook document or a serialized notebook document. Vuepyter normalizes the data internally, so you can start with a minimal notebook and let the component fill in the rest.

Vuepyter emits serialized notebook documents from `update:modelValue`. If you want your bound state shape to stay stable in TypeScript, initialize the notebook as a serialized document from the start.

## Register as a plugin

Vuepyter also exposes a default plugin export that registers the component globally. This is useful when you want to install it once on the app instance:

```ts
import { createApp } from 'vue'
import App from './App.vue'
import Vuepyter from 'vuepyter'
import 'vuepyter/style.css'

createApp(App).use(Vuepyter).mount('#app')
```

Use the named export if you prefer local registration:

```ts
import { Vuepyter } from 'vuepyter'
```

## Pyodide notes

Vuepyter executes notebooks in the browser with Pyodide. That means the editor needs a browser environment and should be mounted client-side in SSR apps.

Common runtime props:

```vue
<Vuepyter
  v-model="notebook"
  :pyodide-packages="['numpy', 'pandas']"
  pyodide-init-code="import math"
  preamble="./preamble.py"
/>
```

Vuepyter uses its bundled Pyodide runtime by default. Override `pyodideUrl` only if you need a mirror or a different version. `pyodidePackages` installs extra packages before execution, `pyodideInitCode` runs once after the runtime loads, and `preamble` runs once before the editor becomes ready. `preamble` accepts inline Python code or a path/URL to a `.py` or `.ipynb` file, so a setup like `<Vuepyter preamble="./preamble.ipynb" />` works directly from the component tag. `kernelUpdateMode` controls whether workspace state updates after a cell runs or attempts additional syncs while a long-running cell is still executing.

`kernelUpdateMode="always-live"` is experimental. It improves workspace syncing during top-level loops, but it is not a full streaming execution mode.

## Styling and themes

The stylesheet covers the editor chrome, cell layout, and notebook shell. You can use the built-in `light` and `dark` themes, or pass a theme object to override CSS variables for your own design system.

```vue
<Vuepyter v-model="notebook" theme="dark" />
```

For a custom palette, pass the variables directly:

```vue
<Vuepyter
  v-model="notebook"
  :theme="{
    '--vuepyter-bg': '#0f172a',
    '--vuepyter-cell-bg': '#111827',
  }"
/>
```

For a full custom look, start with the default stylesheet and override the variables in a parent scope rather than replacing the component styles wholesale.

## Package contents

The published package includes the compiled module entry points, TypeScript declarations, and the bundled stylesheet:

- `dist/index.mjs`
- `dist/index.cjs`
- `dist/index.d.ts`
- `dist/index.d.cts`
- `dist/vuepyter.css`

## Examples

See [examples/README.md](../examples/README.md) for the standalone demo pages and the npm-consumer path.

## Compatibility

Vuepyter targets Vue 3.4+ and modern browsers with browser-side execution. Because Pyodide loads in the client, it works best in apps that can defer notebook rendering until after mount.

## License

Vuepyter is released under the MIT License.

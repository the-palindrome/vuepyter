# Troubleshooting Vuepyter

Vuepyter runs a notebook editor and a Python runtime in the browser at the same time. Most runtime problems come from one of four places: the component renders on the server, Pyodide cannot load, notebook changes are not persisted by the host app, or the app forgets to import the bundled stylesheet.

Use this page to isolate those problems quickly. The sections below follow the code paths in `Vuepyter.vue`, `usePyodideKernel.ts`, and the package exports, so the fixes match the current implementation.

## Quick checklist

Start with the simplest checks before you debug deeper:

- Mount Vuepyter only in a browser context.
- Import `vuepyter/style.css` exactly once in your app.
- Confirm that your `pyodideUrl` points to a reachable Pyodide loader file.
- Confirm that the parent component handles `v-model` updates and stores the emitted notebook value.
- Build the package before opening the standalone HTML examples in `examples/`.

If one of those checks fails, fix it first. Many follow-on errors disappear immediately.

## SSR and browser-only errors

Vuepyter is not a server-side notebook runtime. The component initializes Pyodide on mount and uses browser APIs such as `document`, `Blob`, and `URL.createObjectURL`, so SSR rendering must defer Vuepyter until the client is ready.

Typical symptoms include:

- `window is not defined`
- `document is not defined`
- Pyodide loader errors during server render
- Hydration mismatches around the notebook shell

Render Vuepyter only after mount in SSR apps:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Vuepyter } from 'vuepyter'
import 'vuepyter/style.css'

const mounted = ref(false)

onMounted(() => {
  mounted.value = true
})
</script>

<template>
  <Vuepyter v-if="mounted" v-model="notebook" />
</template>
```

If your framework provides a client-only wrapper, that is also a good fit. The important part is that Vuepyter does not initialize during SSR.

## Pyodide does not load

Vuepyter tries three ways to resolve Pyodide. It first attempts a dynamic import from `pyodideUrl`, then checks for a global `loadPyodide`, and finally falls back to script injection. That sequence is flexible, but it also means a broken URL, a CSP restriction, or an incomplete self-hosted runtime can fail in different ways.

Common symptoms include:

- The kernel stays in `Loading`
- The component emits an `error` event with `type: 'kernel:init'`
- Console errors such as `Failed to load Pyodide script`
- Console errors such as `Unable to resolve loadPyodide`

Check these conditions:

- `pyodideUrl` must point to the loader entry, not just the directory.
- The file must be reachable from the browser that renders Vuepyter.
- If you self-host Pyodide, keep the related runtime files available under the same derived base path. Vuepyter computes `indexURL` from `pyodideUrl`.
- If your site uses a strict CSP, allow the chosen loading path. Script injection fallback needs permission to append a script tag.

The default runtime URL is:

```text
https://cdn.jsdelivr.net/pyodide/v0.27.3/full/pyodide.mjs
```

If the default CDN works but your override does not, the override is the first thing to inspect.

## `pyodidePackages` or `pyodideInitCode` fails

Vuepyter always loads `micropip` before it installs any extra packages. After that, it installs every entry from `pyodidePackages` and finally runs `pyodideInitCode`.

That order means package failures can block the kernel before your init code runs. A package list that works in CPython does not automatically work in Pyodide.

Check these cases when initialization fails:

- The package name is misspelled.
- The package is not available for Pyodide or `micropip`.
- The browser cannot reach the package source because of network policy or offline mode.
- `pyodideInitCode` imports a package that is not present yet.

Start with the smallest possible setup and add dependencies back one at a time:

```vue
<Vuepyter
  v-model="notebook"
  :pyodide-packages="[]"
  pyodide-init-code=""
/>
```

When that works, reintroduce packages individually until the failing dependency is obvious.

## The kernel loads but execution still looks wrong

Execution is serialized through an internal queue. Vuepyter does not run multiple cells in parallel, and the kernel status changes from `ready` to `busy` while a cell runs.

A few behaviors are easy to mistake for bugs:

- `interrupt()` is best-effort. If the current environment does not expose `interruptExecution`, Vuepyter returns `false` and emits an interrupt-related error.
- Markdown cells do not execute code. Running a markdown cell only advances selection behavior.
- Restarting the kernel clears workspace state and execution counts, then reinitializes Pyodide.

If the notebook appears frozen, inspect the emitted `error` payload and the browser console first. Most hard failures come from Python exceptions, unsupported interrupts, or a broken Pyodide runtime rather than from the notebook UI itself.

## `always-live` mode does not behave like full live output streaming

`kernelUpdateMode="always-live"` is experimental. The current implementation instruments top-level `for` and `while` loops, requests workspace syncs during execution, and polls workspace state on a short interval.

That mode does not stream every intermediate output event and does not turn the notebook into a fully reactive Python runtime. If you expect incremental cell output or deep live updates inside nested control flow, you may see fewer updates than expected.

Use `after-execution` when you want the most predictable behavior. Use `always-live` only when best-effort workspace refreshes are useful and the limitations are acceptable.

## Notebook changes do not persist

Vuepyter manages notebook state internally, but persistence is the host app's job. The component emits `update:modelValue` with a serialized notebook document, and the parent must store that value somewhere if it should survive re-renders, route changes, or page reloads.

This is the most common persistence misunderstanding:

- `autosaveInterval` does not write to disk, local storage, or a backend on its own.
- The save action does not send data to your server.
- If the parent ignores `update:modelValue`, edits disappear when the component is recreated.

Make sure the parent owns the notebook value:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Vuepyter } from 'vuepyter'

const notebook = ref(initialNotebook)
</script>

<template>
  <Vuepyter v-model="notebook" />
</template>
```

A few implementation details also matter here:

- When `autosaveInterval` is `false`, Vuepyter debounces `update:modelValue` by about 150 ms.
- When `autosaveInterval` is a positive number, Vuepyter flushes pending updates on that interval.
- Passing `null` after mount does not clear the internal notebook state. Pass a fresh notebook object if you want to replace the current document.

## Save and download behavior is different from autosave

Vuepyter has two separate persistence-related behaviors:

- Autosave and ordinary editing emit `update:modelValue`.
- The explicit save action emits `update:modelValue` and then downloads an `.ipynb` file in the browser.

That browser download uses `Blob` and `URL.createObjectURL`. It does not write to your server, and it does not replace your own persistence layer.

If the downloaded filename looks unexpected, check notebook metadata. Vuepyter uses `metadata.title` when it is present, sanitizes unsafe filename characters, and falls back to `Untitled.ipynb`.

## The notebook renders without styles or looks broken

Vuepyter ships its styles separately from the component code. If you render the component without importing the stylesheet, the notebook still mounts, but the layout, spacing, borders, and theme variables will not look correct.

Import the stylesheet once in your app entry or view setup:

```ts
import 'vuepyter/style.css'
```

A few related gotchas are worth checking:

- Do not import the stylesheet multiple times through different app entry points unless your bundler de-duplicates it cleanly.
- The default plugin export registers `Vuepyter` only. Import `CodeEditor` as a named export if you use it directly.
- The examples in `examples/` read from `vuepyter/dist/`, so you must build the package before opening them.

## The emitted notebook shape looks different from the input

Vuepyter accepts either an in-memory notebook shape or a serialized nbformat-like shape. Internally it normalizes the document, preserves unknown keys, generates missing cell ids, and fills in missing notebook structure.

The emitted value often surprises first-time users because it is always serialized for notebook storage. These differences are expected:

- Multiline `source` fields are emitted as arrays of strings.
- Some output fields are normalized and re-serialized through nbformat helpers.
- Empty notebooks become valid notebooks with a starter code cell unless you bypass the normal creation helpers.

If your app compares notebooks by raw JSON shape, compare normalized serialized output rather than comparing the original input object byte-for-byte.

## Rich output or markdown support looks narrower than expected

Vuepyter does not use a full CommonMark or GitHub Flavored Markdown engine. The markdown renderer is a custom subset parser with KaTeX support and HTML sanitization.

Output rendering also has some intentional limits:

- Rich HTML is sanitized before display.
- Arbitrary scripts in output HTML will not run.
- PNG output is handled as a first-class image path.
- Other MIME bundles may fall back to plain text or sanitized HTML.

Treat those limits as part of the security model rather than as rendering bugs.

## When to open an issue

If you still cannot isolate the problem, open an issue with enough detail to reproduce it quickly. Include the Vuepyter version, Vue version, browser, whether SSR is involved, your `pyodideUrl` override if any, and the smallest notebook or component snippet that fails.

The most useful reports also include the emitted `error` payload and the browser console message. Those two details usually point directly at the failing code path.

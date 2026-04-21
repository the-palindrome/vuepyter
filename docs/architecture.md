# Vuepyter Architecture

Vuepyter is structured around four cooperating layers: notebook state, kernel execution, notebook interaction, and rendering. The public component hides most of that machinery, but understanding the layers helps when you need to customize behavior or contribute to the codebase.

## System Overview

`Vuepyter.vue` is the orchestrator. It owns notebook state, initializes the Pyodide kernel, resolves theme variables, handles autosave and browser download behavior, and forwards notebook lifecycle events to consumers.

The rest of the component tree splits responsibilities cleanly:

- `EditorBar.vue` renders notebook-level actions and metadata.
- `Notebook.vue` manages active-cell state, keyboard handling, drag and drop, clipboard flows, undo/redo stacks, and cell-level metadata toggles.
- `Cell.vue` renders a single cell surface.
- `CodeEditor.vue`, `MarkdownRenderer.vue`, and `CellOutput.vue` handle the leaf rendering paths.

## Notebook State Flow

The notebook model starts in `useNotebookModel()`. This composable keeps a reactive `NotebookDocument`, exposes active-cell helpers, and centralizes structural operations such as add, insert, update, delete, move, and serialization.

The nbformat helpers in `src/utils/nbformat.ts` are the canonical data boundary:

- They normalize notebook, cell, and output shapes.
- They generate missing cell ids.
- They preserve unknown keys on notebooks, cells, and outputs.
- They convert multiline fields between strings in memory and arrays on serialization.

This means Vuepyter can accept slightly incomplete notebook data and still render it safely, while preserving metadata that belongs to other notebook tools.

## Execution Flow

`usePyodideKernel()` handles runtime loading and execution. The kernel tries these loading paths in order:

1. Dynamic import of the configured Pyodide URL.
2. Existing global `loadPyodide`.
3. Script injection through `document`.

After the runtime resolves, Vuepyter:

1. Loads `micropip`.
2. Installs `pyodidePackages`.
3. Runs `pyodideInitCode`.
4. Resolves and runs `preamble` when configured.
5. Syncs the workspace.
6. Emits the `ready` event.

`preamble` accepts inline Python or a `.py`/`.ipynb` path or URL. This stage is intended for one-time startup setup that should exist before notebook cell execution.

Cell execution is queued internally. Vuepyter never runs multiple Python cells at once in the same kernel instance, which keeps execution ordering predictable and avoids interleaved state mutations.

During execution, Vuepyter:

1. Marks the kernel as `busy`.
2. Captures stdout and stderr in batches.
3. Calls `runPythonAsync()`.
4. Converts the return value into an `execute_result` output when appropriate.
5. Formats exceptions into nbformat-style `error` outputs.
6. Syncs the workspace again and returns the kernel to `ready`.

## Workspace Sync Model

The workspace is a Vue ref backed by `pyodide.globals.toJs()`. Vuepyter filters out private names and functions before exposing that state through `workspace:sync` and the provide/inject helpers.

The default mode, `after-execution`, syncs the workspace after a cell finishes. The experimental `always-live` mode instruments top-level `for` and `while` loops and schedules extra sync passes during execution.

`always-live` does not provide full streaming output or arbitrary reactive Python execution. It is a best-effort workspace sync mode that improves long-running top-level loops.

## Interaction Layer

`Notebook.vue` is where notebook behavior becomes Jupyter-like. It manages:

- command mode and edit mode
- active-cell tracking
- keyboard shortcut dispatch through `useKeyboard()`
- clipboard copy, cut, paste, undo, and redo
- drag-and-drop reordering
- markdown preview versus markdown edit mode
- per-cell line number, source visibility, and output visibility state

The notebook root uses `role="application"` and actively manages focus so keyboard commands continue to work after cell execution and edit-mode transitions.

## Hidden Source And Output Metadata

Vuepyter reads and writes hidden-source and hidden-output flags through cell metadata. The implementation supports both Jupyter-style and VS Code-compatible keys, including:

- `jupyter.source_hidden`
- `inputCollapsed`
- `collapsed`
- `outputs_hidden`
- `outputCollapsed`

That compatibility layer helps Vuepyter round-trip notebooks that have already been edited in other notebook tools.

## Rendering Pipeline

Vuepyter uses different rendering paths for notebook content depending on the cell type and output type.

### Code Editing

`CodeEditor.vue` wraps CodeMirror through `useCodemirror()`. The composable configures:

- language mode for Python, Markdown, or raw text
- read-only state
- line numbers and line wrapping
- indentation and tab size
- placeholder text
- custom extensions
- light and dark themes

The editor also wires notebook-aware shortcuts such as run, split, exit edit mode, and edge navigation between cells.

### Markdown Rendering

`MarkdownRenderer.vue` uses the custom renderer in `src/utils/markdownRender.ts`. The markdown feature set includes:

- headings
- emphasis
- links and images
- lists
- fenced code blocks
- inline and block KaTeX math

The renderer sanitizes output after rendering. It is intentionally narrower than a full CommonMark or GFM implementation, which keeps the output predictable and easier to secure.

### Output Rendering

`CellOutput.vue` handles notebook outputs. It renders:

- `stream` output as text
- `error` output with ANSI-colored traceback formatting
- `display_data` and `execute_result` with sanitized HTML when `text/html` exists
- `image/png` output as an image
- plain text fallback for other data

HTML output is sanitized by `src/utils/htmlSanitize.ts`. The sanitizer allows a small, explicit tag and attribute set, preserves the attributes KaTeX needs for layout, and blocks unsafe URLs and disallowed tags.

## Save And Download Flow

Vuepyter treats model updates and file download as separate but coordinated actions:

- Notebook edits mark the model as dirty.
- `update:modelValue` emits the serialized notebook after a debounce or autosave interval.
- The save action flushes pending model updates immediately.
- The save action then downloads an `.ipynb` file with a sanitized filename derived from notebook metadata.

This design lets Vue applications persist the notebook reactively while still giving users a direct browser download path.

## Theme Model

Themes are CSS-variable driven. The package ships `light` and `dark` presets in `src/constants.ts`, and the root component merges a custom theme object on top of the selected preset when you pass one.

This approach keeps the visual system flexible without forcing consumers to rewrite component CSS from scratch. It also lets the CodeMirror themes pull from the same variable contract as the notebook shell.

## Architectural Boundaries

The current design has a few important boundaries that are worth knowing before you build on top of it:

- Vuepyter is browser-first. Pyodide loading and several rendering paths depend on browser APIs.
- `update:modelValue` emits serialized notebook data, even if the initial value was normalized.
- Unknown output types are preserved but normalized into renderable fallback output.
- `useKeyboard()` attaches to its configured target once and does not dynamically rebind when that target changes later.
- The markdown renderer is intentionally limited compared with full markdown engines.

Those boundaries are not defects. They are tradeoffs that keep the package small, predictable, and easy to ship as a standalone Vue library.

# Vuepyter Examples

The `examples/` directory shows how Vuepyter behaves in real browser pages. Each example combines a standalone HTML shell with a notebook file, so you can inspect both the host app code and the notebook content that drives it.

These demos use the local workspace build, not the published npm package. That choice keeps the examples aligned with the current checkout and makes them useful during package development.

## Run the Examples

Build the package first. The example pages import the generated files from [`vuepyter/dist/`](../vuepyter/dist), so they need a current build before you open them.

From the workspace root, run:

```bash
npm run build
npm run example
```

`npm run example` starts Vite at `http://localhost:5173` and opens the quickstart page at `/examples/quickstart/quickstart.html`. After the dev server starts, you can open the other examples directly:

- `http://localhost:5173/examples/quickstart/quickstart.html`
- `http://localhost:5173/examples/game-of-life/game-of-life.html`
- `http://localhost:5173/examples/nn-visualizer/nn-visualizer.html`
- `http://localhost:5173/examples/graph-theory/graph-theory.html`
- `http://localhost:5173/examples/cart-pole/cart-pole.html`

## How the Examples Are Structured

Each example follows the same basic shape. The HTML file creates a small Vue app, imports `Vuepyter` from the built module, fetches an `.ipynb` file, and binds it through `v-model`.

That pattern makes the demos easy to read because the host app code stays small. It also mirrors the production flow where your app owns notebook JSON and passes it into Vuepyter.

### Shared Import Pattern

The repository examples load the built assets directly. You can see that import pattern at the top of each HTML file.

```html
<link rel="stylesheet" href="../../vuepyter/dist/vuepyter.css" />
<script type="module">
  import { Vuepyter } from '/vuepyter/dist/index.mjs'
</script>
```

When you adapt an example into a normal Vue app, switch to the package import path instead:

```ts
import { Vuepyter } from 'vuepyter'
import 'vuepyter/style.css'
```

## Quickstart Example

The quickstart example is the simplest and most reusable reference. It lives in [`examples/quickstart/quickstart.html`](../examples/quickstart/quickstart.html) and loads [`examples/quickstart/quickstart.ipynb`](../examples/quickstart/quickstart.ipynb).

The page renders a two-pane layout. The left pane shows the current notebook JSON, and the right pane renders Vuepyter with `v-model` plus a short `autosaveInterval`.

### What It Demonstrates

- Loading a notebook from a local `.ipynb` file with `fetch()`.
- Binding notebook JSON directly to `v-model`.
- Watching Vuepyter emit serialized notebook updates by mirroring the JSON in a side panel.
- Using a light theme override through CSS variables.
- Working with markdown, code execution, and KaTeX math in one small notebook.

### Why It Matters

This example is the closest match to a package consumer's first integration. If you want to drop Vuepyter into an existing Vue app, start here before you look at the more interactive demos.

The notebook content is intentionally small. It includes a markdown welcome cell, a simple Python cell that evaluates `40 + 2`, a KaTeX block, and an empty cell for further editing.

## Game of Life Example

The Game of Life example lives in [`examples/game-of-life/game-of-life.html`](../examples/game-of-life/game-of-life.html) and loads [`examples/game-of-life/game-of-life.ipynb`](../examples/game-of-life/game-of-life.ipynb). It pairs the notebook editor with a canvas-based viewer that renders the current board state.

The host page keeps a reference to the Vuepyter instance and to the `pyodide` runtime exposed by the `ready` event. After both the notebook and kernel are ready, the page auto-runs all cells and then reads the `game` object out of Python to draw the board.

### What It Demonstrates

- Using the `ready` event to capture the live Pyodide instance.
- Calling `executeAllCells()` on the Vuepyter component instance through a template ref.
- Pulling structured state out of Python with `pyodide.runPythonAsync(...)`.
- Keeping a non-notebook canvas view in sync with notebook-defined state.
- Handling larger, stateful Python objects across multiple notebook cells.

### Why It Matters

This example shows that Vuepyter can act as the control surface for a richer browser app. The notebook defines the simulation model, while the host page owns layout, camera controls, and rendering.

The notebook itself also shows metadata compatibility in practice. Its first code cell starts hidden using `source_hidden`, `inputCollapsed`, `collapsed`, and Jupyter metadata keys that Vuepyter understands.

## NN Visualizer Example

The nn-visualizer example lives in [`examples/nn-visualizer/nn-visualizer.html`](../examples/nn-visualizer/nn-visualizer.html) and loads [`examples/nn-visualizer/nn-visualizer.ipynb`](../examples/nn-visualizer/nn-visualizer.ipynb). It uses the same split-pane shell as the Game of Life example, but leaves both panes intentionally empty.

### What It Demonstrates

- Starting from a resizable two-pane example layout without any seeded visualization logic.
- Loading a valid but empty notebook document into Vuepyter.
- Keeping the host page ready for a custom canvas, SVG, or DOM-based viewer in the left pane.
- Using the examples folder as a scaffold for a new interactive notebook-driven tool.

### Why It Matters

This example is the cleanest starting point when you want the Game of Life layout but do not want any inherited simulation code or notebook content. You can drop in your own viewer on the left and build up notebook cells on the right from scratch.

## Graph Theory Example

The graph-theory example lives in [`examples/graph-theory/graph-theory.html`](../examples/graph-theory/graph-theory.html) and loads [`examples/graph-theory/graph-theory.ipynb`](../examples/graph-theory/graph-theory.ipynb). It keeps the same resizable split-pane shell as the other examples, but starts with an intentionally blank left pane and an empty notebook.

### What It Demonstrates

- Starting from a clean two-pane scaffold without inherited visualization logic.
- Loading an empty notebook document with valid Jupyter metadata.
- Reserving the left pane as an empty canvas area for future graph rendering work.

### Why It Matters

This example is useful when you want to prototype graph algorithms or network visualizations without removing starter content first. You can build both the notebook cells and the left-side renderer from a fully blank state.

## Cart-Pole Example

The Cart-Pole example lives in [`examples/cart-pole/cart-pole.html`](../examples/cart-pole/cart-pole.html) and loads [`examples/cart-pole/cart-pole.ipynb`](../examples/cart-pole/cart-pole.ipynb). It presents a real-time inverted-pendulum simulation beside the notebook editor.

The host page auto-runs the notebook, starts a simulation loop, and uses Pyodide calls to exchange state with Python over time. The result feels more like an interactive lab than a static document viewer.

### What It Demonstrates

- Long-lived browser-side simulation state defined in notebook code.
- A host-managed animation loop that keeps reading and applying notebook state.
- Two-way interaction between canvas gestures and Python objects.
- A notebook that mixes explanation, model code, controller code, and reset workflows.
- A more advanced integration that still uses standard Vuepyter events and refs.

### Why It Matters

This example is the best showcase for embedding a notebook into a larger product workflow. It demonstrates that Vuepyter is not limited to educational text and one-off code cells. You can use it as part of a continuously updating interface with custom rendering and controls.

The notebook content also makes the editing story concrete. Users can tune controller gains, switch between manual and automatic balance modes, re-run cells, and watch the left-side visualization react.

## Choose the Right Starting Point

Pick the example that matches the shape of the app you want to build:

- Start with `quickstart` when you need a standard notebook editor with `v-model`.
- Start with `game-of-life` when you need a notebook to feed state into a custom visualization.
- Start with `nn-visualizer` when you want a blank split-pane visualization starter.
- Start with `graph-theory` when you want a completely blank split-pane scaffold for graph work.
- Start with `cart-pole` when you need an interactive application loop that both reads from and writes to the Python runtime.

If you are new to the codebase, read the quickstart example first even if you eventually want one of the interactive demos. It has the smallest surface area and makes the `v-model` data flow easiest to follow.

## Move an Example into a Real App

When you promote one of these demos into an application component, keep the structure but swap out the repository-specific paths. Move the inline `createApp(...)` code into a normal `.vue` file, replace the `dist/` imports with `vuepyter` package imports, and keep the notebook fetch or API load that matches your app.

You should also keep the client-only assumption in mind. Every example runs entirely in the browser because Pyodide is a browser runtime, so SSR apps should mount the notebook editor only on the client.

## Related Files

These files are useful when you want to go deeper after reading the examples:

- [`vuepyter/README.md`](../vuepyter/README.md) for installation and base package usage.
- [`docs/tutorial-build-a-notebook-app.md`](./tutorial-build-a-notebook-app.md) for a package-consumer tutorial.
- [`docs/keyboard-shortcuts.md`](./keyboard-shortcuts.md) for command-mode and edit-mode shortcuts.
- [`vuepyter/src/components/Vuepyter.vue`](../vuepyter/src/components/Vuepyter.vue) for the root component API and event surface.

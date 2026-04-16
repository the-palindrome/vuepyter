# Vuepyter Documentation

Vuepyter is a Vue 3 notebook editor that renders Jupyter-style cells, keeps notebook state in sync with `v-model`, and runs Python in the browser with Pyodide.

This directory collects the full documentation suite for users and contributors. Start with the pages below based on what you need next.

## Start Here

- [Getting Started](./getting-started.md) explains installation, the first notebook binding, client-side requirements, and Pyodide setup.
- [Build a Notebook App](./tutorial-build-a-notebook-app.md) walks through a fuller integration with notebook loading, state syncing, events, and customization.
- [API Reference](./api-reference.md) documents the exported components, composables, events, slots, and data model.
- [Architecture](./architecture.md) explains how the notebook model, kernel, rendering pipeline, and UI layers fit together.

## Examples And Operations

- [Examples Guide](./examples.md) explains what each example demonstrates and when to use it.
- [Keyboard Shortcuts](./keyboard-shortcuts.md) lists the Jupyter-style command and edit mode shortcuts implemented by Vuepyter.
- [Troubleshooting](./troubleshooting.md) covers SSR, Pyodide loading, styling, save behavior, and common runtime issues.
- [Contributing](./contributing.md) explains the repository layout, test strategy, release flow, and local development workflow.

## Recommended Reading Order

1. Read [Getting Started](./getting-started.md) if you are integrating Vuepyter into an app for the first time.
2. Continue with [Build a Notebook App](./tutorial-build-a-notebook-app.md) if you want a more realistic integration pattern.
3. Keep [API Reference](./api-reference.md) open while you add events, slots, or custom editor behavior.
4. Use [Architecture](./architecture.md) and [Contributing](./contributing.md) when you need to work inside the codebase itself.

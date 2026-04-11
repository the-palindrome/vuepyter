# vuepyter workspace

This repository is organized as a workspace root.

## Structure

- `vuepyter/` — the Vuepyter package (source, tests, build config, npm scripts)
- `docs/` — documentation content
- `examples/` — usage examples and demos
- `SPEC.md` — implementation specification

## Getting started

Install dependencies in the package once:

```bash
cd vuepyter
npm install
```

Then you can run commands from either location.

From the repository root:

```bash
npm run typecheck
npm run test
npm run build
```

Or directly from the package:

```bash
cd vuepyter
npm run typecheck
npm run test
npm run build
```

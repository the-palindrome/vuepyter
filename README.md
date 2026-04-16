# vuepyter workspace

This repository is organized as a workspace root.

## Structure

- `vuepyter/` — the Vuepyter package (source, tests, build config, npm scripts)
- `docs/` — documentation content
- `examples/` — usage examples and demos

## Documentation

The repository now includes a full documentation suite in [`docs/`](./docs/README.md):

- [Getting Started](./docs/getting-started.md)
- [Build a Notebook App](./docs/tutorial-build-a-notebook-app.md)
- [API Reference](./docs/api-reference.md)
- [Architecture](./docs/architecture.md)
- [Examples Guide](./docs/examples.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Contributing](./docs/contributing.md)
- [Keyboard Shortcuts](./docs/keyboard-shortcuts.md)

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
npm run release:check
```

Or directly from the package:

```bash
cd vuepyter
npm run typecheck
npm run test
npm run build
npm run release:check
```

## Publishing

The npm package is published from the `vuepyter/` subdirectory.

- Pull requests run the package test suite, build, and `npm pack --dry-run` in CI.
- Releases are automated from `.github/workflows/release.yml` on pushes to `main`.
- The release workflow uses npm trusted publishing with GitHub Actions OIDC and publishes from `vuepyter/`.

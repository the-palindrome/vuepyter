# Contributing to Vuepyter

Vuepyter is a small workspace with one publishable package at its center. The root of the repository mainly exists to make common commands easier to run, while the real library source, tests, and packaging logic live in `vuepyter/`.

This page explains how the repository is organized, how to build and test it locally, and how the release workflow works today. It also calls out the runtime assumptions that matter when you change notebook behavior, Pyodide integration, or the public package surface.

## Repository layout

The repository separates workspace conveniences from package code. Start with the following mental model before you make changes:

```text
/workspaces/vuepyter
├── package.json                 # Root command delegator
├── docs/                        # Project documentation
├── examples/                    # Standalone HTML demos and sample notebooks
├── .github/workflows/           # CI and release automation
└── vuepyter/                    # Publishable npm package
    ├── src/                     # Components, composables, utils, themes, types
    ├── tests/                   # Unit, component, composable, util, and e2e tests
    ├── scripts/                 # Packaging helpers
    ├── package.json             # Package metadata and scripts
    ├── vite.config.ts           # Library build config
    └── README.md                # Package-facing getting-started guide
```

The root `package.json` forwards `build`, `test`, `typecheck`, `pack:check`, and `release:check` to `vuepyter/`. Use the root when you want quick workspace commands. Work inside `vuepyter/` when you need the full package context, the local lockfile, or direct access to package-only scripts such as end-to-end tests.

## Local setup

Install dependencies in the package directory, because that is where the lockfile lives and where CI runs `npm ci`. Match CI as closely as possible when you debug environment-specific issues.

CI currently runs Node.js 20 for pull request validation and Node.js 24 for the release workflow. You do not need both versions locally, but reproducing PR failures is easiest on Node.js 20.

Run the package install first:

```bash
cd vuepyter
npm ci
```

After the package dependencies are installed, you can run either root-level wrapper commands or package-level commands. The wrapper commands are useful when you stay at the repository root:

```bash
npm run build
npm run test
npm run typecheck
```

The package-level commands give you the full script surface:

```bash
cd vuepyter
npm run build
npm test
npm run test:e2e
npm run release:check
```

## Build workflow

The library build uses Vite in library mode. `vuepyter/vite.config.ts` builds both ESM and CommonJS entries from `src/index.ts`, keeps `vue` external, and generates declaration files with `vite-plugin-dts`.

The build is two steps because the CommonJS export also needs a declaration entrypoint. `npm run build` runs Vite, then `scripts/prepare-package.mjs` copies `dist/index.d.ts` to `dist/index.d.cts`.

Use the standard build when you change any public component, type, export, or stylesheet behavior:

```bash
cd vuepyter
npm run build
```

The published package exports:

- `dist/index.mjs`
- `dist/index.cjs`
- `dist/index.d.ts`
- `dist/index.d.cts`
- `dist/vuepyter.css`

The default plugin export registers `Vuepyter` only. `CodeEditor` is a named export, so changes to editor-only behavior should be checked through direct imports as well as through the main component.

## Examples and manual verification

The `examples/` directory contains standalone HTML demos that import the local workspace build rather than the published npm package. Build the package before you open an example, or the demo page will point at missing files in `vuepyter/dist/`.

Use the quickstart example when you want the closest match to a consumer setup:

```bash
npm run build
npm run example
```

The other examples exercise longer-lived notebook state and interactive execution patterns:

- `examples/quickstart/` covers loading, editing, executing, and LaTeX rendering.
- `examples/game-of-life/` covers iterative notebook state and repeat execution.
- `examples/cart-pole/` covers real-time interaction with notebook-driven logic.

## Test workflow

The package uses several layers of automated tests. Run the narrowest suite that covers your change first, then finish with the broader checks before you open a pull request.

Use the fast validation path for most code changes:

```bash
cd vuepyter
npm run typecheck
npm test
```

Run the browser-level suite when you change notebook interaction, keyboard behavior, execution, or save flows:

```bash
cd vuepyter
npm run test:e2e
```

Run the release gate before publishing changes to the package surface:

```bash
cd vuepyter
npm run release:check
```

`release:check` runs the same core checks that matter for a publishable build:

- TypeScript checking with `vue-tsc`
- Unit and component tests with Vitest
- Package build
- `npm pack --dry-run`
- `publint`
- `attw` export and type validation

## CI workflow

Pull request validation lives in `.github/workflows/pr-tests.yml`. It runs on Ubuntu, installs dependencies in `vuepyter/`, installs Playwright Chromium, and then runs the full validation chain for a proposed change.

Expect CI to check the same categories you should verify locally before review:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run pack:check`
- `npm run lint:pkg`
- `npm run lint:types`
- `npm run test:e2e`

If a change touches packaging, types, or browser behavior, reproduce the failing CI step locally from `vuepyter/` before you iterate on the fix. That usually gives you faster feedback than waiting on another full workflow run.

## Test organization

The test tree is broad by design. It mixes newer grouped suites with a small set of older top-level files, so expect to see some overlap in naming.

Use this guide when you decide where a new test belongs:

- `tests/components/` covers rendered UI behavior such as cell actions, toolbar flows, markdown rendering, and notebook interaction.
- `tests/composables/` covers stateful logic such as notebook modeling, keyboard handling, Pyodide integration, and provide/inject helpers.
- `tests/utils/` covers serialization, sanitization, ANSI formatting, markdown parsing, and related pure helpers.
- `tests/e2e/` contains the Playwright harness, app shell, and Pyodide stub used for browser-level tests.
- Top-level `tests/*.test.ts` files contain some older or compatibility-oriented suites that still validate important behavior.

`tests/setup.ts` defines shared JSDOM assumptions and polyfills `ResizeObserver`, `crypto.randomUUID`, and `Range` geometry methods. If a test fails only in JSDOM, check that file before you add new environment shims.

## Release workflow

The release pipeline lives in `.github/workflows/release.yml`. It installs dependencies, runs the same validation steps as `release:check`, and publishes from `vuepyter/` with npm provenance when the version in `vuepyter/package.json` is not already on npm.

That version check matters. A push to `main` does not publish a second time if the package version already exists in the registry.

Prepare a release in two stages:

1. Update the package version and changelog content in `vuepyter/`.
2. Merge the validated change to `main` so the release workflow can publish it.

The package includes a helper for the versioning step:

```bash
cd vuepyter
npm run release:version
```

`release:version` runs `changelogen --release` and then bumps `vuepyter/package.json` with `bumpp`. Review the generated changes before you commit them.

## Runtime assumptions contributors should keep in mind

Vuepyter runs Pyodide in the browser. Any change to kernel setup, execution, save flows, or rendering should be tested with the assumption that `window`, `document`, `Blob`, and `URL.createObjectURL` are available only on the client.

A few implementation details show up in user-facing behavior often enough that contributors should know them before making changes:

- `v-model` accepts normalized notebook objects or serialized nbformat-shaped objects, but `update:modelValue` always emits the serialized form.
- Multiline cell sources and some output fields are emitted as arrays because Vuepyter serializes them back to nbformat conventions.
- An empty or invalid notebook normalizes to a valid document with a starter code cell by default.
- `autosaveInterval` controls how often pending changes emit `update:modelValue`. It does not write to a server or local storage by itself.
- The save action emits `update:modelValue` and then downloads an `.ipynb` file in the browser.
- Consumers must import `vuepyter/style.css` once or the component will render without its intended layout and theme styles.

These details are easy to miss when a local change looks correct in component tests. Keep them in mind when you review public-facing behavior, documentation updates, and bug reports.

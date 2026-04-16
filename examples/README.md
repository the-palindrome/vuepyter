# examples

This folder contains simple usage examples for `vuepyter`.

For a fuller walkthrough of what each example teaches, see [docs/examples.md](../docs/examples.md).

## Files

- `quickstart/quickstart.html` - runnable quickstart example page.
- `quickstart/quickstart.ipynb` - notebook used by the quickstart page.
- `game-of-life/game-of-life.html` - two-panel game-of-life starter layout with an empty left pane.
- `game-of-life/game-of-life.ipynb` - blank notebook used by the game-of-life example.
- `nn-visualizer/nn-visualizer.html` - two-panel blank visualizer starter with an empty left pane and empty notebook.
- `nn-visualizer/nn-visualizer.ipynb` - empty notebook used by the nn-visualizer starter.
- `cart-pole/cart-pole.html` - two-panel real-time inverted-pendulum example with a minimalist physics visualization.
- `cart-pole/cart-pole.ipynb` - notebook used by the cart-pole example, including a simple stabilizing controller.

## Run the standalone HTML example

From the workspace root:

```bash
npm run build
npm run example
```

`npm run example` opens `http://localhost:5173/examples/quickstart/quickstart.html` automatically.

If your machine still reports `ENOSPC` watcher errors, increase Linux inotify limits:

```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
echo fs.inotify.max_user_instances=1024 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## Use the published package

The HTML examples in this folder import Vuepyter from the local workspace build so they stay in sync during development:

```html
<link rel="stylesheet" href="../../vuepyter/dist/vuepyter.css" />
<script type="module">
  import { Vuepyter } from '/vuepyter/dist/index.mjs'
</script>
```

When you test the installed npm package in your own Vue app, switch those paths to the published package name instead:

```ts
import { Vuepyter } from 'vuepyter'
import 'vuepyter/style.css'
```

The quickstart example is the closest match to the npm consumer flow, so it is the best starting point for a new app.

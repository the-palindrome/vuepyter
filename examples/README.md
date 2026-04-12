# examples

This folder contains simple usage examples for `vuepyter`.

## Files

- `quickstart/quickstart.html` - runnable quickstart example page.
- `quickstart/quickstart.ipynb` - notebook used by the quickstart page.
- `game-of-life/game-of-life.html` - two-panel game-of-life starter layout with an empty left pane.
- `game-of-life/game-of-life.ipynb` - blank notebook used by the game-of-life example.

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

# examples

This folder contains simple usage examples for `vuepyter`.

## Files

- `simple-example.html` - standalone browser-runnable example (no bundler required for the example page).

## Run the standalone HTML example

From the workspace root:

```bash
npm run build
npm run example
```

`npm run example` opens `http://localhost:5173/examples/simple-example.html` automatically.

If your machine still reports `ENOSPC` watcher errors, increase Linux inotify limits:

```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
echo fs.inotify.max_user_instances=1024 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

# Launchpad

A local dashboard for every project in `claude-sandbox`: thumbnail, title, last-edited date,
one-click Run/Stop for localhost, and the Railway URL when there is one.

## Start it

Double-click `Launchpad.command`, or:

```
cd launchpad && npm start      # http://localhost:4400
```

No dependencies — plain Node. Stopping Launchpad (Ctrl-C) also stops any servers it started.

## How it works

- **Projects** — every top-level folder in `claude-sandbox` shows up automatically. New folders
  get a guessed type (`npm run dev` if there's a package.json, otherwise served as static files).
  Hidden folders are listed under `hidden` in `projects.json`.
- **Details** — `projects.json` holds titles, descriptions, ports, start commands, Railway URLs
  and notes. Edit it by hand or via ⋯ → Edit details in the UI.
- **Last edited** — newest file modification time in the folder, ignoring `node_modules`, `dist`, `.git`.
- **Run / Stop** — servers run their start command in a login shell; static sites are served
  with `python3 -m http.server`. Stop also works for servers you started in a terminal (it stops
  whatever is listening on that project's port).
- **Thumbnails** — ⋯ → Capture thumbnail screenshots the running app with headless Chrome into
  `thumbnails/<folder>.jpg`. Static sites can be captured without running them first, and a
  server's first Run captures one automatically. You can also drop in your own image with the same name.

# Goal Tracker

Minimal daily tracker for Ansible + UMGC, backed by real `localStorage`
(no backend, no auth — on purpose, for now).

## Run it

```bash
npm install
npm run dev
```

Then open the printed `localhost` URL. Data persists in your browser's
localStorage — closing the tab or restarting your laptop won't lose it.
Opening it in a *different* browser or device will, since localStorage
is per-browser, not synced.

## Where the data lives

Open your browser devtools → Application tab → Local Storage → your
localhost origin. You'll see a key called `goalTrackerHistory` holding
a JSON string like:

```json
{
  "2026-08-11": { "ansible": 8, "umgc": 1 },
  "2026-08-12": { "ansible": 5, "umgc": 0 }
}
```

## Editing goals/targets

`src/App.jsx` — edit the `ACTIVE_GOALS` and `BACKLOG` arrays at the top
of the file directly. No UI for this yet (intentional — v1 scope).

## Next steps (not yet — after Ansible/UMGC deadlines)

- PWA installability: `npm install -D vite-plugin-pwa`, add to
  `vite.config.js`, add a manifest + icons.
- Self-hosted sync backend (PocketBase, through your existing Tailscale
  / Cloudflare tunnel) once localStorage's single-device limit is
  actually a problem you're feeling, not a hypothetical one.

# Goal Tracker

Minimal daily tracker for Ansible + UMGC. Syncs across devices through a
self-hosted [PocketBase](https://pocketbase.io) instance; `localStorage`
stays underneath as an instant-write offline cache.

## Run it

```bash
npm install
cp .env.example .env   # point VITE_POCKETBASE_URL at your PocketBase instance
npm run dev
```

Then open the printed `localhost` URL. You'll land on a login screen —
see "Sync backend" below for how to stand up PocketBase and create your
account. Once logged in, data persists both in your browser's
localStorage (instant, works offline) and in PocketBase (synced across
devices). Log in with the same account on another device to pick up
where you left off.

## Sync backend (PocketBase)

The repo includes everything needed to self-host the sync server:

```bash
docker compose up -d --build
```

This builds and runs PocketBase (schema in `pb_migrations/` is applied
automatically) on port 8090, backed by SQLite in `./pb_data` (gitignored).
Run it wherever you like — the README's original plan was to expose it
through an existing Tailscale/Cloudflare tunnel rather than the open
internet.

First-time setup:

1. Open `http://<host>:8090/_/` and create the PocketBase admin account
   (superuser, separate from your app login).
2. In the Admin UI, go to the `users` collection and create the one user
   account you'll log into the app with. Public self-registration is off
   on purpose — this is a single-user app.
3. Set `VITE_POCKETBASE_URL` (in `.env` for dev, or your build environment
   for a deployed build) to wherever PocketBase is reachable from your
   devices, then log in from the app.

**Sync model**: whole-blob, last-write-wins. Each login pulls your whole
`goal_data` record on load and pushes the whole thing (debounced ~800ms)
after each change — there's no field-level merge. If you edit offline on
two devices before either reconnects, whichever device's push reaches the
server last wins. Fine for one person using two devices sequentially; not
built for concurrent editing.

## Where the data lives

The `goal_data` collection in PocketBase (one record per user, `goals` +
`history` JSON fields — same shape as the two keys below) is the source
of truth. localStorage mirrors it locally so the app loads instantly and
keeps working offline; it's a cache, not the primary store, now.

Open your browser devtools → Application tab → Local Storage → your
localhost origin to see the local cache. You'll see two keys:

- `goalTrackerGoals` — the goal *definitions* themselves: title, `type`
  (`project` | `skill` | `habit` | `log`), color, and either a
  `dailyTarget` + `unit` (for goals tracked by a manually-entered daily
  count) or a `subtasks[]` array (for goals whose progress derives from
  subtasks checked off, e.g. a UMGC unit = reading + assignment +
  discussion). Only `project` goals carry a `status` of `active` or
  `backlog` — it's what the Today/Backlog tabs and the WIP limit key
  off of. Skills, habits, and logs ignore `status` entirely: every
  skill always shows on the Skills tab, every habit and every log
  always shows on Today.

  ```json
  [
    {
      "id": "umgc",
      "title": "UMGC Cybersecurity",
      "type": "project",
      "status": "active",
      "subtasks": [
        { "id": "reading", "label": "Reading", "done": false },
        { "id": "assignment", "label": "Assignment", "done": false },
        { "id": "discussion", "label": "Discussion", "done": false }
      ]
    }
  ]
  ```

- `goalTrackerHistory` — the daily log, keyed by date, holding the
  manually-entered amount per goal id (only meaningful for goals that
  don't use `subtasks`). For `log`-type goals, the per-day value is an
  array of entries instead of a number:

  ```json
  {
    "2026-08-11": { "ansible": 8 },
    "2026-08-12": {
      "ansible": 5,
      "notes": [
        { "id": "...", "text": "Fixed the router VLAN issue", "time": "2026-08-12T15:54:08.661Z" }
      ]
    }
  }
  ```

## Tabs

- **Today** (default) — active projects + every habit + every log,
  regardless of status. Only active projects and habits count toward
  the streak and "Done for today" header — logs have no target, so
  they're excluded from that calculation.
- **Skills** — every skill goal, always, tracked by its own daily
  cadence. Skills don't participate in Today's streak.
- **Backlog** — projects with `status: 'backlog'`, i.e. not currently
  active. Each row has an **Activate** button to promote it.
- **History** — read-only. Every log entry across every log goal,
  grouped by date (most recent first), newest entry first within a
  date.

## WIP limit

Only 2 projects can be `active` at once. Trying to activate a 3rd
(from the New goal form, editing a project's Status to Active, or the
Backlog tab's Activate button) is blocked until you pick one of the
current 2 to swap out — it gets moved to backlog automatically when
you save. Skills and habits aren't limited.

## Editing goals/targets

Use the "New goal" button (its defaults follow whichever tab you're
on), or the pencil/trash icons on each card/row. The form's fields
change based on the selected type:

- **Project** — target + unit (optional), deadline (optional), an
  optional subtasks checklist, and Active/Backlog status (subject to
  the WIP limit above). Progress derives from subtasks checked when
  subtasks exist, otherwise from target vs. amount logged.
- **Skill** — a daily target + unit (its cadence), tracked with the
  +/− counter.
- **Habit** — just a title. Tracked with a single "Mark done" toggle
  per day.
- **Log** — just a title. Tracked with a free-text input; each entry
  is timestamped and appended to a running list for the day, newest
  first. Entries can be deleted individually from the Today card (the
  History tab itself is read-only).

Deleting a goal asks for confirmation first. `DEFAULT_GOALS` in
`src/App.jsx` is only the seed used the first time the app runs with
no saved goals yet — it has no effect once `goalTrackerGoals` exists.

## Next steps (not yet — after Ansible/UMGC deadlines)

- PWA installability: `npm install -D vite-plugin-pwa`, add to
  `vite.config.js`, add a manifest + icons.

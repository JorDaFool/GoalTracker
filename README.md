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
localhost origin. You'll see two keys:

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
- Self-hosted sync backend (PocketBase, through your existing Tailscale
  / Cloudflare tunnel) once localStorage's single-device limit is
  actually a problem you're feeling, not a hypothetical one.

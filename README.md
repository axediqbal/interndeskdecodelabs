# InternDesk

**Live:** https://interndesk.vercel.app

DecodeLabs **Project 4: Frontend & Backend Integration** — an intern directory &
management console. Search, filter, create, edit (inline PATCH + full PUT),
delete, and a live **Chaos toggle** that demos loading/error states on real
requests.

## Run it (local)

```bash
cd backend
npm install
npm start
```

Open **http://localhost:3000**. The same process serves the API and the UI —
no second terminal, no build step. Data persists in `backend/data/interndesk.sqlite`
(the 18 seed interns load only on first boot; your changes survive restarts).

> Screenshots of the running app live in `screenshots/` if you want a
> preview before starting it.

## Deploy it (Vercel + Turso)

Vercel's filesystem is read-only, so a local SQLite file can't take writes
there. The DB layer (`backend/src/db.js`) uses **libsql**: locally it opens the
same file DB with zero config; on Vercel it talks to a hosted **Turso**
database when `TURSO_DATABASE_URL` is set. Same SQL, same code path.

**1. Create the Turso database** (free, ~2 minutes):
- Go to [turso.tech](https://turso.tech) → sign up (GitHub works) → **Create Database**
- Name it `interndesk` (region closest to you), open it → copy the **URL**
  (`libsql://…turso.io`) → **Tokens** → create a token → copy it

**2. Push this repo to GitHub**, then on [vercel.com/new](https://vercel.com/new)
import the repo. No build settings to change — `vercel.json` already routes
`/api/*` to the serverless function and everything else to the static frontend.

**3. Add environment variables** in the Vercel project → Settings → Environment
Variables (all environments):
- `TURSO_DATABASE_URL` = the `libsql://…` URL
- `TURSO_AUTH_TOKEN` = the token

Redeploy. The first API hit creates the table and seeds the 18 interns
automatically (`seedIfEmpty` runs on boot) — the live app is fully
functional: search, filter, add, edit, delete.

> Local dev needs none of this — without those env vars the app just uses
> `backend/data/interndesk.sqlite` like before.

## Architecture — Input → Process → Output

```
                         InternDesk — IPO across the real stack

  ┌──────────────┐   HTTP fetch (apiClient.js)   ┌───────────────────┐   SQL (libsql)        ┌──────────────┐
  │   BROWSER    │ ───────────────────────────▶ │   EXPRESS API     │ ───────────────────▶ │   SQLite       │
  │              │ ◀─────────────────────────── │                   │ ◀─────────────────── │ interns table  │
  │ Vanilla JS   │   JSON + real status codes    │ validate → route  │   rows               │  (18 seeded) │
  │ ES modules   │   {error:{code,message}}      │ → rowToIntern()   │                      └──────────────┘
  │              │                               └───────────────────┘
  │  INPUT: search text, filter chips,          PROCESS: validation (422),
  │  forms, chaos toggles                        status codes (never 200-for-errors),
  │  OUTPUT: cards, drawer, toasts,              chaos simulator (?simulateLatency /
  │  skeleton/empty states                       ?simulateError)
  └──────────────┘
         ▲  network rail: every fetch pulses the 3px left-edge bar —
         │  indigo while in flight, green 2xx, amber 4xx, red 5xx/network
         └─────────────────────────────────────────────────────────────────────
```

**Request lifecycle** (what the rail makes visible): user input → `apiClient.request()`
→ rail `start` (indigo pulse) → Express route → validate → SQLite → JSON +
status code → rail `ok`/`clientError`/`serverError` → view renders or toast fires.
`finally` always clears loading state — success or failure.

## 60-second demo script (error states, live)

1. **0:00** — Open the app. Point at the left-edge **rail** and the green **API dot**.
   Everything you do in the next minute moves both.
2. **0:10** — Search `sana` → 1 card. Clear it. Click **Active** chip → 10 cards.
3. **0:20** — Open **Chaos** (sliders icon, top right) → enable **latency**. Hit Active
   again: skeleton cards pulse ~1.5s, rail pulses indigo, page never freezes.
4. **0:35** — Enable **simulate errors** too → any click now: rail flashes red, toast
   *"Something's wrong on our end (SIMULATED_FAILURE). Retry in a moment."* —
   grid keeps its data, nothing crashes.
5. **0:50** — Chaos off → **New intern** → submit with an empty email: per-field red
   error appears *before* any request; submit `not-an-email` → server 422 mapped
   back under the Email field. No generic toast.
6. **1:00** — Done. That was 5 real HTTP verbs, 3 failure modes, zero fakes.

## API reference

Base: `/api`. List returns `{ data: [...], meta: { count } }`; single/mutations
return `{ data: {...} }`. Errors always `{ error: { code, message[, fields] } }`.

| Method | Route | Success | Errors |
|---|---|---|---|
| GET | `/api/interns?status=&q=` | 200 | 400 bad `status` filter |
| GET | `/api/interns/:id` | 200 | 404 |
| POST | `/api/interns` | 201 | 422 validation (`fields` map) |
| PUT | `/api/interns/:id` | 200 | 404, 422 |
| PATCH | `/api/interns/:id` | 200 | 404, 422 (empty body too) |
| DELETE | `/api/interns/:id` | 204 (no body) | 404 |
| GET | `/api/health` | 200 `{status, interns, time}` | — |

**Chaos params** (work on any `/api/interns*` route, documented not hidden):
`?simulateLatency=1500` waits N ms (capped 5000); `?simulateError=true` returns
`500 { error: { code: "SIMULATED_FAILURE", … } }`. The frontend Chaos toggle just
appends these to real requests.

**Intern shape:** `{ id, name, email, cohort, role, status: "active"|"alumni"|"pending", startDate, phone|null, avatarSeed }`

## Project structure

```
interndesk/
├── api/
│   └── index.js       # Vercel serverless entry — mounts the Express app for /api/*
├── vercel.json        # rewrites: /api/* → function, everything else → /frontend/*
├── package.json       # workspace root (backend) — used by Vercel's install
├── backend/
│   ├── src/
│   │   ├── server.js      # entry — listen + banner (local dev)
│   │   ├── app.js         # Express: CORS, chaos, 5 verbs, error envelope, static frontend
│   │   ├── db.js          # libsql: local file DB, or Turso when TURSO_DATABASE_URL is set
│   │   ├── seed.js        # 18 interns, inserted once (also self-seeds on Vercel)
│   │   └── validators.js  # shared POST/PUT/PATCH validation
│   └── data/              # interndesk.sqlite (created on boot, local only)
├── frontend/
│   ├── index.html
│   ├── css/styles.css     # "Midnight Console" design system (dark, 2026-09-27)
│   └── js/
│       ├── app.js         # boot (Promise.all), toolbar, chaos wiring, hero typewriter
│       ├── apiClient.js   # the ONLY fetch() in the codebase
│       ├── rail.js        # network-rail signalling
│       ├── toast.js       # 4xx vs 5xx human messaging
│       ├── store.js       # tiny pub/sub state
│       ├── dom.js         # el()/textContent helpers, avatars, dates
│       ├── icons.js       # custom line icons (static, trusted)
│       └── views/         # directory.js, drawer.js, internForm.js
├── TESTING.md             # manual matrix with actual verified results
└── README.md
```

## Engineering notes (the graded rules, where they live)

- `async/await` only — `grep "\.then(" frontend/js` returns nothing.
- `try/catch/finally` on every async handler; `finally` clears loading/busy.
- `response.ok` checked before `response.json()`; failures throw `ApiError`
  carrying the server's `{error:{code,message,fields}}` envelope.
- Independent parallel requests use `Promise.all()` (boot: health + list).
- User data rendered via `textContent` only (`dom.js el()`); `innerHTML` only
  for the static icon constants in `icons.js`.
- One `apiClient` module; CORS explicitly configured; real status codes
  everywhere; consistent JSON error envelope.

## Week 4 theory → this codebase (concept map)

| Week 4 concept (slides) | Where it lives in InternDesk |
|---|---|
| **I-P-O architecture** | Browser (Input: search/filters/forms) → Express routes (Process: validate → SQL → JSON) → DOM render (Output: cards/drawer/toasts). Diagram above. |
| **async/await, no Promise hell** | Every data path is `async/await`; boot fires health + list via `Promise.all()` (`frontend/js/app.js`). No `.then()` chains anywhere. |
| **fetch() API** | Exactly one `fetch()` in the codebase: `frontend/js/apiClient.js`. Everything else calls it. |
| **REST + idempotency** | Noun-based routes (`/api/interns`, `/api/interns/:id`); GET/PUT/DELETE idempotent, POST/PATCH not — matches the HTTP Method Diagnostic Matrix. |
| **JSON as the translator** | `JSON.stringify` on the way out, `response.json()` on the way in; malformed JSON → `400 BAD_REQUEST` envelope (central error handler). |
| **CORS barrier** | Explicit `Access-Control-Allow-Origin` allowlist (`FRONTEND_ORIGIN`), preflight `OPTIONS → 204` handled in `backend/src/app.js`. |
| **HTTP status codes** | Real codes, never 200-for-errors: 201 create, 204 delete, 400 bad filter/JSON, 404 unknown id/route, 422 validation with `fields` map, 500 envelope. |
| **Defensive programming** | `try/catch` on every async boundary; no silent failures (every error surfaces as toast/rail); graceful degradation (offline → empty state, not blank screen); `finally` clears loading state. |
| **UI injection, XSS-safe** | DOM built with `textContent` only (`dom.js el()`); `innerHTML` restricted to static trusted icon constants. |
| **The network rail** | Every fetch pulses the 3px left-edge bar: indigo in flight, green 2xx, amber 4xx, red 5xx — the request lifecycle made visible. |

## Debt log

- **No automated test runner.** The brief asked for a manual checklist doc;
  TESTING.md is filled with real results, but there's no `npm test`. Real fix:
  add vitest/supertest suites for the 6 endpoints + validator unit tests.
- **SQLite concurrency.** The file DB is synchronous-by-nature — fine for a demo
  console. The Vercel deploy uses Turso (hosted SQLite) instead, which handles
  concurrent serverless invocations properly.
- **Fonts via Google CDN.** Offline viewing falls back to system fonts; self-host
  the woff2 files for a fully offline build.
- **No auth.** Anyone with the URL can mutate the directory. Fine for the
  assignment; a real console needs sessions + per-cohort access control.

# InternDesk — Manual Test Matrix

Verified live on 2026-09-27 against `http://localhost:3100` (Express + node:sqlite,
18 seeded interns). Every row below is an **actual observed result**, not a plan.

Legend: ✅ pass · UI rows marked [manual] need a human in the browser.

## Backend — endpoint matrix

| Endpoint | Happy path (2xx) | One 4xx case | Simulated 5xx (`?simulateError=true`) | Simulated latency (`?simulateLatency=1500`) |
|---|---|---|---|---|
| `GET /api/interns` | ✅ 200, `{data:[18], meta:{count:18}}` | ✅ 400 `BAD_REQUEST` on `?status=bogus` | ✅ 500 `SIMULATED_FAILURE` envelope | ✅ 200 in ~1.51s |
| `GET /api/interns?status=active` | ✅ 200, 10 rows, all `status:"active"` | — (covered above) | ✅ 500 envelope | — |
| `GET /api/interns?q=sana` | ✅ 200, 1 row (`Sana Malik`) | — | — | — |
| `GET /api/interns/:id` | ✅ 200, full Intern object for id 1 | ✅ 404 `NOT_FOUND` for id 999, envelope shape exact | ✅ 500 envelope | — |
| `POST /api/interns` | ✅ 201, `{data:{id:19,…}}`, defaults `status:"pending"`, `startDate:today` | ✅ 422 `VALIDATION_FAILED` + `fields.email` for missing email; ✅ 422 for bad email; ✅ 422 `fields.email:"already in the directory"` for duplicate | ✅ 500 envelope | — |
| `PUT /api/interns/:id` | ✅ 200, full replace persisted (name/role/phone changed) | ✅ 404 `NOT_FOUND` for id 999; ✅ 422 on invalid body (same validator as POST) | ✅ 500 envelope | — |
| `PATCH /api/interns/:id` | ✅ 200, `{"status":"alumni"}` updated only that field | ✅ 404 for id 999; ✅ 422 `fields._` on empty `{}` body | ✅ 500 envelope | — |
| `DELETE /api/interns/:id` | ✅ 204, empty body; second DELETE → ✅ 404 `NOT_FOUND` | — (404 covered) | ✅ 500 envelope (delete blocked, record intact) | — |
| `GET /api/health` | ✅ 200 `{status:"ok", interns:18, time:<iso>}` | — | — | — |
| Unknown route | — | ✅ 404 `NOT_FOUND` envelope for `GET /api/nope` (never HTML) | — | — |
| Malformed JSON body | — | ✅ 400 `BAD_REQUEST` `"not valid JSON"` | — | — |
| CORS preflight | ✅ `OPTIONS` → 204; `Access-Control-Allow-Origin: http://localhost:3000` echoed | — | — | — |

Exact error envelope observed everywhere: `{ "error": { "code": "NOT_FOUND", "message": "…" } }`
— 422 adds `"fields": { "email": "…" }`. No endpoint ever smuggles an error as 200.

## Frontend — behaviour checklist [manual]

Run `npm start` in `backend/`, open http://localhost:3000, and walk this:

- [ ] **Boot:** `Promise.all([health, list])` — header shows green API dot + "API ok · 18 interns"; grid renders 18 cards. Rail pulses indigo then flashes green.
- [ ] **Skeleton loading:** with Chaos → latency ON, reload — 8 skeleton cards pulse (opacity, no spinner-only blank), UI stays responsive (scroll works mid-wait).
- [ ] **Search:** type `sana` — 1 card; type `zzz-nope` — designed empty state ("No interns match") + working "Clear search & filters".
- [ ] **Filter chips:** Active → 10 cards; Alumni → 4; Pending → 4; All → 18. Meta line updates ("10 interns").
- [ ] **Drawer:** click a card — detail loads; rail flashes green.
- [ ] **Inline PATCH:** change status → Save — only that button shows micro-loading; toast "Status updated…"; card pill updates after close/reload.
- [ ] **Full PUT:** Edit all fields → blank the email → Save — per-field red error under Email (from 422 `fields`), no generic toast; fix → Save → "Intern updated."
- [ ] **DELETE:** Delete → inline confirm strip ("cannot be undone") → Yes — 204, toast, drawer closes, card gone.
- [ ] **New intern:** empty submit — client-side errors appear before any request (check Network tab: zero requests); bad email → same; valid → 201 toast + card appears.
- [ ] **Chaos → errors ON:** any action — rail flashes red, toast "Something's wrong on our end (SIMULATED_FAILURE). Retry in a moment."; grid keeps last good data (no crash, no blank page).
- [ ] **Offline:** stop the backend, click reload — toast "Could not reach the server…", header dot red, app intact.
- [ ] **Rail lifecycle:** every fetch visibly pulses the left rail (indigo → green/amber/red). Amber specifically on a 404/422 (e.g. open drawer for a deleted id).

## Engineering-rule spot checks (code, not runtime)

- [x] `grep -rn "\.then(" frontend/js` → zero `.then()` chains (only `catch {}` blocks and comments).
- [x] Every `fetch` lives in `js/apiClient.js`; components never call `fetch` directly.
- [x] Every async handler uses `try/catch/finally`; `finally` clears loading/busy state.
- [x] `response.ok` checked before `response.json()` in `apiClient.request`.
- [x] Boot uses `Promise.all()` for the two independent requests.
- [x] All user strings rendered via `textContent` (`dom.js el()`); `innerHTML` used only for static trusted icon constants.
- [x] `node --check` passes on all 15 JS files; modules import cleanly in Node (no DOM touched at import).

## UI redesign — 2026-09-27 ("Midnight Console")

- Full frontend restyle: dark Linear-grade theme, electric violet `#8B7CFF` accent,
  Space Grotesk display / Inter UI / JetBrains Mono. Backend untouched.
- New: stats strip (Total/Active/Alumni/Pending, always computed from the
  unfiltered list), ⌘K/Ctrl+K search focus, staggered card entrance, stat
  count-up, shimmer skeletons, press states, `prefers-reduced-motion` support.
- Network rail kept as the signature (now glowing: violet in-flight,
  emerald 2xx, amber 4xx, red 5xx).
- Re-verified after restyle: `node --check` on all touched JS files; live
  render captured in `screenshots/` (directory, drawer, form, chaos).
  Behavior matrix above is unaffected (visual-only change).

## UI v2 — depth layer (2026-09-27, same day)

- Aurora ambience (drifting violet/cyan blobs + film-grain noise), editorial hero
  with staggered headline, ⌘K **command palette** (fuzzy-find interns, actions:
  new intern / chaos toggles / status filters; ↑↓↵/esc navigable).
- Card spotlight (cursor-tracked radial highlight), stronger hover lift, avatar
  ring glow, animated status-distribution bar under stats, custom scrollbar,
  violet text selection, palette CTA button.
- Verified: synthetic Ctrl+K opens palette, 9 items render, "sana" filters to
  1 person; stats still 18/10/4/4; all 18 cards render; `node --check` clean.
  Behavior matrix above unaffected (visual/interaction layer only).

## Scroll reveal + text transitions (2026-09-27)

- Cards now reveal on scroll via IntersectionObserver (`.in-view`, staggered,
  fires once per card) instead of a one-shot load animation.
- Text in motion: hero eyebrow/sub fade-up, "DecodeLabs." gradient shimmer
  (7s loop after entrance), card name eases to accent color on hover,
  tabular-nums on stat counters.
- Verified via CDP: 8/18 cards `.in-view` at top, 18/18 after scrolling to
  bottom; scrolled screenshot clean, no stuck invisible cards.

## libsql migration (2026-09-27)

- Backend moved from `node:sqlite` to `@libsql/client`: file DB locally
  (`backend/data/interndesk.sqlite`, zero config), Turso when
  `TURSO_DATABASE_URL` is set (Vercel).
- Fresh-DB boot: `GET /api/health` -> ok, 18 seeded interns.
- `POST /api/interns` -> 201 (id 19); `PATCH /api/interns/19` -> 200
  (status alumni); duplicate-email POST -> 422 `fields.email`;
  `DELETE /api/interns/19` -> 204; `GET /api/interns/9999` -> 404;
  final health -> ok, 18 interns.

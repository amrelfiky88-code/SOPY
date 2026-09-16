# SOPY — Project Handoff

**Read this first if you're a new Claude session (or person) picking this
project up.** It exists so you don't have to re-derive context that was
already established — everything below is verified fact, not a plan or
aspiration, checked against the actual code/database/test results as of
commit `856a640` (2026-09-17).

## What this is

A multi-tenant B2B SaaS that replaces paper SOP manuals for restaurants
and cafés: **SOPY — Restaurant Perfect Operating Procedure System**.
React (Vite) + PWA frontend, Node/Express API, PostgreSQL, Paddle Billing
for subscriptions.

- Repo: `C:\Users\amrse\code\sopy`, git-initialized, 11 commits on `main`
- All commits are small and individually justified — `git log --oneline`
  and read the commit bodies (`git log -p <hash>`) before assuming you
  need to re-explain what something does; the reasoning is already there.

## Current state (verified, not assumed)

- **50/50 automated tests pass** — `npm run test:server` (Node's built-in
  test runner, against a dedicated `sopy_test` database, never the dev
  one). Every test was added as a *regression test for a real bug found
  by running the app*, not written speculatively — see commit messages.
- **Frontend builds clean** — `npm run build:web`.
- **Both dev servers were running and manually exercised in a real
  browser** (not just curled) as of this writing: API on `:4000`, web on
  `:5173`, also reachable at `http://192.168.100.6:5173` for phone
  testing (see "Local network access" below — this LAN IP is specific to
  the machine this was built on and will differ on yours).
- **Master checklist library has 403 items, 88 marked critical**, verified
  directly against Postgres (not just the API):

  | standard | count | source |
  |---|---|---|
  | `HACCP` / `ISO_22000` / `LOCAL_CODE` | 20 | generic starter seed (`server/db/seed_library.sql`) |
  | `INTERNAL_QC` | 217 | **transcribed from the client's own** Daily QC Checklist + Weekly/Monthly/Quarterly Audit System documents |
  | `SOP` | 166 | SOP 1–11 transcribed from the client's own documents; **SOP 12–20 were researched from industry sources (FDA Food Code, TIPS, etc.) at the client's explicit request, not transcribed** — see the "Content provenance" section below, this distinction matters |

## Dev environment on this machine

This machine had **none** of the following pre-installed; all of it was
set up during this project and should already be usable on a fresh
session — don't re-check for or reinstall unless you hit an actual error:

- Node.js 24 + npm 11 (`winget install OpenJS.NodeJS.LTS`)
- PostgreSQL 17 running as a Windows service, dev DB `sopy` / role `sopy`
  password `sopy` (see `server/.env.example`), plus `sopy_test` for the
  automated suite
- Portable Git 2.55 at `%USERPROFILE%\tools\PortableGit` (added to user
  PATH) — a real `git.exe`, used because `winget install Git.Git` hung on
  a UAC prompt with nobody to click it

## How to run it

```bash
npm install
cp server/.env.example server/.env    # already done on this machine
npm run db:migrate                    # applies schema + all seed files, idempotent-ish (re-running re-inserts seed rows — see caveat below)
npm run dev:server                    # API on :4000
npm run dev:web                       # web on :5173, in a second terminal
```

Demo accounts (already seeded in the dev `sopy` database on this
machine):
- `amina@example.com` / `SopyDemo123` — Business Owner, onboarding
  already complete, tenant "The Nile Bistro" with 1 branch ("Downtown")
- `karim@example.com` / `KarimPass123` — Store Manager on the same tenant

**Caveat:** `npm run db:migrate` re-applies every seed file every time —
running it again against a database that already has the seed data will
insert duplicate library items (there's no `ON CONFLICT DO NOTHING`,
since these seed files were built incrementally across many separate
sessions of adding content, not designed as a single idempotent
migration). If you need a truly clean re-seed, drop and recreate the
`checklist_items` rows with `tenant_id IS NULL` first, or start from a
fresh database.

## What's built (maps to the original spec)

All ten pages/flows from the original spec are built and were manually
verified end-to-end in a real browser against the real Postgres database
(not just unit-tested): Landing → Who Are You → Configure Your Data →
Pricing (live tapering calculator) → Paddle checkout (demo-mode fallback
without real Paddle keys) → Onboarding wizard (roles/stores/invites/access
levels) → role-gated app shell → Checklist Builder → Kitchen/Bar Daily
Operation Reports (rebuilt field-for-field against the client's real
KDR-001/BDR-001 templates) → checklist completion with **camera-only**
evidence capture (`web/src/components/CameraCapture.jsx` has no
`<input type="file">` anywhere in it, deliberately) → role dashboards +
filterable KPI dashboard.

Data model matches the spec exactly (`server/db/schema.sql`), plus
extensions added along the way: `is_critical` and `sort_order` on
`checklist_items`, a scorecard endpoint
(`GET /api/submissions/:id/scorecard`) computing section-by-section score
and Green/Amber/Red status.

## Content provenance — read this before adding more SOP content

This matters because it affects what you're allowed to silently change:

- **SOP 1–11** and the **QC Audit System** (`INTERNAL_QC`) were
  transcribed from documents the client actually wrote and shared. Their
  `is_critical` flags mirror the client's own ⚠ marks. **Do not
  "correct" these based on outside research** — if new information
  suggests one should be different, that's a conversation to have with
  the client, not a silent edit, because the whole point of that content
  is that it's *theirs*.
- **SOP 12–20** (`seed_additional_sops.sql`) were researched from public
  industry sources because the client gave only titles, no detail, and
  explicitly asked for this when offered the choice. The seed file's own
  header comment and the README both flag this distinctly. Treat it as a
  reviewable starting point, not verified client material.
- A later "Health Code Compliance" reference document
  (`seed_health_code_reference.sql`) was cross-checked against everything
  already seeded rather than assumed to need new content — it mostly
  *validated* existing `is_critical` choices, and only 4 genuinely new
  checkpoints came out of it. If more reference-style (non-procedural)
  content shows up, that cross-check-first approach is the right one to
  repeat, not "add more items by default."

## Known gaps (found via an audit against the client's own pitch deck)

Confirmed missing by grepping the actual code, not by memory — see the
conversation history around the `SOPY.pptx` audit for full detail:

1. **PDF export** ("save as a pdf") — no PDF generation anywhere in the app.
2. **Email sending** ("send by email") — no email capability at all;
   invites currently just show a link in-app (see README's "Known
   simplifications").
3. **Yearly billing option** — Paddle billing is hardcoded to
   `interval: 'month'` in `server/src/paddle/client.js`; no annual plan
   exists anywhere, not even a toggle on the Pricing page.
4. **Checkpoint selection isn't wired into the "Configure Your Data" step**
   — the client's deck implies picking daily SOP checkpoints should
   happen during initial onboarding configuration. What got built instead
   is a full-featured standalone Checklist Builder reached later, as a
   manager-only tool. The capability exists; that specific funnel
   placement doesn't.

None of these have been started. If the user asks you to build one,
that's new work, not something half-done to finish.

## Other known simplifications (already documented in README, not new findings)

Postgres RLS not used (app-level tenant scoping only), photo storage is
local disk, Area Manager branch-scoping is approximate. Full detail in
`README.md`'s "Known simplifications" section — don't rediscover these,
just read them.

## Mobile responsiveness

Fixed in the most recent commit after being found by actually rendering
the app at a 375px viewport: the sidebar is now a proper off-canvas
drawer under 768px (`web/src/components/AppLayout.jsx` +
`web/src/styles/theme.css`), two-column form grids use a real responsive
CSS class (`.form-grid-2col`) instead of inline styles that couldn't
respond to a media query, and every table is wrapped in `.table-scroll`
so it scrolls internally instead of the page overflowing. Verified via
`scrollWidth`/`clientWidth` checks in-page, not just visually.

The dev server binds to all network interfaces
(`server: { host: true }` in `web/vite.config.js`) and CORS reflects the
request origin outside `NODE_ENV=production`
(`server/src/app.js`) specifically so it can be tested from a real phone
on the same Wi-Fi — this was verified end-to-end by logging in through
the LAN IP in a real browser, not assumed to work.

## If you're continuing this conversation's work

- Run the test suite before and after any change:
  `npm run test:server`. It's fast (~20s) and has caught a real bug in
  every single content-import commit so far — trust it over "this looks
  right."
- If adding more seed content: check `server/src/db/migrate.js` and
  `server/test-utils/db.js` — every new seed file needs to be added to
  *both* lists or it won't apply on a fresh install or get exercised by
  tests.
- If touching SQL seed files with special characters (em dashes,
  apostrophes): **don't use PowerShell string replacement on them** — a
  `-replace` on a UTF-8 file with em dashes corrupted one seed file into
  mojibake earlier in this project (see the `seed_opening_closing.sql`
  history in git log). Rewrite the whole file with the `Write` tool
  instead, or use a proper UTF-8-aware tool.
- Dry-run any new seed SQL inside `BEGIN; ... ROLLBACK;` before applying
  it for real — this caught nothing fatal so far but is now the
  established pattern (see any `seed_*.sql` commit for the exact psql
  invocation used).

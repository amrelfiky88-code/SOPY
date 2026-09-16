# SOPY — Restaurant Perfect Operating Procedure System

A multi-tenant B2B SaaS that replaces paper SOP manuals for restaurants and
cafés with a digital, subscription-based compliance platform.

Stack: **React (Vite) + PWA** frontend, **Node/Express** API, **PostgreSQL**
database, **Paddle Billing** for subscriptions. Ships as a single Node
process that can also serve the built frontend, so it deploys cleanly to
Hostinger Cloud Startup (Node.js app + managed PostgreSQL) or any similar
host.

## Project layout

```
sopy/
  shared/pricing.js       # single source of truth for the pricing formula
  server/                 # Express API + PostgreSQL schema
  web/                    # Vite React PWA frontend
```

## Prerequisites

You'll need **Node.js 20+** and a **PostgreSQL 14+** database. Neither is
installed on the machine this project was generated on, so the code has
not been run yet — follow the steps below on a machine that has them.

## 1. Install dependencies

```bash
npm install
```

This installs both workspaces (`server` and `web`) from the root.

## 2. Configure environment variables

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env
```

Edit `server/.env`:
- `DATABASE_URL` — your Postgres connection string.
- `JWT_SECRET` — any long random string.
- `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET` — leave blank to run checkout
  in **demo mode** (a "Simulate successful payment" button appears instead
  of the real Paddle overlay), or fill in from your Paddle Billing sandbox
  account to test real payments.

If you fill in Paddle keys, also set `web/.env`'s `VITE_PADDLE_CLIENT_TOKEN`
(from Paddle > Developer Tools > Authentication > client-side tokens).

## 3. Create the database schema

```bash
createdb sopy   # or create it however your Postgres setup expects
npm run db:migrate
```

This applies `server/db/schema.sql` and seeds the master checkpoint
library (`server/db/seed_library.sql`) with starter HACCP / ISO 22000 /
local-code checkpoints.

## 4. Run it

Two terminals:

```bash
npm run dev:server   # API on :4000
```
```bash
npm run dev:web      # frontend on :5173 (proxies /api and /uploads to :4000)
```

Open http://localhost:5173 and walk through: Landing → Get Started →
Configure Your Data → Pricing → Checkout (demo mode works without Paddle
keys) → Onboarding wizard → Dashboard.

## Tests

```bash
createdb sopy_test   # one-time, owned by the same DB role as server/.env.example
npm run test:server
```

`server/test/` has unit tests for the pricing calculator
(`shared/pricing.js`) and integration tests that boot the real Express app
(`server/src/app.js`) on an ephemeral port and hit it with `fetch`, backed
by a dedicated `sopy_test` database (configured in `server/.env.test`, never
your dev database — `resetTestDb()` drops and rebuilds its schema before
each test file). Coverage includes auth, multi-tenant isolation, checklist
submission end-to-end, QC scoring/critical-fail logic, and regression
tests for real bugs found while manually verifying this app against a
live database:

- an `UPDATE ... ORDER BY ... LIMIT` (invalid SQL — Postgres doesn't allow
  ordering/limiting an UPDATE directly) that crashed mock checkout completion,
- a `CASE WHEN $n IS NOT NULL` clause that left Postgres unable to infer
  that parameter's type, crashing checklist submission,
- `/api/billing/checkout` wasn't idempotent, so a re-fired effect (React
  StrictMode, a refresh, back/forward nav) created duplicate `pending`
  subscription rows and orphaned Paddle transactions,
- a multi-row `INSERT` doesn't guarantee Postgres returns rows in the
  order they were listed (and all rows in one statement share the same
  `created_at`), so seeded checklist items came back scrambled within a
  section until an explicit `sort_order` column was added,
- and a permission gate that blocked non-managers from ever opening the
  Kitchen/Bar daily reports the first time (before a manager had happened
  to create the template).

Test files run with `--test-concurrency=1` because they share one
Postgres database and each resets its schema — don't remove that flag
without giving each file its own database or transaction-per-test
isolation.

## Deploying to Hostinger Cloud Startup

1. Provision a PostgreSQL database in hPanel and run `schema.sql`,
   `seed_library.sql`, and `seed_qc_system.sql` against it (via
   phpPgAdmin, or `psql` if you have shell access) — or just run
   `npm run db:migrate`, which applies all three.
2. Build the frontend: `npm run build:web` (outputs `web/dist`).
3. Set `NODE_ENV=production` and the same env vars as above on the
   Node.js app in hPanel; point its start command at
   `npm run start:server` (which runs `server/src/index.js`).
4. With `NODE_ENV=production`, the Express server itself serves
   `web/dist` and falls back to `index.html` for client-side routes, so
   one Node app is all you need — no separate static host.
5. Point your Paddle webhook endpoint at
   `https://<your-domain>/api/billing/webhook`.

## PWA

`web/public/manifest.json` and `web/public/sw.js` make the app
installable (Add to Home Screen / desktop install prompt) with basic
offline caching of the app shell. **The icons in `web/public/icons/` are
placeholder SVGs** — swap in real branded 192×192 and 512×512 PNGs before
launch, since some platforms require raster icons for the install prompt.

## Pricing model

`shared/pricing.js` is imported by both the Pricing page (live calculator)
and the billing route that creates the Paddle transaction, so the number
a customer sees is exactly what they're charged. Per the spec, rates
taper with volume:

- Branches: unit rate steps down linearly from $10 (1st branch) to a
  floor of $7, reached at 10 branches.
- Users: unit rate steps down linearly from $9 (1st user) to a floor of
  $5, reached at 20 users.
- `monthlyTotal = branches × effectiveBranchRate + users × effectiveUserRate`,
  where the effective rate is the blended (average) tapered rate at that
  volume — this is what's shown on the Pricing page and what Paddle bills
  as a flat unit price × quantity.

Adjust the floor/floorAt constants in `shared/pricing.js` if the real
tapering schedule differs from this reading of the spec.

## Imported QC content

`server/db/seed_qc_system.sql` seeds the master checkpoint library with
217 real checkpoints transcribed from the client's own documents:

- **Daily QC Checklist** (QC-D-001) — 104 scored points across 12
  sections (A–N, skipping the unscored "Consumer Behavior & Insights"
  observation section), plus those 12 observation items.
- **Weekly / Monthly / Quarterly Audit System** (QC-S-001) — 45 + 42 + 14
  points.

Each item's `is_critical` flag mirrors the ⚠ marks on individual items in
the source documents exactly (not just section-level "⚠ CRITICAL"
headings) — 13 critical items in the daily checklist, 4 weekly, 4
monthly, 3 quarterly. A non-compliant response on a critical item
auto-flags the submission as an incident (`POST
/api/submissions/:id/responses`), and `GET
/api/submissions/:id/scorecard` computes a section-by-section score,
critical-fail count, and Green/Amber/Red status (≥95% Green, 85–94%
Amber, below that or any critical fail forces Red — matching the
compliance thresholds in the source documents almost exactly at every
point total tested).

Standard `INTERNAL_QC` distinguishes this company-specific framework from
the generic HACCP/ISO 22000/local-code starter items. Search, filter by
standard/category, and filter to critical-only from the Checklist
Builder; "Select all shown" makes it fast to build the Daily QC
Checklist, or the Weekly/Monthly/Quarterly audits, straight from the
library (set frequency accordingly — quarterly is now an option).

### The 20-SOP library (standard = `SOP`)

Beyond the QC audit content above, the library also has 162 items across
20 numbered SOPs — but they're not all the same kind of source:

- **SOP 1–11** (`seed_opening_closing.sql`, `seed_food_safety.sql`,
  `seed_front_of_house.sql`, `seed_cash_handling.sql`,
  `seed_health_inspection.sql`) were transcribed from the client's own
  SOP documents, one item per numbered phase (with sub-steps captured in
  `description`), except SOP 11's "Daily Checklist" section, which lists
  independent parallel facts under each category rather than sequential
  steps — the same shape as the Daily QC Checklist above — so each bullet
  became its own item there instead.
- **SOP 12–20** (`seed_additional_sops.sql`) were **researched, not
  transcribed** — the client provided only titles for these nine SOPs
  (Recipe Standardization, Kitchen Cleaning Schedule, Inventory
  Management, Waste Reduction, Alcohol Service, Allergen Awareness,
  Emergency Procedures, New Employee Onboarding, Daily Manager
  Checklist), at their explicit request to draft this content from
  current industry-standard guidance (FDA Food Code, TIPS/responsible
  alcohol service training, established restaurant-operations sources)
  rather than invent it from scratch. **This is a sourced starting
  point, not the client's own verified material** — review and adapt it
  to actual house rules and local legal requirements (alcohol service
  age, licensing, and health-code specifics all vary by jurisdiction)
  before relying on it operationally. The seed file's own header comment
  carries this same caveat.

`is_critical` across all 20 SOPs follows one consistent rule, applied by
judgment where the source has no explicit marker: a phase is critical
when getting it wrong is a direct safety, security, food-safety, or
fraud/legal-liability risk requiring escalation — not general quality or
service-consistency guidance. That's why SOP 4 (temperature monitoring),
SOP 10 (cash handling), SOP 16 (alcohol service), and SOP 18 (emergency
procedures) are almost entirely critical, while SOP 12 (recipe
standardization) and SOP 15 (waste reduction) have none.

The Kitchen Daily Operation Report and Bar & Beverage Daily Operation
Report pages (`web/src/pages/forms/KitchenDailyForm.jsx` /
`BarDailyForm.jsx`) were rebuilt field-for-field against the client's
KDR-001 / BDR-001 templates — fixed equipment lists with Start/Mid/End
temperature readings and safe ranges, the exact receiving/production/
waste/stock/sales/cleaning log columns, and the real opening/closing
task text — rather than the earlier generic placeholder layout.

The SOP Manual (policies, HACCP CCP table, disciplinary framework, etc.)
was used as reference material to sanity-check the imported checkpoints
but isn't itself surfaced anywhere in the app — SOPY doesn't have a
policy-document/wiki feature. That'd be a separate, deliberate addition
if wanted.

## Paddle Billing integration

`server/src/paddle/client.js` creates Paddle transactions with **inline
custom prices** (Paddle Billing supports non-catalog prices per line
item) so the exact tapered total is charged, rather than trying to model
per-unit graduated tiers as Paddle catalog prices. Changing branch/user
counts later calls `PATCH /subscriptions/{id}` with
`proration_billing_mode: prorated_immediately`, so Paddle prorates the
next invoice automatically — see `updateSubscriptionQuantities`.

Without `PADDLE_API_KEY` set, `/api/billing/checkout` returns a mock
transaction and the frontend shows a "Simulate successful payment"
button, so the full onboarding flow can be exercised without a Paddle
account.

## Data model

See `server/db/schema.sql`. Tables: `tenants`, `branches`, `users` (+
`user_branches` for multi-branch assignment), `subscriptions`,
`checklist_items` (the master library — global rows have `tenant_id
NULL`, tenants can add custom ones), `checklist_templates` +
`checklist_template_items`, `checklist_assignments`,
`checklist_submissions` + `checklist_submission_responses` (per-item
answers with camera-captured photo path, GPS, timestamp).

The Kitchen Daily Operation Report and Bar & Beverage Daily Operation
Report are `checklist_templates` with `kind = 'kitchen_daily' |
'bar_daily'`; their structured sections (temperature log, receiving log,
waste log, equipment status, opening/closing checklist) live in
`checklist_submissions.form_data` (JSONB) rather than as separate tables,
since the spec's data model doesn't call out separate forms tables.

## Evidence photos are camera-only

`web/src/components/CameraCapture.jsx` uses `getUserMedia` to show a live
feed and a shutter button that draws the current frame to a canvas and
uploads the resulting blob. **There is no `<input type="file">` anywhere
in that component**, and the server's upload endpoint
(`POST /api/submissions/:id/responses`) rejects any MIME type other than
`image/jpeg`/`image/png` from the camera pipeline.

## Known simplifications (documented, not hidden)

- **Multi-tenancy** is enforced at the application layer (every query is
  scoped by `tenant_id` from the JWT), not with Postgres Row-Level
  Security. Add RLS policies before handling sensitive production data
  if you want defense in depth.
- **Area Manager branch scoping**: the KPI/dashboard queries scope by
  tenant and an optional single branch filter; restricting an Area
  Manager to only *their assigned* branches everywhere (not just where
  `user_branches` is already joined) would need a bit more query-level
  filtering as the team grows.
- **Photo storage** is local disk (`server/uploads/`), fine for a single
  Hostinger instance; move to S3/Object Storage if you scale to multiple
  app instances.
- **Invite emails** aren't actually sent — `POST /api/tenants/users/invite`
  returns the invite link directly in the API response for the demo; wire
  up an email provider before real use.

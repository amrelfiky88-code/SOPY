# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

SOPY is a multi-tenant SaaS that replaces paper SOP manuals for restaurants: checklists with camera-only photo evidence, daily operation reports, KPI dashboards, and Paddle subscription billing. `README.md` has setup/deploy detail; `HANDOFF.md` has project history and known gaps.

## Commands

npm workspaces (`server`, `web`) plus a non-workspace `shared/` folder. Run from the repo root:

```bash
npm install
npm run db:migrate      # schema.sql + every seed file + content translations
npm run dev:server      # API on :4000 (node --watch)
npm run dev:web         # Vite on :5173, proxies /api and /uploads to :4000
npm run build:web       # web/dist — also the only compile check; there is no linter or TS
npm run test:server     # all backend tests
```

Single test file (from `server/`):

```bash
node --env-file=.env.test --test test/billing.test.js
```

Tests need a `sopy_test` database (`createdb sopy_test`, same role as `server/.env.example`). Every test file calls `resetTestDb()`, which drops and rebuilds the whole schema — that's why the suite runs with `--test-concurrency=1`. Don't remove that flag.

There are no frontend tests. UI changes must be checked in a real browser, including at 375px width — the app is primarily used on phones.

## Architecture

**Server** (`server/src`): Express. `app.js` exports `createApp()` so tests boot the real app on an ephemeral port (`test-utils/server.js`); `index.js` only calls `listen`. In production the same process serves `web/dist` with SPA fallback — one Node app, no separate static host.

**Multi-tenancy is enforced in application code, not Postgres RLS.** `requireAuth` puts `tenantId`/`userId`/`role` from the JWT on `req.auth`; every query must scope by `req.auth.tenantId`. `test/tenant-isolation.test.js` guards this. Roles are `business_owner`, `operations_manager`, `area_manager`, `store_manager`, `employee`, checked with `requireRole(...)`.

**`shared/` is imported by both server and web** (web reaches it via `../../../shared/...`; Vite's `fs.allow: ['..']` permits this). It is the single source of truth for:
- `pricing.js` — the tapering rate schedule, `calculatePricing`, and `PLAN_LIMITS`/`clampPlanCount`. The Pricing page, tenant PATCH, checkout, and plan changes all use it so the displayed price always equals the billed price.
- `languages.js` — supported UI languages (`en`, `ar`, `fr`) and their text direction.

**Onboarding funnel** is driven by `tenants.onboarding_step` (`configure_data` → `pricing` → `checkout` → `onboarding` → `complete`). `AppLayout` redirects any `/app/*` route back into the funnel until the step is `complete`.

**Billing** (`routes/billing.routes.js`): with no `PADDLE_API_KEY`, checkout runs in mock mode (`/billing/mock-complete`). `/checkout` is idempotent (reuses the pending row) and short-circuits with `alreadyActive` for a paid tenant — without that, re-opening checkout created a pending row that masked the active subscription. The webhook is mounted with `express.raw()` *before* `express.json()` so the signature can be verified against raw bytes. Signatures older than 5 minutes are rejected, to stop replays. Subscription events are matched to their row by `paddle_subscription_id`, or on first contact by the `transaction_id` that created them, never by "newest row". A cancel scheduled for period end stays `canceled` locally. `paddle/client.js` bills each resource as quantity 1 at its exact tapered subtotal, so Paddle's total equals `calculatePricing().monthlyTotal`. Quantity × rounded blended rate drifted by cents. `test/paddle.test.js` stubs Paddle's API and signs real webhooks.

**When a plan ends:** a `canceled` subscription whose `current_period_end` has passed blocks *writes* on checklists, submissions and adding stores or people, with 402 `plan_ended` (`auth/plan.js`). Reads, sharing existing reports, and shrinking the plan stay open. `/auth/me` and login return `tenant.plan_ended` for the in-app banner. Pending, past-due and missing subscriptions never block, so a delayed webhook can't lock anyone out.

**Referrals and account credit** (`credits.js`, `routes/referrals.routes.js`, settings in `shared/referrals.js`). Each tenant has a `referral_code`, created on first view of Profile & billing, and shared as `/get-started?ref=CODE`. `main.jsx` keeps a `?ref` for 30 days so browsing first still counts. Signup stores `referred_by_tenant_id`; bad codes are ignored. The referrer earns `REFERRAL_REWARD_USD` in `account_credits` when the referred tenant's *first* payment is confirmed (`mock-complete` or `transaction.completed`). `UNIQUE(referred_tenant_id)` makes that once-only. Credit comes off the next payment:
- **Checkout:** `subscriptions.credit_applied`, plus a single-use Paddle flat discount. It's only marked `used` when the payment is confirmed.
- **Active Paddle subscriber:** a one-time discount on the next renewal (`scheduled`, then `used` on the `subscription_recurring` transaction). Only one is scheduled at a time.
- **Remainders:** credit is spent oldest-first and capped at the payment; any remainder stays `available`.

Existing databases need `tenants.referral_code`, `tenants.referred_by_tenant_id`, `subscriptions.credit_applied` and the `account_credits` table (see `schema.sql`).

**Plan limits are enforced.** The tenant's `branch_count`/`user_count` are ceilings: adding a store, inviting, or re-enabling a user past them returns 409 (`planRoom` in `tenants.routes.js`). Users count unless `disabled`, so pending invites count too. A plan can't be lowered below current usage. `calculatePricing` clamps counts to `PLAN_LIMITS`, because it loops once per unit and `/api/pricing/calculate` is public.

**Sessions.** `api.js` fires `sopy:signed-out` on any 401 from a signed-in request, and `AuthContext` logs out. A network failure while checking the session shows an offline/retry screen instead, and the token is kept. Failed logins lock the account for 15 minutes after 10 tries (`auth/rateLimit.js`, in memory, keyed by email). **Passwords:** there's no email, so recovery works through manager-issued one-time reset links (`POST /tenants/users/:id/reset-link`). These reuse `users.invite_token` and the `/accept-invite` page. People change their own password with `PATCH /auth/password`. Both set `users.tokens_valid_after`, and `requireAuth` refuses tokens issued before it, which signs out other devices. That column was added after launch, so existing databases need `ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_valid_after TIMESTAMPTZ`. `invite_token` on a disabled-then-re-enabled user still means "never accepted", because disabling an active user clears any pending reset link.

**Two kinds of "checklist":**
1. *Library checklists* — `checklist_items` (global rows have `tenant_id IS NULL`) → picked into `checklist_templates` → assigned → run via `ChecklistRun.jsx` as `checklist_submissions` + per-item responses. A non-compliant response on an `is_critical` item auto-flags the submission as an incident; `/submissions/:id/scorecard` computes section scores and Green/Amber/Red.
2. *Pinned reports* (Kitchen, Bar, Opening, Closing, QC visit, Area/Ops manager visit) — dedicated pages under `web/src/pages/forms/` built on `useOpsReport({ kind, title })`. They store a free-form `form_data` JSON on the submission and don't use `checklist_items` at all. The template is auto-provisioned by `kind` on first use; which roles may provision each kind is the allowlist in `requireManagerUnlessBuiltinDailyReport` (`checklists.routes.js`). Adding a new pinned report means updating that allowlist, `App.jsx` routes, and the sidebar in `AppLayout.jsx`.

**Report PDFs and sharing.** `/app/reports` lists submitted reports; `/app/reports/:id` renders one from `GET /submissions/:id/report`. The PDF is built in the browser: `web/src/lib/reportModel.js` turns the report into layout blocks (used by both the page and the PDF), `reportPdf.js` draws them onto A4 canvases, and `pdf.js` wraps the page JPEGs into a PDF. There's no PDF library, on purpose: canvas text uses the device's own text engine, so Arabic comes out right. WhatsApp/email/copy-link upload that PDF to `POST /submissions/:id/share`, which stores it in `server/storage/shares/` (not public `/uploads`) and returns `/api/shared/:token`, a no-login link that expires in 30 days. Employees only see and share their own reports. Pinned-report `form_data` carries `_fieldOrder`, because jsonb doesn't keep key order.

**Photo evidence is camera-only and mandatory for every checkpoint.** `CameraCapture.jsx` uses `getUserMedia` and deliberately has no `<input type="file">` — a compliance requirement, not an oversight. `getUserMedia` needs HTTPS (or localhost), so phone testing over a plain LAN IP cannot open the camera. `requires_photo` is forced true on every item by an `UPDATE` in `migrate.js`, and `ChecklistRun` requires a photo before a checkpoint counts as answered.

## Seed content and provenance

Library content lives in `server/db/seed_*.sql`. **Any new seed file must be added to both `server/src/db/migrate.js` and `server/test-utils/db.js`**, or it won't apply on a fresh install or be exercised by tests.

Content provenance matters and is recorded in each seed file's header:
- `INTERNAL_QC` and SOP 1–11 (`standard = 'SOP'`) were **transcribed from the client's own documents**; `is_critical` mirrors their own ⚠ marks. Don't "correct" this content from outside research — raise it with the client.
- SOP 12–20 (`seed_additional_sops.sql`) and the Convenience Store section (`standard = 'C_STORE'`, `seed_convenience_store.sql`) were **researched from public sources** at the client's request — reviewable starting points, not client-verified. C-Store temperatures are US FDA figures pending local confirmation.

Items need an explicit `sort_order`: a multi-row `INSERT` does not guarantee row order. `npm run db:migrate` is not idempotent for seed data — re-running it duplicates library rows.

Don't edit seed SQL (or anything with em dashes/Arabic/French) via PowerShell `-replace`; it has corrupted a file into mojibake before. Use the Write/Edit tools. Dry-run new seed SQL inside `BEGIN; … ROLLBACK;` first.

## Internationalization

- **UI strings**: `web/src/i18n/{en,ar,fr}.js`, used via `useT()` / `useI18n()`. `en.js` is the source key set; missing keys fall back to English. `I18nProvider` sets `<html lang dir>`; Arabic is RTL, so prefer logical CSS (`text-align: start`) and check new layouts with `dir="rtl"` (the mobile drawer has explicit `[dir='rtl']` rules).
- **Library content**: translated server-side via the `content_translations` table, keyed by the **exact English source string** (not item id — seeded ids change on every re-seed). Dictionaries are `server/db/translations/*.js`, upserted by `loadTranslations()` (runs in migrate and test reset). The English rows in `checklist_items` are never overwritten, and rows marked `source = 'reviewed'` are never clobbered by the loader. `translateRows()` applies translations to `text`/`description`/`category` using `?lang=` or the user's saved `users.language`.
- Because matching is exact, a one-character difference silently falls back to English. Run `node scripts/check-translation-coverage.js` (from `server/`) after editing seeds or dictionaries; it reports coverage and orphaned keys. `SOP N:` prefixes and QC section letters (A/B/C, W1/M1/Q1) are intentionally left untranslated — they reference the client's own numbered manual.

## Mobile UI conventions

Styling is a single hand-written `web/src/styles/theme.css` with CSS custom properties — no framework. Under 768px the sidebar becomes an off-canvas drawer and a fixed bottom tab bar appears; `.main` and `.sticky-action-bar` are offset to clear it. Wrap every `<table>` in `.table-scroll` (the page has `overflow-x: hidden`, so an unwrapped wide table gets clipped silently). Two-column form layouts use `.form-grid-2col`, not inline grid styles, so they can collapse on mobile. Icons come from `web/src/components/icons.jsx`, drawn only from line/rect/circle/polygon primitives.

A `<label>` wrapping a checkbox binds to the *first* labelable element inside it — a nested `<button>` steals the click. Use explicit `htmlFor`/`id` when a label contains buttons (see `ChecklistBuilder.jsx`).

## Local dev gotchas

- The API server does not hot-reload route changes unless started with `npm run dev:server` (`node --watch`); a plain `node src/index.js` needs a restart.
- If the Checklist Builder shows no items or `/api` requests through the Vite proxy hang with `ECONNRESET`, restart the API and Vite dev servers, then hard-reload the page.
- CORS reflects any origin outside `NODE_ENV=production`, and Vite binds all interfaces with `allowedHosts: ['.trycloudflare.com']`, so the app works over a LAN IP or a Cloudflare quick tunnel (the only way to get HTTPS for camera testing on a phone).
- **For phone testing, tunnel the production build, not Vite.** Through a Cloudflare tunnel the Vite dev proxy intermittently stalls on large API responses (the ~200KB checkpoint library hung 4 requests in a row), which on a phone looks like an empty library. Instead: `npm run build:web`, then from `server/` run the API with `NODE_ENV=production` and `PORT=4100` (it serves `web/dist` itself), and `cloudflared tunnel --url http://127.0.0.1:4100`. Rebuild after web changes; restart that server after server changes (it isn't `--watch`). This is also the only setup where the service worker registers — it's disabled in dev.
- Onboarding steps are server-controlled past checkout: `PATCH /tenants/current` only accepts `pricing`/`checkout`, and `/onboarding/complete` requires a paid tenant. Tests get a set-up tenant via `completeSetup(api, token)` in `test-utils/server.js`.

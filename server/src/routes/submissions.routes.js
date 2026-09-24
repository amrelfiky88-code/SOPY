import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { query } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { translateRows, requestLanguage } from '../i18n/translateContent.js';
import { signPhotos } from '../uploads.js';
import { SHARE_ROOT, SHARE_DAYS, sweepSoon } from '../shares.js';

export const submissionsRouter = Router();

const UPLOAD_ROOT = path.resolve('uploads');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB per photo
  fileFilter: (req, file, cb) => {
    // Evidence photos must come from the in-app camera capture, which
    // always produces image/jpeg or image/png blobs. Reject anything else
    // so a swapped-in file-picker can't be used to slip past this check.
    if (!/^image\/(jpeg|png)$/.test(file.mimetype)) {
      return cb(Object.assign(new Error('Only camera-captured JPEG/PNG images are accepted'), { status: 400 }));
    }
    cb(null, true);
  },
});

// Writes are only allowed on this tenant's submissions, and only while
// they're still in progress — a submitted report is a record, not a draft.
// Staff can only change their own runs (as they can only see their own);
// before, any employee could answer or sign off a colleague's checklist.
async function findOpenSubmission(req, res) {
  const { rows } = await query(
    'SELECT id, status, template_id, submitted_by FROM checklist_submissions WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.auth.tenantId]
  );
  if (!rows[0] || (SEES_OWN_ONLY.includes(req.auth.role) && rows[0].submitted_by !== req.auth.userId)) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  if (rows[0].status !== 'in_progress') { res.status(409).json({ error: 'This report has already been submitted' }); return null; }
  return rows[0];
}

// Start a checklist run
submissionsRouter.post('/', requireAuth, async (req, res) => {
  const { templateId, branchId, assignmentId } = req.body;
  if (!templateId || !branchId) return res.status(400).json({ error: 'templateId and branchId are required' });

  const { rows: owned } = await query(
    `SELECT
       EXISTS (SELECT 1 FROM checklist_templates WHERE id = $1 AND tenant_id = $3) AS template_ok,
       EXISTS (SELECT 1 FROM branches WHERE id = $2 AND tenant_id = $3 AND is_active) AS branch_ok`,
    [templateId, branchId, req.auth.tenantId]
  );
  if (!owned[0].template_ok || !owned[0].branch_ok) return res.status(404).json({ error: 'Checklist or store not found' });

  if (assignmentId) {
    const { rows: ok } = await query(
      'SELECT 1 FROM checklist_assignments WHERE id = $1 AND tenant_id = $2',
      [assignmentId, req.auth.tenantId]
    );
    if (!ok[0]) return res.status(404).json({ error: 'Assignment not found' });
  }

  // Tapping Start on an assigned checklist again during the shift picks up
  // the run already underway rather than opening a second, empty one.
  // "This shift" is a rolling 16 hours, not "since midnight": midnight
  // here meant UTC (2-3am in Cairo), so a run started at 1am and resumed
  // at 3am was missed and duplicated.
  if (assignmentId) {
    const { rows: open } = await query(
      `SELECT * FROM checklist_submissions
       WHERE tenant_id = $1 AND assignment_id = $2 AND branch_id = $3 AND submitted_by = $4
         AND status = 'in_progress' AND started_at >= now() - interval '16 hours'
       ORDER BY started_at DESC LIMIT 1`,
      [req.auth.tenantId, assignmentId, branchId, req.auth.userId]
    );
    if (open[0]) return res.status(200).json({ submission: open[0], resumed: true });
  }

  const { rows } = await query(
    `INSERT INTO checklist_submissions (tenant_id, assignment_id, template_id, branch_id, submitted_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.auth.tenantId, assignmentId || null, templateId, branchId, req.auth.userId]
  );
  res.status(201).json({ submission: rows[0] });
});

// The caller's own unfinished report of this kind at this store, started
// within the last 16 hours (see the resume note above) — lets "Save
// progress" survive a reload instead of orphaning the draft. Must stay
// above '/:id' so 'draft' isn't read as an id.
submissionsRouter.get('/draft', requireAuth, async (req, res) => {
  const { kind, branchId } = req.query;
  if (!kind || !branchId) return res.status(400).json({ error: 'kind and branchId are required' });
  const { rows } = await query(
    `SELECT s.* FROM checklist_submissions s
     JOIN checklist_templates t ON t.id = s.template_id
     WHERE s.tenant_id = $1 AND s.submitted_by = $2 AND s.branch_id = $3 AND t.kind = $4
       AND s.status = 'in_progress' AND s.started_at >= now() - interval '16 hours'
     ORDER BY s.started_at DESC LIMIT 1`,
    [req.auth.tenantId, req.auth.userId, branchId, kind]
  );
  res.json({ submission: rows[0] || null });
});

// Autosave structured form data (temperature_log, receiving_log, waste_log, equipment_status, notes)
submissionsRouter.patch('/:id', requireAuth, async (req, res) => {
  const { formData, hasIncident } = req.body;
  const fields = [];
  const values = [];
  let i = 1;
  if (formData !== undefined) {
    if (formData === null || typeof formData !== 'object') return res.status(400).json({ error: 'formData must be an object' });
    const json = JSON.stringify(formData);
    // A full Kitchen report is a few KB; this only stops a runaway client
    // (or a crafted request) storing megabytes per row.
    if (json.length > 512_000) return res.status(413).json({ error: 'This report is too large to save' });
    fields.push(`form_data = $${i++}`); values.push(json);
  }
  if (hasIncident !== undefined) { fields.push(`has_incident = $${i++}`); values.push(!!hasIncident); }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  if (!(await findOpenSubmission(req, res))) return;

  values.push(req.params.id, req.auth.tenantId);
  const { rows } = await query(
    `UPDATE checklist_submissions SET ${fields.join(', ')} WHERE id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ submission: rows[0] });
});

// A latitude/longitude from the phone, or null if missing or nonsense
// (Number('abc') is NaN, which Postgres happily stores).
function coordinate(value, max) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

// One checklist-item response. Photo evidence must arrive as a multipart
// 'photo' field captured live in-app — see CameraCapture.jsx on the
// frontend, which never renders a file input.
submissionsRouter.post('/:id/responses', requireAuth, upload.single('photo'), async (req, res) => {
  const { itemId, isCompliant, valueText, gpsLat, gpsLng } = req.body;
  if (!itemId) return res.status(400).json({ error: 'itemId is required' });
  if (typeof valueText === 'string' && valueText.length > 2000) {
    return res.status(400).json({ error: 'Keep the note under 2000 characters' });
  }
  const submission = await findOpenSubmission(req, res);
  if (!submission) return;

  const { rows: inTemplate } = await query(
    'SELECT 1 FROM checklist_template_items WHERE template_id = $1 AND item_id = $2',
    [submission.template_id, itemId]
  );
  if (!inTemplate[0]) return res.status(400).json({ error: 'That checkpoint is not part of this checklist' });

  let photoPath = null;
  if (req.file) {
    const dir = path.join(UPLOAD_ROOT, req.auth.tenantId, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
    const filename = `${itemId}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(dir, filename), req.file.buffer);
    photoPath = `/uploads/${req.auth.tenantId}/${req.params.id}/${filename}`;
  }

  const compliant = isCompliant === undefined ? null : isCompliant === 'true' || isCompliant === true;

  // One response per checkpoint. The run page saves the answer, the
  // reading and the photo as separate calls, in whatever order the user
  // taps them, so each call only overwrites the fields it actually sent.
  // (Inserting a row per call left an answer given after the photo
  // unsaved, and duplicate rows skewed the scorecard.)
  const { rows: existing } = await query(
    `SELECT id, photo_path FROM checklist_submission_responses WHERE submission_id = $1 AND item_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [req.params.id, itemId]
  );
  const gps = [coordinate(gpsLat, 90), coordinate(gpsLng, 180)];
  // Evidence time is the server's clock, never the client's: accepting a
  // capturedAt from the request let a photo be backdated.
  const capturedAt = new Date().toISOString();
  let rows;
  if (existing[0]) {
    ({ rows } = await query(
      `UPDATE checklist_submission_responses SET
         is_compliant = CASE WHEN $2::boolean IS NULL THEN is_compliant ELSE $2::boolean END,
         value_text   = CASE WHEN $3::boolean THEN $4 ELSE value_text END,
         photo_path   = COALESCE($5, photo_path),
         gps_lat      = COALESCE($6, gps_lat),
         gps_lng      = COALESCE($7, gps_lng),
         captured_at  = CASE WHEN $5::text IS NULL THEN captured_at ELSE $8::timestamptz END
       WHERE id = $1 RETURNING *`,
      [existing[0].id, compliant, valueText !== undefined, valueText || null, photoPath, ...gps,
        capturedAt]
    ));
    // A retake replaces the photo; the old file used to stay on disk for
    // ever with nothing pointing at it.
    const old = existing[0].photo_path;
    if (photoPath && old && old !== photoPath && old.startsWith('/uploads/')) {
      fs.rm(path.join(UPLOAD_ROOT, old.slice('/uploads/'.length)), { force: true }, () => {});
    }
  } else {
    ({ rows } = await query(
      `INSERT INTO checklist_submission_responses
         (submission_id, item_id, is_compliant, value_text, photo_path, gps_lat, gps_lng, captured_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.params.id, itemId, compliant, valueText || null, photoPath, ...gps, capturedAt]
    ));
  }

  // A failing response on a critical checkpoint (the ⚠ items from the
  // source QC documents — e.g. fridge temps, fire extinguishers, mystery
  // shop) auto-escalates: the submission is flagged as an incident the
  // moment it happens, not only if someone remembers to tick the box.
  if (compliant === false) {
    const { rows: itemRows } = await query('SELECT is_critical FROM checklist_items WHERE id = $1', [itemId]);
    if (itemRows[0]?.is_critical) {
      await query('UPDATE checklist_submissions SET has_incident = true WHERE id = $1', [req.params.id]);
    }
  }

  res.status(201).json({ response: signPhotos(rows)[0] });
});

submissionsRouter.post('/:id/submit', requireAuth, async (req, res) => {
  const { gpsLat, gpsLng } = req.body;
  const open = await findOpenSubmission(req, res);
  if (!open) return;

  // Photo evidence is mandatory for every checkpoint, and each needs an
  // answer (a written finding for the Consumer Behavior observation
  // points). The run page enforces this, but the API didn't: a direct
  // call could sign off a checklist with nothing answered.
  const { rows: missing } = await query(
    `SELECT count(*)::int AS n
     FROM checklist_template_items ti
     JOIN checklist_items ci ON ci.id = ti.item_id
     LEFT JOIN LATERAL (
       SELECT is_compliant, value_text, photo_path FROM checklist_submission_responses
       WHERE submission_id = $1 AND item_id = ci.id ORDER BY created_at DESC LIMIT 1
     ) r ON true
     WHERE ti.template_id = $2
       AND (r.photo_path IS NULL
            OR (coalesce(ci.category, '') LIKE '%Consumer Behavior%' AND coalesce(btrim(r.value_text), '') = '')
            OR (coalesce(ci.category, '') NOT LIKE '%Consumer Behavior%' AND r.is_compliant IS NULL))`,
    [open.id, open.template_id]
  );
  if (missing[0].n > 0) {
    return res.status(400).json({ error: `Answer every checkpoint, with a photo, before submitting (${missing[0].n} left).` });
  }

  const { rows } = await query(
    `UPDATE checklist_submissions
     SET status = 'submitted', submitted_at = now(), gps_lat = $1, gps_lng = $2,
         signed_off_by = $3, signed_off_at = now()
     WHERE id = $4 AND tenant_id = $5 RETURNING *`,
    [coordinate(gpsLat, 90), coordinate(gpsLng, 180), req.auth.userId, req.params.id, req.auth.tenantId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ submission: rows[0] });
});

// Staff see only their own runs here too, as on /report — this and the
// scorecard used to hand any employee a colleague's answers and photos.
const canSee = (req, submission) =>
  !!submission && (!SEES_OWN_ONLY.includes(req.auth.role) || submission.submitted_by === req.auth.userId);

submissionsRouter.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM checklist_submissions WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.auth.tenantId]
  );
  if (!canSee(req, rows[0])) return res.status(404).json({ error: 'Not found' });
  const { rows: responses } = await query(
    `SELECT r.*, ci.text AS item_text FROM checklist_submission_responses r
     JOIN checklist_items ci ON ci.id = r.item_id
     WHERE r.submission_id = $1 ORDER BY r.created_at`,
    [req.params.id]
  );
  res.json({ submission: rows[0], responses: signPhotos(responses) });
});

// Section-by-section score, critical-fail count, and Green/Amber/Red
// status — the "scoring discipline" from the source QC documents.
// Grouped by the item's own category (e.g. "Daily QC — B. Food Safety &
// Temperature Control") since that's where each item's section already
// lives; items with no compliant/non-compliant answer (the free-text
// "Consumer Behavior & Insights" observation points) don't count toward
// the score, matching how the source document excludes that section from
// its own point total.
submissionsRouter.get('/:id/scorecard', requireAuth, async (req, res) => {
  const { rows: subRows } = await query(
    'SELECT * FROM checklist_submissions WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.auth.tenantId]
  );
  const submission = subRows[0];
  if (!canSee(req, submission)) return res.status(404).json({ error: 'Not found' });
  const scorecard = await computeScorecard(submission);
  scorecard.sections = await translateRows(scorecard.sections, await requestLanguage(req), ['category']);
  res.json(scorecard);
});

async function computeScorecard(submission) {
  const { rows } = await query(
    `SELECT ci.category, ci.is_critical, r.is_compliant
     FROM checklist_template_items ti
     JOIN checklist_items ci ON ci.id = ti.item_id
     LEFT JOIN LATERAL (
       -- latest answer per checkpoint; older runs could hold duplicates
       SELECT is_compliant FROM checklist_submission_responses
       WHERE item_id = ci.id AND submission_id = $1
       ORDER BY created_at DESC LIMIT 1
     ) r ON true
     WHERE ti.template_id = $2`,
    [submission.id, submission.template_id]
  );

  const sections = {};
  let totalScored = 0, totalCompliant = 0, criticalFails = 0;

  for (const row of rows) {
    const key = row.category || 'General';
    sections[key] = sections[key] || { total: 0, compliant: 0, criticalFails: 0 };
    if (row.is_compliant !== null) {
      sections[key].total += 1;
      totalScored += 1;
      if (row.is_compliant) {
        sections[key].compliant += 1;
        totalCompliant += 1;
      } else if (row.is_critical) {
        sections[key].criticalFails += 1;
        criticalFails += 1;
      }
    }
  }

  const percentage = totalScored ? Math.round((totalCompliant / totalScored) * 1000) / 10 : null;
  let ragStatus = 'red';
  if (criticalFails === 0 && percentage !== null) {
    if (percentage >= 95) ragStatus = 'green';
    else if (percentage >= 85) ragStatus = 'amber';
  }

  return {
    percentage,
    totalScored,
    totalCompliant,
    criticalFails,
    ragStatus,
    sections: Object.entries(sections).map(([category, s]) => ({
      category,
      total: s.total,
      compliant: s.compliant,
      criticalFails: s.criticalFails,
      percentage: s.total ? Math.round((s.compliant / s.total) * 1000) / 10 : null,
    })),
  };
}

// Staff see their own reports; managers and up see the whole business's.
const SEES_OWN_ONLY = ['employee'];

// Everything needed to render (and PDF) a finished report in one call:
// header details, the checklist's checkpoints with their answers and
// photos, the score, and a pinned report's form data.
submissionsRouter.get('/:id/report', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT s.*, t.name AS template_name, t.kind, b.name AS branch_name, b.city AS branch_city,
            u.full_name AS submitted_by_name, tn.restaurant_name
     FROM checklist_submissions s
     JOIN checklist_templates t ON t.id = s.template_id
     JOIN branches b ON b.id = s.branch_id
     JOIN users u ON u.id = s.submitted_by
     JOIN tenants tn ON tn.id = s.tenant_id
     WHERE s.id = $1 AND s.tenant_id = $2`,
    [req.params.id, req.auth.tenantId]
  );
  const submission = rows[0];
  if (!submission) return res.status(404).json({ error: 'Not found' });
  if (SEES_OWN_ONLY.includes(req.auth.role) && submission.submitted_by !== req.auth.userId) {
    return res.status(404).json({ error: 'Not found' });
  }

  const { rows: itemRows } = await query(
    `SELECT ci.id, ci.text, ci.description, ci.category, ci.is_critical, ti.sort_order,
            r.is_compliant, r.value_text, r.photo_path, r.captured_at
     FROM checklist_template_items ti
     JOIN checklist_items ci ON ci.id = ti.item_id
     LEFT JOIN LATERAL (
       SELECT is_compliant, value_text, photo_path, captured_at FROM checklist_submission_responses
       WHERE item_id = ci.id AND submission_id = $1
       ORDER BY created_at DESC LIMIT 1
     ) r ON true
     WHERE ti.template_id = $2
     ORDER BY ti.sort_order`,
    [submission.id, submission.template_id]
  );
  const lang = await requestLanguage(req);
  const items = signPhotos(await translateRows(itemRows, lang, ['text', 'description', 'category']));
  let scorecard = null;
  if (itemRows.length) {
    scorecard = await computeScorecard(submission);
    // Section names are item categories, so translate them the same way.
    scorecard.sections = await translateRows(scorecard.sections, lang, ['category']);
  }

  res.json({ submission, items, scorecard });
});

// Share links for WhatsApp/email: the browser renders the PDF (so Arabic
// and French come out exactly as on screen), uploads it here, and gets
// back an unguessable link that works without logging in until it expires.
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(Object.assign(new Error('Only PDF files can be shared'), { status: 400 }));
    }
    cb(null, true);
  },
});

submissionsRouter.post('/:id/share', requireAuth, pdfUpload.single('pdf'), async (req, res) => {
  const { rows } = await query(
    'SELECT id, status, submitted_by FROM checklist_submissions WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.auth.tenantId]
  );
  const submission = rows[0];
  if (!submission || (SEES_OWN_ONLY.includes(req.auth.role) && submission.submitted_by !== req.auth.userId)) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (submission.status !== 'submitted') return res.status(409).json({ error: 'Submit the report before sharing it' });
  if (!req.file || req.file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return res.status(400).json({ error: 'A PDF file is required' });
  }

  const token = crypto.randomBytes(24).toString('base64url');
  fs.mkdirSync(SHARE_ROOT, { recursive: true });
  fs.writeFileSync(path.join(SHARE_ROOT, `${token}.pdf`), req.file.buffer);
  const fileName = String(req.body.fileName || 'SOPY report.pdf').replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 120) || 'SOPY report.pdf';

  const { rows: shareRows } = await query(
    `INSERT INTO report_shares (tenant_id, submission_id, token, file_name, created_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' days')::interval) RETURNING expires_at`,
    [req.auth.tenantId, submission.id, token, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`, req.auth.userId, String(SHARE_DAYS)]
  );
  sweepSoon();
  res.status(201).json({ path: `/api/shared/${token}`, expiresAt: shareRows[0].expires_at });
});

// The list pages through with ?before=<cursor> (nextBefore from the
// previous page). It used to stop at the newest 200 — a busy restaurant's
// older reports simply vanished from it — and sent every report's whole
// form_data, which the list never shows.
const LIST_COLUMNS = `s.id, s.tenant_id, s.template_id, s.branch_id, s.assignment_id, s.submitted_by, s.status,
  s.started_at, s.submitted_at, s.has_incident, coalesce(s.submitted_at, s.started_at) AS sort_at`;

submissionsRouter.get('/', requireAuth, async (req, res) => {
  const { branchId, from, to, status, before } = req.query;
  if (status !== undefined && !['in_progress', 'submitted'].includes(status)) return res.status(400).json({ error: 'Unknown status' });
  const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  // Qualified with s. — branches, users and templates share these column
  // names, and unqualified they made every call fail as ambiguous.
  const clauses = ['s.tenant_id = $1'];
  const params = [req.auth.tenantId];
  let i = 2;
  if (SEES_OWN_ONLY.includes(req.auth.role)) { clauses.push(`s.submitted_by = $${i++}`); params.push(req.auth.userId); }
  if (branchId) { clauses.push(`s.branch_id = $${i++}`); params.push(branchId); }
  if (from) { clauses.push(`s.started_at >= $${i++}`); params.push(from); }
  if (to) { clauses.push(`s.started_at <= $${i++}`); params.push(to); }
  if (status) { clauses.push(`s.status = $${i++}`); params.push(status); }
  if (before) {
    const [at, id] = String(before).split('|');
    if (!at || !id) return res.status(400).json({ error: 'Invalid id' });
    clauses.push(`(coalesce(s.submitted_at, s.started_at), s.id) < ($${i++}::timestamptz, $${i++}::uuid)`);
    params.push(at, id);
  }
  params.push(limit + 1);

  const { rows } = await query(
    `SELECT ${LIST_COLUMNS}, t.name AS template_name, t.kind, b.name AS branch_name, u.full_name AS submitted_by_name
     FROM checklist_submissions s
     JOIN checklist_templates t ON t.id = s.template_id
     JOIN branches b ON b.id = s.branch_id
     JOIN users u ON u.id = s.submitted_by
     WHERE ${clauses.join(' AND ')}
     ORDER BY coalesce(s.submitted_at, s.started_at) DESC, s.id DESC LIMIT $${i}`,
    params
  );
  const more = rows.length > limit;
  const page = more ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  res.json({
    submissions: page,
    nextBefore: more ? `${new Date(last.sort_at).toISOString()}|${last.id}` : null,
  });
});

import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { query } from '../db.js';
import { requireAuth } from '../auth/middleware.js';

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
      return cb(new Error('Only camera-captured JPEG/PNG images are accepted'));
    }
    cb(null, true);
  },
});

// Start a checklist run
submissionsRouter.post('/', requireAuth, async (req, res) => {
  const { templateId, branchId, assignmentId } = req.body;
  if (!templateId || !branchId) return res.status(400).json({ error: 'templateId and branchId are required' });

  const { rows } = await query(
    `INSERT INTO checklist_submissions (tenant_id, assignment_id, template_id, branch_id, submitted_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.auth.tenantId, assignmentId || null, templateId, branchId, req.auth.userId]
  );
  res.status(201).json({ submission: rows[0] });
});

// Autosave structured form data (temperature_log, receiving_log, waste_log, equipment_status, notes)
submissionsRouter.patch('/:id', requireAuth, async (req, res) => {
  const { formData, hasIncident } = req.body;
  const fields = [];
  const values = [];
  let i = 1;
  if (formData !== undefined) { fields.push(`form_data = $${i++}`); values.push(JSON.stringify(formData)); }
  if (hasIncident !== undefined) { fields.push(`has_incident = $${i++}`); values.push(!!hasIncident); }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

  values.push(req.params.id, req.auth.tenantId);
  const { rows } = await query(
    `UPDATE checklist_submissions SET ${fields.join(', ')} WHERE id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ submission: rows[0] });
});

// One checklist-item response. Photo evidence must arrive as a multipart
// 'photo' field captured live in-app — see CameraCapture.jsx on the
// frontend, which never renders a file input.
submissionsRouter.post('/:id/responses', requireAuth, upload.single('photo'), async (req, res) => {
  const { itemId, isCompliant, valueText, gpsLat, gpsLng, capturedAt } = req.body;
  if (!itemId) return res.status(400).json({ error: 'itemId is required' });

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

  const { rows } = await query(
    `INSERT INTO checklist_submission_responses
       (submission_id, item_id, is_compliant, value_text, photo_path, gps_lat, gps_lng, captured_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      req.params.id, itemId, compliant,
      valueText || null, photoPath,
      gpsLat ? Number(gpsLat) : null, gpsLng ? Number(gpsLng) : null,
      capturedAt || new Date().toISOString(),
    ]
  );

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

  res.status(201).json({ response: rows[0] });
});

submissionsRouter.post('/:id/submit', requireAuth, async (req, res) => {
  const { gpsLat, gpsLng, signedOffBy } = req.body;
  const { rows } = await query(
    `UPDATE checklist_submissions
     SET status = 'submitted', submitted_at = now(), gps_lat = $1, gps_lng = $2,
         signed_off_by = $3, signed_off_at = now()
     WHERE id = $4 AND tenant_id = $5 RETURNING *`,
    [gpsLat || null, gpsLng || null, signedOffBy || req.auth.userId, req.params.id, req.auth.tenantId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ submission: rows[0] });
});

submissionsRouter.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM checklist_submissions WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.auth.tenantId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  const { rows: responses } = await query(
    `SELECT r.*, ci.text AS item_text FROM checklist_submission_responses r
     JOIN checklist_items ci ON ci.id = r.item_id
     WHERE r.submission_id = $1 ORDER BY r.created_at`,
    [req.params.id]
  );
  res.json({ submission: rows[0], responses });
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
  if (!submission) return res.status(404).json({ error: 'Not found' });

  const { rows } = await query(
    `SELECT ci.category, ci.is_critical, r.is_compliant
     FROM checklist_template_items ti
     JOIN checklist_items ci ON ci.id = ti.item_id
     LEFT JOIN checklist_submission_responses r ON r.item_id = ci.id AND r.submission_id = $1
     WHERE ti.template_id = $2`,
    [req.params.id, submission.template_id]
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

  res.json({
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
  });
});

submissionsRouter.get('/', requireAuth, async (req, res) => {
  const { branchId, from, to, status } = req.query;
  const clauses = ['tenant_id = $1'];
  const params = [req.auth.tenantId];
  let i = 2;
  if (branchId) { clauses.push(`branch_id = $${i++}`); params.push(branchId); }
  if (from) { clauses.push(`started_at >= $${i++}`); params.push(from); }
  if (to) { clauses.push(`started_at <= $${i++}`); params.push(to); }
  if (status) { clauses.push(`status = $${i++}`); params.push(status); }

  const { rows } = await query(
    `SELECT s.*, t.name AS template_name, t.kind, b.name AS branch_name, u.full_name AS submitted_by_name
     FROM checklist_submissions s
     JOIN checklist_templates t ON t.id = s.template_id
     JOIN branches b ON b.id = s.branch_id
     JOIN users u ON u.id = s.submitted_by
     WHERE ${clauses.join(' AND ')}
     ORDER BY s.started_at DESC LIMIT 200`,
    params
  );
  res.json({ submissions: rows });
});

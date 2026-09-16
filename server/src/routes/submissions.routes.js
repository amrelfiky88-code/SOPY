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

  const { rows } = await query(
    `INSERT INTO checklist_submission_responses
       (submission_id, item_id, is_compliant, value_text, photo_path, gps_lat, gps_lng, captured_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      req.params.id, itemId,
      isCompliant === undefined ? null : isCompliant === 'true' || isCompliant === true,
      valueText || null, photoPath,
      gpsLat ? Number(gpsLat) : null, gpsLng ? Number(gpsLng) : null,
      capturedAt || new Date().toISOString(),
    ]
  );
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

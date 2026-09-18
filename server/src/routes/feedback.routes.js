import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth/middleware.js';

export const feedbackRouter = Router();

export const FEEDBACK_CATEGORIES = ['bug', 'idea', 'other'];
export const FEEDBACK_MAX_LENGTH = 2000;

// Any signed-in user, any role — the person most likely to hit a
// confusing screen is an employee on a phone mid-shift, not a manager.
feedbackRouter.post('/', requireAuth, async (req, res) => {
  const { category, message, pagePath } = req.body;
  const text = typeof message === 'string' ? message.trim() : '';

  if (!FEEDBACK_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Choose what kind of feedback this is.' });
  }
  if (!text) return res.status(400).json({ error: 'Write a message before sending.' });
  if (text.length > FEEDBACK_MAX_LENGTH) {
    return res.status(400).json({ error: `Keep it under ${FEEDBACK_MAX_LENGTH} characters.` });
  }

  const { rows } = await query(
    `INSERT INTO feedback (tenant_id, user_id, category, message, page_path)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, category, message, page_path, created_at`,
    [req.auth.tenantId, req.auth.userId, category, text, typeof pagePath === 'string' ? pagePath.slice(0, 300) : null]
  );
  res.status(201).json({ feedback: rows[0] });
});

import { Router } from 'express';
import { calculatePricing } from '../../../shared/pricing.js';

export const pricingRouter = Router();

// Public — the Pricing page calls this so the number on screen always
// comes from the same calculator that billing uses.
pricingRouter.get('/calculate', (req, res) => {
  const branches = Number(req.query.branches);
  const users = Number(req.query.users);
  if (!Number.isFinite(branches) || !Number.isFinite(users) || branches < 0 || users < 0) {
    return res.status(400).json({ error: 'branches and users must be non-negative numbers' });
  }
  res.json(calculatePricing({ branches, users }));
});

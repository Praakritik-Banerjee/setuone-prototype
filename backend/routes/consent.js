const express = require('express');
const { randomUUID } = require('crypto');
const { load, save } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { isNonEmptyString } = require('../validation');

const router = express.Router();

// Citizen grants a department permission to pull specific data (e.g. income
// records) from another department instead of asking the citizen to re-submit it.
router.post('/', requireAuth, requireRole('citizen'), (req, res) => {
  const { departmentId, purpose, validForDays } = req.body || {};
  if (!isNonEmptyString(departmentId) || !isNonEmptyString(purpose)) return res.status(400).json({ error: 'departmentId and purpose are required' });
  if (validForDays !== undefined && (!Number.isInteger(validForDays) || validForDays < 1 || validForDays > 3650)) {
    return res.status(400).json({ error: 'validForDays must be an integer between 1 and 3650' });
  }
  const db = load();
  if (!db.departments.some(department => department.id === departmentId)) return res.status(400).json({ error: 'Unknown department' });
  const consent = {
    id: randomUUID(),
    citizenId: req.user.id,
    departmentId,
    purpose,
    status: 'granted',
    grantedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + (validForDays || 90) * 86400000).toISOString()
  };
  db.consents.push(consent);
  logAction(db, { actor: req.user.name, actorRole: req.user.role, action: 'CONSENT_GRANTED', entity: 'consent', entityId: consent.id, details: { departmentId, purpose } });
  save(db);
  res.status(201).json(consent);
});

router.get('/mine', requireAuth, (req, res) => {
  const db = load();
  res.json(db.consents.filter(c => c.citizenId === req.user.id));
});

router.post('/:id/revoke', requireAuth, (req, res) => {
  const db = load();
  const consent = db.consents.find(c => c.id === req.params.id && c.citizenId === req.user.id);
  if (!consent) return res.status(404).json({ error: 'Consent record not found' });
  consent.status = 'revoked';
  logAction(db, { actor: req.user.name, actorRole: req.user.role, action: 'CONSENT_REVOKED', entity: 'consent', entityId: consent.id });
  save(db);
  res.json(consent);
});

module.exports = router;

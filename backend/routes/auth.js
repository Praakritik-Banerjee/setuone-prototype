const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { load, save } = require('../db');
const { sign } = require('../middleware/auth');
const { logAction } = require('../audit');
const { validateEmail, validateRegistration } = require('../validation');
const { findPotentialDuplicates, createFlag } = require('../mdm');

const router = express.Router();

// Single login endpoint shared by every "department portal" — this is the
// federated identity / SSO layer: one credential, one token, works everywhere.
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !validateEmail(email) || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'A valid email and password are required' });
  }
  const db = load();
  const user = db.users.find(u => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = sign(user);
  logAction(db, { actor: user.name, actorRole: user.role, action: 'LOGIN', entity: 'user', entityId: user.id });
  save(db);
  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, departmentId: user.departmentId || null, email: user.email }
  });
});

// Citizen self-registration — feeds the Master Data Management dedupe check.
router.post('/register-citizen', (req, res) => {
  const body = req.body || {};
  const { name, aadhaar, mobile, email, password, dateOfBirth } = body;
  const validationErrors = validateRegistration(body);
  if (validationErrors.length) return res.status(400).json({ error: 'Invalid registration data', details: validationErrors });
  const db = load();
  const dup = db.users.find(u => u.mobile === mobile || u.email === email || (aadhaar && u.aadhaar === aadhaar));
  if (dup) {
    return res.status(409).json({ error: 'A citizen record already exists with this Aadhaar/mobile/email (MDM dedupe match)', existingId: dup.id });
  }
  const user = { id: randomUUID(), name, role: 'citizen', aadhaar: aadhaar || null, mobile, email, dateOfBirth: dateOfBirth || null, passwordHash: bcrypt.hashSync(password, 8) };
  db.users.push(user);
  const potentialDuplicates = findPotentialDuplicates(db, user)
    .filter(match => match.user.id !== user.id);
  potentialDuplicates.forEach(match => createFlag(db, user.id, match));
  logAction(db, { actor: name, actorRole: 'citizen', action: 'REGISTER', entity: 'user', entityId: user.id });
  save(db);
  const token = sign(user);
  res.status(201).json({ token, user: { id: user.id, name, role: 'citizen', email } });
});

module.exports = router;

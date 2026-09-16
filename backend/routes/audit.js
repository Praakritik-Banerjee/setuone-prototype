const express = require('express');
const { load } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  res.json(db.auditLogs.slice(-500).reverse());
});

module.exports = router;

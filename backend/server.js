// server.js — the API Gateway / middleware layer described in the problem
// statement: one entry point that fronts every department's services,
// enforces auth + RBAC, and logs everything for audit.
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const citizenRoutes = require('./routes/citizens');
const consentRoutes = require('./routes/consent');
const applicationRoutes = require('./routes/applications');
const connectorRoutes = require('./routes/connectorRoutes');
const auditRoutes = require('./routes/audit');
const dashboardRoutes = require('./routes/dashboard');
const grievanceRoutes = require('./routes/grievances');
const { load } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Simple request log (would be replaced by a real observability stack)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.get('/api/departments', (req, res) => {
  const db = load();
  res.json(db.departments);
});

app.use('/api/auth', authRoutes);
app.use('/api/citizens', citizenRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/connectors', connectorRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/grievances', grievanceRoutes);

// Serve the frontend (static files) so the whole prototype runs from one process.
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must contain valid JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\nGov Interoperability Platform API running on http://localhost:${PORT}`);
  console.log(`Frontend served at            http://localhost:${PORT}/index.html\n`);
});

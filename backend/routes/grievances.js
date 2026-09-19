const express = require('express');
const { randomUUID } = require('crypto');
const { load, save } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { isNonEmptyString } = require('../validation');

const router = express.Router();
const SLA_HOURS = 72;

function enrich(grievance, db) {
  const application = db.applications.find(app => app.id === grievance.applicationId);
  const service = application && db.services.find(item => item.id === application.serviceId);
  const department = db.departments.find(item => item.id === grievance.departmentId);
  const deadline = new Date(new Date(grievance.createdAt).getTime() + SLA_HOURS * 3600000);
  return {
    ...grievance,
    serviceName: service?.name,
    departmentName: department?.name,
    slaDeadline: deadline.toISOString(),
    slaBreached: grievance.status !== 'Resolved' && new Date() > deadline
  };
}

router.post('/', requireAuth, requireRole('citizen'), (req, res) => {
  const { applicationId, subject, description } = req.body || {};
  if (!isNonEmptyString(applicationId) || !isNonEmptyString(subject) || !isNonEmptyString(description)) {
    return res.status(400).json({ error: 'applicationId, subject and description are required' });
  }
  const db = load();
  const application = db.applications.find(app => app.id === applicationId && app.citizenId === req.user.id);
  if (!application) return res.status(404).json({ error: 'Application not found for this citizen' });

  const grievance = {
    id: randomUUID(),
    applicationId,
    citizenId: req.user.id,
    departmentId: application.departmentId,
    subject: subject.trim(),
    description: description.trim(),
    status: 'Open',
    response: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null
  };
  db.grievances.push(grievance);
  logAction(db, { actor: req.user.name, actorRole: req.user.role, action: 'GRIEVANCE_CREATED', entity: 'grievance', entityId: grievance.id, details: { applicationId } });
  save(db);
  res.status(201).json(enrich(grievance, db));
});

router.get('/', requireAuth, (req, res) => {
  const db = load();
  let grievances = db.grievances;
  if (req.user.role === 'citizen') grievances = grievances.filter(item => item.citizenId === req.user.id);
  if (req.user.role === 'officer') grievances = grievances.filter(item => item.departmentId === req.user.departmentId);
  res.json(grievances.map(item => enrich(item, db)));
});

router.patch('/:id/respond', requireAuth, requireRole('officer', 'admin'), (req, res) => {
  const { response } = req.body || {};
  if (!isNonEmptyString(response)) return res.status(400).json({ error: 'A response is required' });
  const db = load();
  const grievance = db.grievances.find(item => item.id === req.params.id);
  if (!grievance) return res.status(404).json({ error: 'Grievance not found' });
  if (req.user.role === 'officer' && grievance.departmentId !== req.user.departmentId) {
    return res.status(403).json({ error: 'You may only respond to grievances for your own department' });
  }
  grievance.response = response.trim();
  grievance.status = 'Resolved';
  grievance.updatedAt = new Date().toISOString();
  grievance.resolvedAt = grievance.updatedAt;
  logAction(db, { actor: req.user.name, actorRole: req.user.role, action: 'GRIEVANCE_RESPONDED', entity: 'grievance', entityId: grievance.id });
  save(db);
  res.json(enrich(grievance, db));
});

module.exports = router;
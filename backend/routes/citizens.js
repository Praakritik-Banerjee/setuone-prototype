const express = require('express');
const { load } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// The "golden record": one consolidated view of a citizen across every
// department — applications, consents, notifications — pulled together by
// the MDM layer instead of living in silos.
router.get('/:id/golden-record', requireAuth, (req, res) => {
  const { id } = req.params;
  if (req.user.role === 'citizen' && req.user.id !== id) {
    return res.status(403).json({ error: 'Citizens may only view their own record' });
  }
  const db = load();
  const citizen = db.users.find(u => u.id === id && u.role === 'citizen');
  if (!citizen) return res.status(404).json({ error: 'Citizen not found' });

  const applications = db.applications.filter(a => a.citizenId === id).map(a => enrich(a, db));
  const consents = db.consents.filter(c => c.citizenId === id);
  const notifications = db.notifications.filter(n => n.citizenId === id);

  res.json({
    citizen: { id: citizen.id, name: citizen.name, aadhaar: citizen.aadhaar, mobile: citizen.mobile, email: citizen.email },
    applications,
    consents,
    notifications,
    summary: {
      totalApplications: applications.length,
      pending: applications.filter(a => a.status === 'In Progress').length,
      completed: applications.filter(a => a.status === 'Completed').length
    }
  });
});

function enrich(app, db) {
  const service = db.services.find(s => s.id === app.serviceId);
  const dept = db.departments.find(d => d.id === app.departmentId);
  return { ...app, serviceName: service?.name, departmentName: dept?.name, workflow: service?.workflow };
}

module.exports = router;

const { randomUUID } = require('crypto');
const { logAction } = require('./audit');

function checkSlaBreaches(db) {
  const now = new Date();
  let changed = false;
  db.applications.forEach(app => {
    if (app.status !== 'In Progress' || app.escalated) return;
    const service = db.services.find(item => item.id === app.serviceId);
    const deadline = new Date(new Date(app.createdAt).getTime() + (service?.slaHours || 72) * 3600000);
    if (now <= deadline) return;
    app.escalated = true;
    app.escalatedAt = now.toISOString();
    app.history.push({ stage: app.history[app.history.length - 1]?.stage || 'Escalated', at: app.escalatedAt, by: 'SetuOne SLA monitor', note: 'SLA breach escalated for officer review' });
    db.notifications.push({ id: randomUUID(), departmentId: app.departmentId, message: `Application ${app.id.slice(0, 8)} has breached its SLA and was escalated.`, channel: 'in-app', status: 'sent', createdAt: app.escalatedAt });
    logAction(db, { actor: 'SetuOne SLA monitor', actorRole: 'system', action: 'SLA_ESCALATED', entity: 'application', entityId: app.id, details: { departmentId: app.departmentId } });
    changed = true;
  });
  return changed;
}

module.exports = { checkSlaBreaches };
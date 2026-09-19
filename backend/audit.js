const { randomUUID } = require('crypto');

function logAction(db, { actor, actorRole, action, entity, entityId, details }) {
  db.auditLogs.push({
    id: randomUUID(),
    actor,
    actorRole,
    action,
    entity,
    entityId,
    details: details || {},
    timestamp: new Date().toISOString()
  });
}

module.exports = { logAction };

const { v4: uuid } = require('uuid');

function logAction(db, { actor, actorRole, action, entity, entityId, details }) {
  db.auditLogs.push({
    id: uuid(),
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

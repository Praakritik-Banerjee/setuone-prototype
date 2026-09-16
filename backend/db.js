// db.js — lightweight JSON-file "database" so the prototype runs with zero
// external DB dependency. Swap this module for Postgres/Mongo in production;
// every other file only talks to the functions exported here.
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');
const LOCK_FILE = `${DB_FILE}.lock`;

const DEFAULT_DB = {
  users: [],          // {id, name, role: citizen|officer|admin, department_id, aadhaar, mobile, email, passwordHash}
  departments: [],     // {id, name, code}
  services: [],        // {id, department_id, name, workflow: [stage names...], slaHours}
  applications: [],    // {id, citizenId, serviceId, departmentId, status, currentStageIndex, data, createdAt, updatedAt, history:[]}
  consents: [],        // {id, citizenId, departmentId, purpose, grantedAt, expiresAt, status}
  auditLogs: [],       // {id, actor, actorRole, action, entity, entityId, timestamp, details}
  notifications: [],   // {id, citizenId, message, channel, status, createdAt}
  connectorLogs: [],   // {id, connector, request, response, timestamp, status}
  grievances: []       // reserved for the grievance module
};

function load() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function save(db) {
  const temporaryFile = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
  let lockHandle;
  try {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        lockHandle = fs.openSync(LOCK_FILE, 'wx');
        break;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const waitUntil = Date.now() + 10;
        while (Date.now() < waitUntil) {}
      }
    }
    if (!lockHandle) throw new Error('Could not acquire database write lock');
    fs.writeFileSync(temporaryFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(temporaryFile, DB_FILE);
  } finally {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
    if (lockHandle) {
      fs.closeSync(lockHandle);
      fs.unlinkSync(LOCK_FILE);
    }
  }
}

module.exports = { load, save, DEFAULT_DB };

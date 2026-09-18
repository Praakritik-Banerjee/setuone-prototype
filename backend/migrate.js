const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  throw new Error('DATABASE_URL is required');
}

const schemaPath = path.join(__dirname, 'schema.sql');
const dbJsonPath = path.join(__dirname, 'data', 'db.json');

const tableMap = {
  users: 'users',
  departments: 'departments',
  services: 'services',
  applications: 'applications',
  consents: 'consents',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  connectorLogs: 'connector_logs',
  grievances: 'grievances',
  dataQualityFlags: 'data_quality_flags'
};

const normalizeRow = (table, row) => {
  if (!row || typeof row !== 'object') return row;
  const next = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase();
    next[normalizedKey] = value;
  }

  if (table === 'users' && !Object.prototype.hasOwnProperty.call(next, 'auth_provider')) {
    next.auth_provider = 'local';
  }

  if (table === 'applications' && !Object.prototype.hasOwnProperty.call(next, 'escalated')) {
    next.escalated = false;
  }

  if (table === 'applications' && !Object.prototype.hasOwnProperty.call(next, 'escalated_at')) {
    next.escalated_at = null;
  }

  return next;
};

async function withClient(fn) {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function main() {
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await withClient(async (client) => {
    await client.query(sql);

    const resetTables = [
      'data_quality_flags',
      'grievances',
      'connector_logs',
      'notifications',
      'audit_logs',
      'consents',
      'applications',
      'services',
      'users',
      'departments'
    ];
    for (const tableName of resetTables) {
      await client.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
    }
  });

  const raw = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
  const counts = {};
  const importOrder = [
    ['departments', 'departments'],
    ['users', 'users'],
    ['services', 'services'],
    ['applications', 'applications'],
    ['consents', 'consents'],
    ['auditLogs', 'audit_logs'],
    ['notifications', 'notifications'],
    ['connectorLogs', 'connector_logs'],
    ['grievances', 'grievances'],
    ['dataQualityFlags', 'data_quality_flags']
  ];

  await withClient(async (client) => {
    for (const [jsonKey, tableName] of importOrder) {
      const rows = Array.isArray(raw[jsonKey]) ? raw[jsonKey] : [];
      for (const row of rows) {
        const normalized = normalizeRow(tableName, row);
        const columns = Object.keys(normalized);
        const values = columns.map(column => {
          const value = normalized[column];
          if (value === undefined || value === null) return null;
          if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof Date))) return JSON.stringify(value);
          return value;
        });
        const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
        const columnList = columns.map(column => `"${column}"`).join(', ');
        const stmt = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;
        await client.query(stmt, values);
      }
      counts[jsonKey] = rows.length;
    }
  });

  const summary = Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([key, count]) => `${count} ${key}`)
    .join(', ');
  console.log(`Migrated ${summary}`);
}

main().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});

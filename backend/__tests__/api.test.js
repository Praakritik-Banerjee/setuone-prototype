const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const bcrypt = require('bcryptjs');

const testDbFile = path.join(os.tmpdir(), `setuone-set-${process.pid}.json`);
process.env.DB_FILE = testDbFile;
process.env.JWT_SECRET = 'test-secret';

const app = require('../server');
const { load, save } = require('../db');
const { checkSlaBreaches } = require('../escalation');

const ids = {
  rev: 'dept-rev', swd: 'dept-swd', sde: 'dept-sde',
  income: 'service-income', scholarship: 'service-scholarship', citizen: 'citizen-1',
  officer: 'officer-1', otherOfficer: 'officer-2', admin: 'admin-1'
};

function freshDb() {
  const passwordHash = bcrypt.hashSync('password123', 8);
  return {
    users: [
      { id: ids.citizen, name: 'Asha Patil', role: 'citizen', aadhaar: '1234-5678-9012', mobile: '9876543210', email: 'asha@example.com', passwordHash },
      { id: ids.officer, name: 'Revenue Officer', role: 'officer', departmentId: ids.rev, email: 'rev@gov.in', passwordHash },
      { id: ids.otherOfficer, name: 'Social Welfare Officer', role: 'officer', departmentId: ids.swd, email: 'swd@gov.in', passwordHash },
      { id: ids.admin, name: 'Admin User', role: 'admin', email: 'admin@gov.in', passwordHash }
    ],
    departments: [
      { id: ids.rev, name: 'Revenue Department', code: 'REV' },
      { id: ids.swd, name: 'Social Welfare Department', code: 'SWD' },
      { id: ids.sde, name: 'Skill Development', code: 'SDE' }
    ],
    services: [
      { id: ids.income, departmentId: ids.rev, name: 'Income Certificate', workflow: ['Submitted', 'Review', 'Completed'], slaHours: 168, requiredFields: ['annualIncome', 'purpose'] },
      { id: ids.scholarship, departmentId: ids.swd, name: 'Scholarship Application', workflow: ['Submitted', 'Review', 'Completed'], slaHours: 168, requiredFields: ['annualIncome', 'casteCategory', 'institutionName'] }
    ],
    applications: [], consents: [], auditLogs: [], notifications: [], connectorLogs: [], grievances: [], dataQualityFlags: []
  };
}

async function token(email, password = 'password123') {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.token;
}

beforeEach(() => {
  save(freshDb());
});

afterAll(() => {
  if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
});

test('login succeeds and rejects invalid credentials', async () => {
  const good = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'password123' });
  const bad = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'wrong' });
  expect(good.status).toBe(200);
  expect(bad.status).toBe(401);
});

test('exact duplicate registration is rejected and near duplicate is flagged', async () => {
  const exact = await request(app).post('/api/auth/register-citizen').send({ name: 'Other', mobile: '9876543210', email: 'other@example.com', password: 'password123' });
  expect(exact.status).toBe(409);
  const first = await request(app).post('/api/auth/register-citizen').send({ name: 'Quality Citizen', mobile: '9123456789', email: 'one@example.com', password: 'password123' });
  const second = await request(app).post('/api/auth/register-citizen').send({ name: ' quality   citizen ', mobile: '8123456789', email: 'two@example.com', password: 'password123' });
  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  const adminToken = await token('admin@gov.in');
  const flags = await request(app).get('/api/admin/data-quality/duplicates').set('Authorization', `Bearer ${adminToken}`);
  expect(flags.body).toHaveLength(1);
  expect(flags.body[0].reason).toMatch(/normalized name/);
});

test('required fields reject incomplete applications', async () => {
  const citizenToken = await token('asha@example.com');
  const response = await request(app).post('/api/applications').set('Authorization', `Bearer ${citizenToken}`).send({ serviceId: ids.income, data: {} });
  expect(response.status).toBe(400);
  expect(response.body.code).toBe('DATA_QUALITY_ERROR');
  expect(response.body.details.map(error => error.field)).toEqual(expect.arrayContaining(['data.annualIncome', 'data.purpose']));
});

test('consent gates scholarship income autofill', async () => {
  const citizenToken = await token('asha@example.com');
  const data = { casteCategory: 'OBC', institutionName: 'State College' };
  const denied = await request(app).post('/api/applications').set('Authorization', `Bearer ${citizenToken}`).send({ serviceId: ids.scholarship, data });
  expect(denied.status).toBe(400);
  await request(app).post('/api/consent').set('Authorization', `Bearer ${citizenToken}`).send({ departmentId: ids.swd, purpose: 'Verify income' });
  const allowed = await request(app).post('/api/applications').set('Authorization', `Bearer ${citizenToken}`).send({ serviceId: ids.scholarship, data });
  expect(allowed.status).toBe(201);
  expect(allowed.body.data.annualIncome).toBe(185000);
  expect(allowed.body.data.annualIncomeSource).toBe('consent');
  expect(allowed.body.history[0].note).toMatch(/via consent/);
});

test('cross-department officer cannot advance or reject', async () => {
  const citizenToken = await token('asha@example.com');
  const created = await request(app).post('/api/applications').set('Authorization', `Bearer ${citizenToken}`).send({ serviceId: ids.income, data: { annualIncome: '100000', purpose: 'housing' } });
  const otherToken = await token('swd@gov.in');
  const advance = await request(app).patch(`/api/applications/${created.body.id}/advance`).set('Authorization', `Bearer ${otherToken}`).send({});
  const reject = await request(app).patch(`/api/applications/${created.body.id}/reject`).set('Authorization', `Bearer ${otherToken}`).send({ reason: 'No' });
  expect(advance.status).toBe(403);
  expect(reject.status).toBe(403);
});

test('submit advance complete happy path', async () => {
  const citizenToken = await token('asha@example.com');
  const officerToken = await token('rev@gov.in');
  const created = await request(app).post('/api/applications').set('Authorization', `Bearer ${citizenToken}`).send({ serviceId: ids.income, data: { annualIncome: '100000', purpose: 'housing' } });
  const next = await request(app).patch(`/api/applications/${created.body.id}/advance`).set('Authorization', `Bearer ${officerToken}`).send({});
  const complete = await request(app).patch(`/api/applications/${created.body.id}/advance`).set('Authorization', `Bearer ${officerToken}`).send({});
  expect(next.status).toBe(200);
  expect(complete.body.status).toBe('Completed');
});

test('SLA scanner escalates once and records audit notification', () => {
  const db = load();
  db.services.find(service => service.id === ids.income).slaHours = 0.001;
  db.applications.push({ id: 'past-app', serviceId: ids.income, departmentId: ids.rev, status: 'In Progress', createdAt: new Date(Date.now() - 3600000).toISOString(), history: [] });
  expect(checkSlaBreaches(db)).toBe(true);
  expect(db.applications[0].escalated).toBe(true);
  expect(db.notifications[0].departmentId).toBe(ids.rev);
  expect(db.auditLogs[0].action).toBe('SLA_ESCALATED');
});

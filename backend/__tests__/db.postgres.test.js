test('db repository exposes application query helpers needed by Postgres-backed routes', () => {
  const db = require('../db');

  expect(typeof db.getApplicationById).toBe('function');
  expect(typeof db.insertApplication).toBe('function');
  expect(typeof db.advanceApplicationStage).toBe('function');
});

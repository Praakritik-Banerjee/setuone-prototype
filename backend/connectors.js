// connectors.js — Reusable connector layer. Each connector wraps a
// (simulated) legacy or third-party system behind one consistent interface
// (verify/fetch), so the rest of the platform never has to know whether the
// underlying system is a modern REST API, a SOAP service or an old FTP dump.
// Swap the mock logic here for a real client without touching any route.
const { v4: uuid } = require('uuid');

function logCall(db, connector, request, response, status) {
  db.connectorLogs.push({ id: uuid(), connector, request, response, status, timestamp: new Date().toISOString() });
}

const connectors = {
  // Simulated UIDAI-style Aadhaar e-KYC verification
  aadhaar: {
    name: 'Aadhaar e-KYC (mock)',
    verify(db, aadhaar) {
      const ok = /^\d{4}-\d{4}-\d{4}$/.test(aadhaar);
      const response = ok
        ? { verified: true, nameMatch: true, ageAbove18: true }
        : { verified: false, reason: 'Invalid Aadhaar format' };
      logCall(db, 'aadhaar', { aadhaar }, response, ok ? 'success' : 'error');
      return response;
    }
  },
  // Simulated PAN verification (Income Tax dept style)
  pan: {
    name: 'PAN Verification (mock)',
    verify(db, pan) {
      const ok = /^[A-Z]{5}\d{4}[A-Z]$/.test(pan || '');
      const response = ok ? { verified: true, status: 'ACTIVE' } : { verified: false, reason: 'Invalid PAN format' };
      logCall(db, 'pan', { pan }, response, ok ? 'success' : 'error');
      return response;
    }
  },
  // Simulated legacy Ration Card DB lookup (e.g. FTP/CSV based legacy system)
  rationDb: {
    name: 'Legacy Ration Card Registry (mock)',
    lookup(db, mobile) {
      const response = { found: false, note: 'No existing ration card linked to this mobile number' };
      logCall(db, 'rationDb', { mobile }, response, 'success');
      return response;
    }
  },
  // Simulated income-record registry used to auto-validate income certificates
  incomeRegistry: {
    name: 'State Income Registry (mock)',
    fetch(db, aadhaar) {
      const response = { annualIncome: 185000, source: 'Tehsil Revenue Records', asOf: '2026-03-31' };
      logCall(db, 'incomeRegistry', { aadhaar }, response, 'success');
      return response;
    }
  }
};

module.exports = { connectors };

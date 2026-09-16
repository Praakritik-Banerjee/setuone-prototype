function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateMobile(value) {
  return typeof value === 'string' && /^[6-9]\d{9}$/.test(value);
}

function validateAadhaar(value) {
  return typeof value === 'string' && /^\d{4}-?\d{4}-?\d{4}$/.test(value);
}

function validatePan(value) {
  return typeof value === 'string' && /^[A-Z]{5}\d{4}[A-Z]$/.test(value);
}

function requiredFields(body, fields) {
  return fields
    .filter(field => !isNonEmptyString(body[field]) && body[field] !== 0)
    .map(field => ({ field, message: `${field} is required` }));
}

function validateRegistration(body) {
  const errors = requiredFields(body, ['name', 'mobile', 'email', 'password']);
  if (body.email && !validateEmail(body.email)) errors.push({ field: 'email', message: 'Must be a valid email address' });
  if (body.mobile && !validateMobile(body.mobile)) errors.push({ field: 'mobile', message: 'Must be a valid 10-digit Indian mobile number' });
  if (body.aadhaar && !validateAadhaar(body.aadhaar)) errors.push({ field: 'aadhaar', message: 'Must be a valid 12-digit Aadhaar value' });
  if (body.password && body.password.length < 8) errors.push({ field: 'password', message: 'Must be at least 8 characters' });
  return errors;
}

function validateApplicationData(service, body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return [{ field: 'data', message: 'data must be an object' }];
  }
  for (const field of service.requiredFields || []) {
    if (!isNonEmptyString(body[field])) errors.push({ field: `data.${field}`, message: `${field} is required` });
  }
  if (body.mobile && !validateMobile(body.mobile)) errors.push({ field: 'data.mobile', message: 'Must be a valid 10-digit Indian mobile number' });
  if (body.aadhaar && !validateAadhaar(body.aadhaar)) errors.push({ field: 'data.aadhaar', message: 'Must be a valid 12-digit Aadhaar value' });
  return errors;
}

module.exports = {
  isNonEmptyString,
  validateEmail,
  validateMobile,
  validateAadhaar,
  validatePan,
  requiredFields,
  validateRegistration,
  validateApplicationData
};

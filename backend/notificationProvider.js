let mockModeLogged = false;

async function send(notification) {
  if (!process.env.SMTP_HOST) {
    if (!mockModeLogged) {
      console.log('Notification provider running in mock mode; set SMTP_HOST to enable email delivery.');
      mockModeLogged = true;
    }
    return { delivered: false, mode: 'mock' };
  }

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: notification.email || process.env.NOTIFICATION_TEST_RECIPIENT,
    subject: 'SetuOne application update',
    text: notification.message
  });
  return { delivered: true, mode: 'smtp' };
}

module.exports = { send };
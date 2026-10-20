const nodemailer = require('nodemailer');
const HttpError = require('../utils/httpError');

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function buildPasswordResetUrl(token) {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
  let base;
  try { base = new URL(clientUrl); } catch { throw new HttpError(503, 'The client URL is not configured for password reset.'); }
  if (!['http:', 'https:'].includes(base.protocol) || (process.env.NODE_ENV === 'production' && base.protocol !== 'https:')) {
    throw new HttpError(503, 'Password reset requires a valid HTTPS client URL in production.');
  }
  const resetUrl = new URL('/reset-password', base);
  // Keep the one-time token in the URL fragment; browsers do not send fragments to the server.
  resetUrl.hash = new URLSearchParams({ token }).toString();
  return resetUrl.toString();
}

async function sendPasswordResetEmail(student, token) {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    throw new HttpError(503, 'Email is not configured.');
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const from = process.env.REPORT_FROM_EMAIL || SMTP_USER;
  const resetUrl = buildPasswordResetUrl(token);
  const displayName = escapeHtml(student.name || 'student');
  const text = [
    `Hello ${student.name || 'student'},`,
    '',
    'A password reset was requested for your GMIU DBMS Learning Portal account.',
    'Use this one-time link within 30 minutes:',
    resetUrl,
    '',
    'If you did not request this change, you can ignore this email.',
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f6fa;font-family:Arial,sans-serif;color:#1c2634"><div style="max-width:560px;margin:0 auto;padding:28px;background:#fff;border:1px solid #e4eaf0;border-radius:16px"><p style="margin:0 0 12px;color:#08796f;font-size:12px;font-weight:700;letter-spacing:.12em">GMIU · DBMS LEARNING PORTAL</p><h1 style="margin:0 0 12px;font-size:24px">Reset your password</h1><p style="line-height:1.6">Hello ${displayName}, a password reset was requested for your student account.</p><p style="line-height:1.6">This one-time link expires in 30 minutes.</p><p style="margin:24px 0"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;border-radius:9px;background:#15304a;color:#fff;text-decoration:none;font-weight:700">Reset password</a></p><p style="color:#657487;font-size:13px;line-height:1.6">If you did not request this, ignore this email. Your password will not change.</p></div></body></html>`;
  const transporter = nodemailer.createTransport({ host: SMTP_HOST, port, secure, auth: { user: SMTP_USER, pass: SMTP_PASSWORD } });
  await transporter.sendMail({ from, to: student.email, subject: 'Reset your DBMS Learning Portal password', text, html });
}

module.exports = { buildPasswordResetUrl, sendPasswordResetEmail };

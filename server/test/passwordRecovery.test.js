const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const User = require('../src/models/User');
const authController = require('../src/controllers/authController');
const HttpError = require('../src/utils/httpError');
const {
  profileUpdateSchema,
  passwordChangeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../src/validators/authSchemas');
const { buildPasswordResetUrl, sendPasswordResetEmail } = require('../src/services/passwordResetEmailService');

const ENV_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'REPORT_FROM_EMAIL', 'CLIENT_URL', 'NODE_ENV'];
async function withEnv(values, callback) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    if (Object.hasOwn(values, key)) process.env[key] = values[key];
    else delete process.env[key];
  }
  try { return await callback(); } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('profile and password schemas enforce name and strong password rules', () => {
  assert.deepEqual(profileUpdateSchema.parse({ name: '  Alex Student  ' }), { name: 'Alex Student' });
  assert.equal(profileUpdateSchema.safeParse({ name: 'A' }).success, false);
  assert.equal(passwordChangeSchema.safeParse({ currentPassword: 'old', newPassword: 'new password at least 12' }).success, true);
  assert.equal(passwordChangeSchema.safeParse({ currentPassword: 'old', newPassword: 'short' }).success, false);
});

test('forgot-password schema normalizes email; reset tokens must be 32-byte hex values', () => {
  assert.deepEqual(forgotPasswordSchema.parse({ email: ' Student@Example.edu ' }), { email: 'student@example.edu' });
  assert.equal(resetPasswordSchema.safeParse({ token: 'a'.repeat(64), password: 'a-new-password-long-enough' }).success, true);
  assert.equal(resetPasswordSchema.safeParse({ token: 'short', password: 'a-new-password-long-enough' }).success, false);
});

test('reset URLs use the configured site and keep the one-time token in the fragment', async () => {
  await withEnv({ CLIENT_URL: 'https://portal.example.edu,https://staging.example.edu', NODE_ENV: 'production' }, async () => {
    const url = new URL(buildPasswordResetUrl('a'.repeat(64)));
    assert.equal(url.origin, 'https://portal.example.edu');
    assert.equal(url.pathname, '/reset-password');
    assert.equal(new URLSearchParams(url.hash.slice(1)).get('token'), 'a'.repeat(64));
  });
});

test('password reset email goes only to the saved student email and escapes names', async () => {
  await withEnv({
    SMTP_HOST: 'smtp.example.edu', SMTP_PORT: '587', SMTP_SECURE: 'false',
    SMTP_USER: 'portal@example.edu', SMTP_PASSWORD: 'smtp-test-secret', REPORT_FROM_EMAIL: 'support@example.edu',
    CLIENT_URL: 'https://portal.example.edu', NODE_ENV: 'production',
  }, async () => {
    const originalCreateTransport = nodemailer.createTransport;
    let transportOptions;
    let sentMessage;
    nodemailer.createTransport = (options) => {
      transportOptions = options;
      return { async sendMail(message) { sentMessage = message; return { messageId: 'test-reset-email' }; } };
    };
    try {
      await sendPasswordResetEmail({ name: '<Student>', email: 'student@example.edu' }, 'b'.repeat(64));
      assert.equal(transportOptions.host, 'smtp.example.edu');
      assert.equal(sentMessage.from, 'support@example.edu');
      assert.equal(sentMessage.to, 'student@example.edu');
      assert.match(sentMessage.subject, /reset/i);
      assert.match(sentMessage.text, /#token=b{64}/);
      assert.match(sentMessage.html, /&lt;Student&gt;/);
      assert.doesNotMatch(sentMessage.html, /<Student>/);
    } finally {
      nodemailer.createTransport = originalCreateTransport;
    }
  });
});

test('password reset email requires server-side SMTP configuration', async () => {
  await withEnv({ CLIENT_URL: 'http://localhost:5173' }, async () => {
    await assert.rejects(
      sendPasswordResetEmail({ name: 'Student', email: 'student@example.edu' }, 'c'.repeat(64)),
      (error) => error instanceof HttpError && error.status === 503,
    );
  });
});

test('forgot-password responses do not reveal whether an account exists and only a token hash is stored', async () => {
  await withEnv({
    SMTP_HOST: 'smtp.example.edu', SMTP_PORT: '587', SMTP_SECURE: 'false',
    SMTP_USER: 'portal@example.edu', SMTP_PASSWORD: 'smtp-test-secret',
    CLIENT_URL: 'https://portal.example.edu', NODE_ENV: 'production',
  }, async () => {
    const originals = { findOne: User.findOne, updateOne: User.updateOne, createTransport: nodemailer.createTransport };
    const student = { _id: 'student-db-id', name: 'Sample Student', email: 'student@example.edu' };
    const updates = [];
    let sentMessage;
    nodemailer.createTransport = () => ({ async sendMail(message) { sentMessage = message; return {}; } });
    User.findOne = () => ({ select: async () => student });
    User.updateOne = async (filter, update) => { updates.push({ filter, update }); return { matchedCount: 1 }; };
    const knownResponse = {};
    try {
      await authController.requestPasswordReset({ body: { email: student.email } }, { json(value) { this.body = value; Object.assign(knownResponse, value); } });
      const rawToken = new URLSearchParams(new URL(sentMessage.text.split('\n').find((line) => line.startsWith('https://'))).hash.slice(1)).get('token');
      assert.match(rawToken, /^[a-f0-9]{64}$/);
      const savedHash = updates[0].update.$set.passwordResetTokenHash;
      assert.equal(savedHash, crypto.createHash('sha256').update(rawToken).digest('hex'));
      assert.notEqual(savedHash, rawToken);
      const remainingMs = updates[0].update.$set.passwordResetExpiresAt.getTime() - Date.now();
      assert.ok(remainingMs > 29 * 60 * 1000 && remainingMs <= 30 * 60 * 1000);

      User.findOne = () => ({ select: async () => null });
      const unknownResponse = {};
      await authController.requestPasswordReset({ body: { email: 'unknown@example.edu' } }, { json(value) { Object.assign(unknownResponse, value); } });
      assert.deepEqual(knownResponse, unknownResponse);
      assert.equal(updates.length, 1);
    } finally {
      User.findOne = originals.findOne;
      User.updateOne = originals.updateOne;
      nodemailer.createTransport = originals.createTransport;
    }
  });
});

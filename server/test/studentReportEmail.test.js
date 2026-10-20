const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const HttpError = require('../src/utils/httpError');
const { sendStudentReportEmail } = require('../src/services/studentReportEmailService');

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'REPORT_FROM_EMAIL'];
function withEnv(values, callback) {
  const previous = Object.fromEntries(SMTP_KEYS.map((key) => [key, process.env[key]]));
  for (const key of SMTP_KEYS) {
    if (Object.hasOwn(values, key)) process.env[key] = values[key];
    else delete process.env[key];
  }
  return Promise.resolve().then(callback).finally(() => {
    for (const key of SMTP_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}

const sampleReport = {
  generatedAt: new Date('2026-10-10T10:00:00.000Z'),
  totalPoints: 30,
  totalLearningTimeSec: 3660,
  topicsOpened: 4,
  topicsCompleted: 2,
  questionsAttempted: 3,
  correctAnswers: 2,
  practicalsAttempted: 1,
  practicalsCompleted: 1,
  modules: [{ moduleNumber: 1, title: 'Foundations', totalTopics: 8, completedTopics: 2, completionPercent: 25 }],
  recentActivity: [{ timestamp: new Date('2026-10-09T12:00:00.000Z'), label: 'Topic completed', detail: 'Relational model' }],
};

test('report email requires server-side SMTP configuration', async () => {
  await withEnv({}, async () => {
    await assert.rejects(
      sendStudentReportEmail({ email: 'student@example.edu' }, sampleReport),
      (error) => error instanceof HttpError && error.status === 503 && /SMTP_HOST/.test(error.message),
    );
  });
});

test('report email uses the student account email and includes only the supplied report', async () => {
  await withEnv({
    SMTP_HOST: 'smtp.example.edu', SMTP_PORT: '587', SMTP_SECURE: 'false',
    SMTP_USER: 'portal@example.edu', SMTP_PASSWORD: 'test-secret', REPORT_FROM_EMAIL: 'reports@example.edu',
  }, async () => {
    const originalCreateTransport = nodemailer.createTransport;
    const transports = [];
    nodemailer.createTransport = (options) => {
      const transport = {
        options,
        message: null,
        async sendMail(message) { this.message = message; return { messageId: 'test-message' }; },
      };
      transports.push(transport);
      return transport;
    };

    try {
      const student = { email: 'student@example.edu', name: '<Learner>', studentId: 'S-100', semester: 3, classSection: 'X1' };
      await sendStudentReportEmail(student, sampleReport);
      assert.equal(transports.length, 1);
      assert.equal(transports[0].options.host, 'smtp.example.edu');
      assert.equal(transports[0].message.from, 'reports@example.edu');
      assert.equal(transports[0].message.to, student.email);
      assert.match(transports[0].message.subject, /learning report/i);
      assert.match(transports[0].message.html, /&lt;Learner&gt;/);
      assert.match(transports[0].message.text, /30/);
      assert.doesNotMatch(transports[0].message.html, /attacker@example\.com/);
    } finally {
      nodemailer.createTransport = originalCreateTransport;
    }
  });
});

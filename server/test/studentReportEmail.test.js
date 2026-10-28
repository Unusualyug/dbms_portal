const test = require("node:test");
const assert = require("node:assert/strict");
const HttpError = require("../src/utils/httpError");
const {
  sendStudentReportEmail,
} = require("../src/services/studentReportEmailService");
const { clearTokenCache } = require("../src/services/gmailApiMailer");
const {
  createGmailApiFetchStub,
  decodeRawMessage,
} = require("./helpers/gmailApiMocks");

const GMAIL_KEYS = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_USER",
  "REPORT_FROM_EMAIL",
];
function withEnv(values, callback) {
  const previous = Object.fromEntries(
    GMAIL_KEYS.map((key) => [key, process.env[key]]),
  );
  for (const key of GMAIL_KEYS) {
    if (Object.hasOwn(values, key)) process.env[key] = values[key];
    else delete process.env[key];
  }
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const key of GMAIL_KEYS) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    });
}

const sampleReport = {
  generatedAt: new Date("2026-10-10T10:00:00.000Z"),
  totalPoints: 30,
  totalLearningTimeSec: 3660,
  topicsOpened: 4,
  topicsCompleted: 2,
  questionsAttempted: 3,
  correctAnswers: 2,
  practicalsAttempted: 1,
  practicalsCompleted: 1,
  modules: [
    {
      moduleNumber: 1,
      title: "Foundations",
      totalTopics: 8,
      completedTopics: 2,
      completionPercent: 25,
    },
  ],
  recentActivity: [
    {
      timestamp: new Date("2026-10-09T12:00:00.000Z"),
      label: "Topic completed",
      detail: "Relational model",
    },
  ],
};

test("report email requires server-side Gmail API configuration", async () => {
  await withEnv({}, async () => {
    await assert.rejects(
      sendStudentReportEmail({ email: "student@example.edu" }, sampleReport),
      (error) =>
        error instanceof HttpError &&
        error.status === 503 &&
        /GMAIL_CLIENT_ID/.test(error.message),
    );
  });
});

test("report email uses the student account email and includes only the supplied report", async () => {
  await withEnv(
    {
      GMAIL_CLIENT_ID: "report-client-id",
      GMAIL_CLIENT_SECRET: "report-client-secret",
      GMAIL_REFRESH_TOKEN: "report-refresh-token",
      GMAIL_USER: "portal@example.edu",
      REPORT_FROM_EMAIL: "Reports <portal@example.edu>",
    },
    async () => {
      const originalFetch = global.fetch;
      const mock = createGmailApiFetchStub();
      global.fetch = mock.fetch;
      clearTokenCache();
      try {
        const student = {
          email: "student@example.edu",
          name: "<Learner>",
          studentId: "S-100",
          semester: 3,
          classSection: "X1",
        };
        await sendStudentReportEmail(student, sampleReport);
        assert.equal(mock.calls.length, 2);
        const rawMessage = decodeRawMessage(mock.calls[1]);
        assert.match(rawMessage, /From: Reports <portal@example\.edu>/i);
        assert.match(rawMessage, /To: student@example\.edu/i);
        assert.match(rawMessage, /Your DBMS learning report/i);
        assert.match(rawMessage, /&lt;Learner&gt;/);
        assert.match(rawMessage, /30/);
        assert.doesNotMatch(rawMessage, /attacker@example\.com/);
      } finally {
        global.fetch = originalFetch;
        clearTokenCache();
      }
    },
  );
});

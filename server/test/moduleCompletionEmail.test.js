const test = require("node:test");
const assert = require("node:assert/strict");
const ModuleManualProgress = require("../src/models/ModuleManualProgress");
const {
  buildModuleCompletionEmail,
  sendModuleCompletionEmail,
  processModuleCompletionEmail,
  processDueModuleCompletionEmails,
} = require("../src/services/moduleCompletionEmailService");
const { clearTokenCache } = require("../src/services/gmailApiMailer");
const {
  createGmailApiFetchStub,
  decodeRawMessage,
} = require("./helpers/gmailApiMocks");

const envKeys = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_USER",
  "REPORT_FROM_EMAIL",
  "CLIENT_URL",
];

function restoreEnv(original) {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function configureGmailApi(prefix = "module-test") {
  process.env.GMAIL_CLIENT_ID = `${prefix}-client-id`;
  process.env.GMAIL_CLIENT_SECRET = `${prefix}-client-secret`;
  process.env.GMAIL_REFRESH_TOKEN = `${prefix}-refresh-token`;
  process.env.GMAIL_USER = "portal@example.test";
  process.env.REPORT_FROM_EMAIL = "GMIU DBMS Portal <portal@example.test>";
  process.env.CLIENT_URL = "https://dbms-portal.onrender.com";
}

function moduleEmailInput() {
  return {
    student: {
      _id: "student-id-1",
      name: "<Yug & Co>",
      email: "student@example.test",
    },
    module: {
      _id: "module-id-4",
      moduleNumber: 4,
      title: "Data <Integrity>",
      slug: "module-4",
    },
    progress: { completedPracticals: 8, totalPracticals: 8 },
    studentId: "student-id-1",
    moduleId: "module-id-4",
  };
}

test("module-completion email states all official practicals are approved and escapes dynamic HTML", () => {
  const original = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  configureGmailApi();
  try {
    const email = buildModuleCompletionEmail(moduleEmailInput());
    assert.deepEqual(email.to, ["student@example.test"]);
    assert.equal(email.from, "GMIU DBMS Portal <portal@example.test>");
    assert.match(
      email.messageId,
      /^<module-completion\.[a-f0-9]{32}@example\.test>$/,
    );
    assert.equal(
      email.messageId,
      buildModuleCompletionEmail(moduleEmailInput()).messageId,
      "the Message-ID is stable across retries",
    );
    assert.match(email.subject, /Module 4/);
    assert.match(email.text, /All 8 official practicals/);
    assert.match(
      email.text,
      /https:\/\/dbms-portal\.onrender\.com\/student\/modules\/module-4/,
    );
    assert.match(email.html, /&lt;Yug &amp; Co&gt;/);
    assert.match(email.html, /Data &lt;Integrity&gt;/);
    assert.doesNotMatch(email.html, /<Yug/);
  } finally {
    restoreEnv(original);
  }
});

test("module-completion email refuses to send until every official practical is approved", () => {
  const original = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  process.env.CLIENT_URL = "https://dbms-portal.onrender.com";
  try {
    assert.throws(
      () =>
        buildModuleCompletionEmail({
          ...moduleEmailInput(),
          progress: { completedPracticals: 7, totalPracticals: 8 },
        }),
      /module_practicals_not_all_approved/,
    );
  } finally {
    restoreEnv(original);
  }
});

test("Gmail API sends module email to the saved student address", async () => {
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  const originalFetch = global.fetch;
  configureGmailApi("module-send");
  clearTokenCache();
  const mock = createGmailApiFetchStub();
  global.fetch = mock.fetch;
  try {
    const result = await sendModuleCompletionEmail(moduleEmailInput());
    assert.equal(result.id, "gmail-sent-id");
    assert.equal(
      mock.calls.length,
      2,
      "refresh token exchange followed by Gmail API send",
    );
    assert.match(mock.calls[0].url, /oauth2\.googleapis\.com\/token$/);
    assert.equal(mock.calls[0].options.method, "POST");
    assert.equal(
      mock.calls[1].url,
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    );
    assert.equal(
      mock.calls[1].options.headers.Authorization,
      "Bearer test-google-access-token",
    );
    const rawMessage = decodeRawMessage(mock.calls[1]);
    assert.match(rawMessage, /To: student@example\.test/i);
    assert.match(rawMessage, /From: GMIU DBMS Portal <portal@example\.test>/i);
    assert.match(rawMessage, /Congratulations! All 8 official practicals/);
    assert.match(
      rawMessage,
      /Message-ID:\s*<module-completion\.[a-f0-9]{32}@example\.test>/i,
    );
  } finally {
    global.fetch = originalFetch;
    clearTokenCache();
    restoreEnv(originalEnv);
  }
});

test("module-completion email fails safely when Gmail API credentials are missing", async () => {
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  for (const key of [
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
    "GMAIL_USER",
  ])
    delete process.env[key];
  try {
    await assert.rejects(
      sendModuleCompletionEmail(moduleEmailInput()),
      /gmail_api_not_configured/,
    );
  } finally {
    restoreEnv(originalEnv);
  }
});

test("module worker never sends legacy pending completions without a new queue timestamp", async () => {
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  const originalFind = ModuleManualProgress.find;
  const originalFindOneAndUpdate = ModuleManualProgress.findOneAndUpdate;
  let dueFilter;
  let claimFilter;
  configureGmailApi("module-legacy");
  ModuleManualProgress.find = (filter) => {
    dueFilter = filter;
    return {
      select() {
        return this;
      },
      sort() {
        return this;
      },
      limit() {
        return this;
      },
      async lean() {
        return [];
      },
    };
  };
  ModuleManualProgress.findOneAndUpdate = async (filter) => {
    claimFilter = filter;
    return null;
  };
  try {
    assert.equal(await processDueModuleCompletionEmails(), 0);
    assert.deepEqual(dueFilter.completionEmailQueuedAt, {
      $exists: true,
      $ne: null,
    });
    assert.equal(
      await processModuleCompletionEmail("legacy-row-id"),
      "not-queued",
    );
    assert.deepEqual(claimFilter.completionEmailQueuedAt, {
      $exists: true,
      $ne: null,
    });
  } finally {
    ModuleManualProgress.find = originalFind;
    ModuleManualProgress.findOneAndUpdate = originalFindOneAndUpdate;
    clearTokenCache();
    restoreEnv(originalEnv);
  }
});

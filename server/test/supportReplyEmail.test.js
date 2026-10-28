const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildSupportReplyEmail,
  sendSupportReplyEmail,
} = require("../src/services/supportReplyEmailService");
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
];
function restoreEnv(original) {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
function configureGmailApi(prefix = "support-test") {
  process.env.GMAIL_CLIENT_ID = `${prefix}-client-id`;
  process.env.GMAIL_CLIENT_SECRET = `${prefix}-client-secret`;
  process.env.GMAIL_REFRESH_TOKEN = `${prefix}-refresh-token`;
  process.env.GMAIL_USER = "portal@example.test";
  process.env.REPORT_FROM_EMAIL = "GMIU DBMS Portal <portal@example.test>";
}

const input = {
  student: {
    _id: "student-7",
    name: "<Yug & Co>",
    email: "saved-address@example.test",
  },
  supportMessage: {
    _id: "support-42",
    category: "question",
    subject: "Points <and> badges",
    reply: "Hello <student> & team\nWe will look into this.",
  },
};

test("support reply email targets the saved account address and escapes dynamic HTML", () => {
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  process.env.GMAIL_USER = "portal@example.test";
  process.env.REPORT_FROM_EMAIL = "GMIU DBMS Portal <notify@example.test>";
  try {
    const email = buildSupportReplyEmail(input);
    assert.deepEqual(email.to, ["saved-address@example.test"]);
    assert.equal(email.from, "GMIU DBMS Portal <notify@example.test>");
    assert.match(
      email.messageId,
      /^<support-reply\.[a-f0-9]{32}@example\.test>$/,
    );
    assert.equal(
      email.messageId,
      buildSupportReplyEmail(input).messageId,
      "the Message-ID is stable across retries",
    );
    assert.match(email.subject, /Points <and> badges/);
    assert.match(email.text, /We will look into this/);
    assert.match(email.html, /&lt;Yug &amp; Co&gt;/);
    assert.match(email.html, /Points &lt;and&gt; badges/);
    assert.match(email.html, /Hello &lt;student&gt; &amp; team/);
    assert.doesNotMatch(email.html, /<student>/);
  } finally {
    restoreEnv(originalEnv);
  }
});

test("Gmail API sends support reply to the student’s saved account address", async () => {
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  const originalFetch = global.fetch;
  configureGmailApi("support-send");
  clearTokenCache();
  const mock = createGmailApiFetchStub();
  global.fetch = mock.fetch;
  try {
    const result = await sendSupportReplyEmail(input);
    assert.equal(result.id, "gmail-sent-id");
    assert.equal(mock.calls.length, 2);
    const rawMessage = decodeRawMessage(mock.calls[1]);
    assert.match(rawMessage, /To: saved-address@example\.test/i);
    assert.match(rawMessage, /From: GMIU DBMS Portal <portal@example\.test>/i);
    assert.match(rawMessage, /Subject:.*Reply to your support request/i);
    assert.match(rawMessage, /support-reply\.[a-f0-9]{32}@example\.test/i);
    assert.match(rawMessage, /Hello &lt;student&gt; &amp; team/);
  } finally {
    global.fetch = originalFetch;
    clearTokenCache();
    restoreEnv(originalEnv);
  }
});

test("support email fails safely when Gmail API credentials are missing", async () => {
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
      sendSupportReplyEmail(input),
      /gmail_api_not_configured/,
    );
  } finally {
    restoreEnv(originalEnv);
  }
});

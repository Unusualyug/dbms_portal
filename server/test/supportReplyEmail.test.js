const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildSupportReplyEmail,
  sendSupportReplyEmail,
} = require("../src/services/supportReplyEmailService");

const envKeys = ["RESEND_API_KEY", "RESEND_FROM_EMAIL"];
function restoreEnv(original) {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
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
  process.env.RESEND_FROM_EMAIL = "GMIU DBMS Portal <notify@example.test>";
  try {
    const email = buildSupportReplyEmail(input);
    assert.deepEqual(email.to, ["saved-address@example.test"]);
    assert.equal(email.from, "GMIU DBMS Portal <notify@example.test>");
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

test("Resend sends support reply over HTTPS with a stable per-request idempotency key", async () => {
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  const originalFetch = global.fetch;
  let captured;
  process.env.RESEND_API_KEY = "test-key";
  process.env.RESEND_FROM_EMAIL = "GMIU DBMS Portal <notify@example.test>";
  global.fetch = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "support-email-id" }),
    };
  };
  try {
    const result = await sendSupportReplyEmail(input);
    assert.equal(result.id, "support-email-id");
    assert.equal(captured.url, "https://api.resend.com/emails");
    assert.equal(captured.options.method, "POST");
    assert.equal(captured.options.headers.Authorization, "Bearer test-key");
    assert.equal(
      captured.options.headers["Idempotency-Key"],
      "support-reply/support-42",
    );
    assert.deepEqual(JSON.parse(captured.options.body).to, [
      "saved-address@example.test",
    ]);
  } finally {
    global.fetch = originalFetch;
    restoreEnv(originalEnv);
  }
});

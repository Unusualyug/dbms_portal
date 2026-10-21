const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildModuleCompletionEmail,
  sendModuleCompletionEmail,
} = require("../src/services/moduleCompletionEmailService");

function restoreEnv(original) {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const keys = ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "CLIENT_URL"];

test("module-completion email states all official practicals are approved and escapes dynamic HTML", () => {
  const original = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  process.env.RESEND_FROM_EMAIL = "GMIU DBMS Portal <notify@example.test>";
  process.env.CLIENT_URL = "https://dbms-portal.onrender.com";
  try {
    const email = buildModuleCompletionEmail({
      student: { name: "<Yug & Co>", email: "student@example.test" },
      module: { moduleNumber: 4, title: "Data <Integrity>", slug: "module-4" },
      progress: { completedPracticals: 8, totalPracticals: 8 },
    });
    assert.deepEqual(email.to, ["student@example.test"]);
    assert.equal(email.from, "GMIU DBMS Portal <notify@example.test>");
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

test("Resend delivery uses a server-side bearer key and stable per-student/module idempotency key", async () => {
  const originalEnv = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  const originalFetch = global.fetch;
  let captured;
  process.env.RESEND_API_KEY = "test-secret-value";
  process.env.RESEND_FROM_EMAIL = "GMIU DBMS Portal <notify@example.test>";
  process.env.CLIENT_URL = "https://dbms-portal.onrender.com";
  global.fetch = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "email-test-id" }),
    };
  };
  try {
    const result = await sendModuleCompletionEmail({
      student: {
        _id: "student-id-1",
        name: "Student One",
        email: "student@example.test",
      },
      module: {
        _id: "module-id-4",
        moduleNumber: 4,
        title: "Module Four",
        slug: "module-4",
      },
      progress: { completedPracticals: 8, totalPracticals: 8 },
      studentId: "student-id-1",
      moduleId: "module-id-4",
    });
    assert.equal(result.id, "email-test-id");
    assert.equal(captured.url, "https://api.resend.com/emails");
    assert.equal(captured.options.method, "POST");
    assert.equal(
      captured.options.headers.Authorization,
      "Bearer test-secret-value",
    );
    assert.equal(
      captured.options.headers["Idempotency-Key"],
      "module-completion/student-id-1/module-id-4",
    );
    const payload = JSON.parse(captured.options.body);
    assert.deepEqual(payload.to, ["student@example.test"]);
    assert.match(payload.subject, /Module 4/);
  } finally {
    global.fetch = originalFetch;
    restoreEnv(originalEnv);
  }
});

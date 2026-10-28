const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const User = require("../src/models/User");
const authController = require("../src/controllers/authController");
const HttpError = require("../src/utils/httpError");
const {
  profileUpdateSchema,
  passwordChangeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../src/validators/authSchemas");
const {
  buildPasswordResetUrl,
  sendPasswordResetEmail,
} = require("../src/services/passwordResetEmailService");
const { clearTokenCache } = require("../src/services/gmailApiMailer");
const {
  createGmailApiFetchStub,
  decodeRawMessage,
} = require("./helpers/gmailApiMocks");

const ENV_KEYS = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_USER",
  "REPORT_FROM_EMAIL",
  "CLIENT_URL",
  "NODE_ENV",
];
async function withEnv(values, callback) {
  const previous = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );
  for (const key of ENV_KEYS) {
    if (Object.hasOwn(values, key)) process.env[key] = values[key];
    else delete process.env[key];
  }
  try {
    return await callback();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("profile and password schemas enforce name and strong password rules", () => {
  assert.deepEqual(profileUpdateSchema.parse({ name: "  Alex Student  " }), {
    name: "Alex Student",
  });
  assert.equal(profileUpdateSchema.safeParse({ name: "A" }).success, false);
  assert.equal(
    passwordChangeSchema.safeParse({
      currentPassword: "old",
      newPassword: "new password at least 12",
    }).success,
    true,
  );
  assert.equal(
    passwordChangeSchema.safeParse({
      currentPassword: "old",
      newPassword: "short",
    }).success,
    false,
  );
});

test("forgot-password schema normalizes email; reset tokens must be 32-byte hex values", () => {
  assert.deepEqual(
    forgotPasswordSchema.parse({ email: " Student@Example.edu " }),
    { email: "student@example.edu" },
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      token: "a".repeat(64),
      password: "a-new-password-long-enough",
    }).success,
    true,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      token: "short",
      password: "a-new-password-long-enough",
    }).success,
    false,
  );
});

test("reset URLs use the configured site and keep the one-time token in the fragment", async () => {
  await withEnv(
    {
      CLIENT_URL: "https://portal.example.edu,https://staging.example.edu",
      NODE_ENV: "production",
    },
    async () => {
      const url = new URL(buildPasswordResetUrl("a".repeat(64)));
      assert.equal(url.origin, "https://portal.example.edu");
      assert.equal(url.pathname, "/reset-password");
      assert.equal(
        new URLSearchParams(url.hash.slice(1)).get("token"),
        "a".repeat(64),
      );
    },
  );
});

test("password reset email goes only to the saved student email and escapes names", async () => {
  await withEnv(
    {
      GMAIL_CLIENT_ID: "reset-client-id",
      GMAIL_CLIENT_SECRET: "reset-client-secret",
      GMAIL_REFRESH_TOKEN: "reset-refresh-token",
      GMAIL_USER: "portal@example.edu",
      REPORT_FROM_EMAIL: "Portal Support <portal@example.edu>",
      CLIENT_URL: "https://portal.example.edu",
      NODE_ENV: "production",
    },
    async () => {
      const originalFetch = global.fetch;
      const mock = createGmailApiFetchStub();
      global.fetch = mock.fetch;
      clearTokenCache();
      try {
        await sendPasswordResetEmail(
          { name: "<Student>", email: "student@example.edu" },
          "b".repeat(64),
        );
        assert.equal(mock.calls.length, 2);
        const rawMessage = decodeRawMessage(mock.calls[1]);
        assert.match(rawMessage, /From: Portal Support <portal@example\.edu>/i);
        assert.match(rawMessage, /To: student@example\.edu/i);
        assert.match(rawMessage, /Subject:.*reset/i);
        assert.match(rawMessage, /#token=b{64}/);
        assert.match(rawMessage, /&lt;Student&gt;/);
        const htmlPart =
          rawMessage.split("Content-Type: text/html; charset=utf-8")[1] || "";
        assert.doesNotMatch(htmlPart, /Hello <Student>/);
      } finally {
        global.fetch = originalFetch;
        clearTokenCache();
      }
    },
  );
});

test("password reset email requires server-side Gmail API configuration", async () => {
  await withEnv({ CLIENT_URL: "http://localhost:5173" }, async () => {
    await assert.rejects(
      sendPasswordResetEmail(
        { name: "Student", email: "student@example.edu" },
        "c".repeat(64),
      ),
      (error) =>
        error instanceof HttpError &&
        error.status === 503 &&
        /GMAIL_CLIENT_ID/.test(error.message),
    );
  });
});

test("forgot-password responses do not reveal whether an account exists and only a token hash is stored", async () => {
  await withEnv(
    {
      GMAIL_CLIENT_ID: "forgot-client-id",
      GMAIL_CLIENT_SECRET: "forgot-client-secret",
      GMAIL_REFRESH_TOKEN: "forgot-refresh-token",
      GMAIL_USER: "portal@example.edu",
      REPORT_FROM_EMAIL: "Portal Support <portal@example.edu>",
      CLIENT_URL: "https://portal.example.edu",
      NODE_ENV: "production",
    },
    async () => {
      const originals = {
        findOne: User.findOne,
        updateOne: User.updateOne,
        fetch: global.fetch,
      };
      const student = {
        _id: "student-db-id",
        name: "Sample Student",
        email: "student@example.edu",
      };
      const updates = [];
      const mock = createGmailApiFetchStub();
      global.fetch = mock.fetch;
      clearTokenCache();
      User.findOne = () => ({ select: async () => student });
      User.updateOne = async (filter, update) => {
        updates.push({ filter, update });
        return { matchedCount: 1 };
      };
      const knownResponse = {};
      try {
        await authController.requestPasswordReset(
          { body: { email: student.email } },
          {
            json(value) {
              this.body = value;
              Object.assign(knownResponse, value);
            },
          },
        );
        const rawMessage = decodeRawMessage(mock.calls[1]);
        const resetUrl = rawMessage.match(
          /https:\/\/portal\.example\.edu\/reset-password#token=[a-f0-9]{64}/,
        )?.[0];
        assert.ok(resetUrl, "reset URL is present in the Gmail API message");
        const rawToken = new URLSearchParams(
          new URL(resetUrl).hash.slice(1),
        ).get("token");
        assert.match(rawToken, /^[a-f0-9]{64}$/);
        const savedHash = updates[0].update.$set.passwordResetTokenHash;
        assert.equal(
          savedHash,
          crypto.createHash("sha256").update(rawToken).digest("hex"),
        );
        assert.notEqual(savedHash, rawToken);
        const remainingMs =
          updates[0].update.$set.passwordResetExpiresAt.getTime() - Date.now();
        assert.ok(
          remainingMs > 29 * 60 * 1000 && remainingMs <= 30 * 60 * 1000,
        );

        User.findOne = () => ({ select: async () => null });
        const unknownResponse = {};
        await authController.requestPasswordReset(
          { body: { email: "unknown@example.edu" } },
          {
            json(value) {
              Object.assign(unknownResponse, value);
            },
          },
        );
        assert.deepEqual(knownResponse, unknownResponse);
        assert.equal(updates.length, 1);
      } finally {
        User.findOne = originals.findOne;
        User.updateOne = originals.updateOne;
        global.fetch = originals.fetch;
        clearTokenCache();
      }
    },
  );
});

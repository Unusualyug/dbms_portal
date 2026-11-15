const test = require("node:test");
const assert = require("node:assert/strict");
const ModuleManualProgress = require("../src/models/ModuleManualProgress");
const Practical = require("../src/models/Practical");
const PracticalAttempt = require("../src/models/PracticalAttempt");
const { OS_COURSE_CONTENT } = require("../src/config/constants");
const {
  buildModuleCompletionEmail,
  sendModuleCompletionEmail,
  moduleHasAllOfficialPracticalsApproved,
  processModuleCompletionEmail,
  processDueModuleCompletionEmails,
} = require("../src/services/moduleCompletionEmailService");
const { createSmtpTransportStub } = require("./helpers/smtpMocks");

const envKeys = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "REPORT_FROM_EMAIL",
  "CLIENT_URL",
];

function restoreEnv(original) {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function configureSmtp(prefix = "module-test") {
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_USER = `${prefix}@example.test`;
  process.env.SMTP_PASSWORD = `${prefix}-app-password`;
  process.env.REPORT_FROM_EMAIL = `GMIU DBMS Portal <${prefix}@example.test>`;
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
  configureSmtp();
  try {
    const email = buildModuleCompletionEmail(moduleEmailInput());
    assert.deepEqual(email.to, ["student@example.test"]);
    assert.equal(email.from, "GMIU DBMS Portal <module-test@example.test>");
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
    const osEmail = buildModuleCompletionEmail({
      ...moduleEmailInput(),
      progress: {
        completedPracticals: 8,
        totalPracticals: 8,
        courseCode: OS_COURSE_CONTENT.course.courseCode,
      },
    });
    assert.match(osEmail.text, /GMIU Operating Systems Learning Portal/);
    assert.match(osEmail.html, /OPERATING SYSTEMS LEARNING PORTAL/);
  } finally {
    restoreEnv(original);
  }
});

test("module-completion notices require admin approval for every practical in the selected course", async () => {
  const originalFind = Practical.find;
  const originalDistinct = PracticalAttempt.distinct;
  const OS_CODE = OS_COURSE_CONTENT.course.courseCode;
  let practicalFilter;
  let attemptFilter;
  let approvedIds = ["os-practical-1"];
  Practical.find = (filter) => {
    practicalFilter = filter;
    return {
      select() {
        return this;
      },
      async lean() {
        return [{ _id: "os-practical-1" }, { _id: "os-practical-2" }];
      },
    };
  };
  PracticalAttempt.distinct = async (field, filter) => {
    assert.equal(field, "practicalId");
    attemptFilter = filter;
    return approvedIds;
  };
  try {
    assert.equal(
      await moduleHasAllOfficialPracticalsApproved({
        studentId: "student-os",
        moduleId: "module-os",
        courseCode: OS_CODE,
        expectedCount: 2,
      }),
      false,
      "a single approved practical is not a complete module",
    );
    assert.deepEqual(practicalFilter, {
      $and: [
        { moduleId: "module-os", isActive: true },
        { courseCode: OS_CODE },
      ],
    });
    assert.deepEqual(attemptFilter, {
      $and: [
        {
          studentId: "student-os",
          practicalId: { $in: ["os-practical-1", "os-practical-2"] },
          reviewStatus: "approved",
        },
        { courseCode: OS_CODE },
      ],
    });
    approvedIds = ["os-practical-1", "os-practical-2"];
    assert.equal(
      await moduleHasAllOfficialPracticalsApproved({
        studentId: "student-os",
        moduleId: "module-os",
        courseCode: OS_CODE,
        expectedCount: 2,
      }),
      true,
    );
    assert.equal(
      await moduleHasAllOfficialPracticalsApproved({
        studentId: "student-os",
        moduleId: "module-os",
        courseCode: OS_CODE,
        expectedCount: 3,
      }),
      false,
      "the queued total must match the live official practical count",
    );
  } finally {
    Practical.find = originalFind;
    PracticalAttempt.distinct = originalDistinct;
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

test("Gmail SMTP sends the module email to the saved student address", async () => {
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  configureSmtp("module-send");
  const mock = createSmtpTransportStub();
  try {
    const result = await sendModuleCompletionEmail(moduleEmailInput());
    assert.equal(result.response, "250 2.0.0 Message accepted for delivery");
    assert.equal(mock.calls.length, 1);
    assert.deepEqual(mock.transportOptions[0], {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: "module-send@example.test",
        pass: "module-send-app-password",
      },
    });
    const message = mock.calls[0];
    assert.deepEqual(message.to, ["student@example.test"]);
    assert.equal(message.from, "GMIU DBMS Portal <module-send@example.test>");
    assert.match(message.text, /Congratulations! All 8 official practicals/);
    assert.match(
      message.messageId,
      /^<module-completion\.[a-f0-9]{32}@example\.test>$/,
    );
  } finally {
    mock.restore();
    restoreEnv(originalEnv);
  }
});

test("module-completion email fails safely when SMTP credentials are missing", async () => {
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"])
    delete process.env[key];
  try {
    await assert.rejects(
      sendModuleCompletionEmail(moduleEmailInput()),
      /smtp_not_configured/,
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
  configureSmtp("module-legacy");
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
    restoreEnv(originalEnv);
  }
});

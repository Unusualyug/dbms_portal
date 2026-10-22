const test = require("node:test");
const assert = require("node:assert/strict");
const HttpError = require("../src/utils/httpError");
const {
  normalizeSupportSubmission,
  normalizeSupportReply,
} = require("../src/services/supportMessageValidation");

test("support submission validates category, trims fields, and limits their sizes", () => {
  assert.deepEqual(
    normalizeSupportSubmission({
      category: " Question ",
      subject: "  Help   with points  ",
      message: "  How are practical points awarded?  ",
    }),
    {
      category: "question",
      subject: "Help with points",
      message: "How are practical points awarded?",
    },
  );
  assert.throws(
    () =>
      normalizeSupportSubmission({
        category: "complaint",
        subject: "Help",
        message: "A valid-length message.",
      }),
    (error) => error instanceof HttpError && error.status === 400,
  );
  assert.throws(
    () =>
      normalizeSupportSubmission({
        category: "question",
        subject: "Hi",
        message: "A valid-length message.",
      }),
    (error) => error instanceof HttpError && error.status === 400,
  );
  assert.throws(
    () =>
      normalizeSupportSubmission({
        category: "question",
        subject: "Help",
        message: "tiny",
      }),
    (error) => error instanceof HttpError && error.status === 400,
  );
  assert.throws(
    () =>
      normalizeSupportSubmission({
        category: "suggestion",
        subject: "x".repeat(121),
        message: "A valid-length message.",
      }),
    (error) => error instanceof HttpError && error.status === 400,
  );
});

test("admin reply trims whitespace and rejects empty or oversized replies", () => {
  assert.equal(
    normalizeSupportReply({ reply: "  Thanks, we will check this.  " }),
    "Thanks, we will check this.",
  );
  assert.throws(
    () => normalizeSupportReply({ reply: " " }),
    (error) => error instanceof HttpError && error.status === 400,
  );
  assert.throws(
    () => normalizeSupportReply({ reply: "x".repeat(4001) }),
    (error) => error instanceof HttpError && error.status === 400,
  );
});

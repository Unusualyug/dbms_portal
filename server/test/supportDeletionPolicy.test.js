const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildSupportMessageDeleteFilter,
} = require("../src/controllers/supportController");

test("the atomic read/delete filter allows unanswered requests", () => {
  const filter = buildSupportMessageDeleteFilter("support-id");
  assert.deepEqual(filter, {
    _id: "support-id",
    $or: [{ status: "open" }, { status: "replied", replyEmailStatus: "sent" }],
  });
});

test("the atomic read/delete filter requires a Resend-accepted email for replied requests", () => {
  const filter = buildSupportMessageDeleteFilter("support-id");
  assert.equal(
    filter.$or.some(
      (condition) =>
        condition.status === "replied" && condition.replyEmailStatus === "sent",
    ),
    true,
  );
  for (const status of ["not-applicable", "pending", "sending", "failed"]) {
    assert.equal(
      filter.$or.some(
        (condition) =>
          condition.status === "replied" &&
          condition.replyEmailStatus === status,
      ),
      false,
    );
  }
});

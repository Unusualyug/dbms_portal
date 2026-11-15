const test = require("node:test");
const assert = require("node:assert/strict");
const { OS_COURSE_CONTENT } = require("../src/config/constants");
const ActivityLog = require("../src/models/ActivityLog");
const {
  resolveClientActivityReferences,
} = require("../src/controllers/activityController");
const { recordActivity } = require("../src/services/activityService");

const OS_CODE = OS_COURSE_CONTENT.course.courseCode;
const topicId = "64b000000000000000000001";

function queryResult(value) {
  return { select: () => Promise.resolve(value) };
}

test("client activity cannot forge server-owned completion or submission events", async () => {
  await assert.rejects(
    resolveClientActivityReferences(
      { eventType: "TOPIC_COMPLETED", topicId },
      OS_CODE,
    ),
    (error) =>
      error.status === 400 &&
      /authenticated server workflow/.test(error.message),
  );
  await assert.rejects(
    resolveClientActivityReferences(
      { eventType: "PRACTICAL_SUBMITTED", practicalId: topicId },
      OS_CODE,
    ),
    (error) =>
      error.status === 400 &&
      /authenticated server workflow/.test(error.message),
  );
});

test("client activity rejects a DBMS item under the OS course header", async () => {
  let filter;
  const models = {
    Module: { findOne: () => queryResult(null) },
    Topic: {
      findOne: (value) => {
        filter = value;
        return queryResult(null);
      },
    },
    Question: { findOne: () => queryResult(null) },
    Practical: { findOne: () => queryResult(null) },
  };
  await assert.rejects(
    resolveClientActivityReferences(
      { eventType: "TOPIC_OPENED", topicId },
      OS_CODE,
      models,
    ),
    (error) => error.status === 400 && /selected subject/.test(error.message),
  );
  assert.ok(filter.$and.some((part) => part.courseCode === OS_CODE));
});

test("client activity derives parent modules from valid course content references", async () => {
  const moduleId = "64b000000000000000000002";
  const topic = { _id: topicId, moduleId };
  const models = {
    Module: { findOne: () => queryResult({ _id: moduleId }) },
    Topic: { findOne: () => queryResult(topic) },
    Question: { findOne: () => queryResult(null) },
    Practical: { findOne: () => queryResult(null) },
  };
  const result = await resolveClientActivityReferences(
    { eventType: "TOPIC_OPENED", topicId },
    OS_CODE,
    models,
  );
  assert.equal(String(result.moduleId), moduleId);
  assert.equal(String(result.topicId), topicId);
});

test("client activity rejects mismatched related content references within a course", async () => {
  const practicalId = "64b000000000000000000003";
  const topicModuleId = "64b000000000000000000002";
  const practicalModuleId = "64b000000000000000000004";
  const models = {
    Module: { findOne: () => queryResult(null) },
    Topic: {
      findOne: () => queryResult({ _id: topicId, moduleId: topicModuleId }),
    },
    Question: { findOne: () => queryResult(null) },
    Practical: {
      findOne: () =>
        queryResult({ _id: practicalId, moduleId: practicalModuleId }),
    },
  };
  await assert.rejects(
    resolveClientActivityReferences(
      { eventType: "TOPIC_OPENED", topicId, practicalId },
      OS_CODE,
      models,
    ),
    (error) => error.status === 400 && /same module/.test(error.message),
  );
});

test("admin activity socket events include the owning course code", async () => {
  const originalCreate = ActivityLog.create;
  const emissions = [];
  ActivityLog.create = async (record) => ({
    _id: "64b000000000000000000099",
    ...record,
  });
  const req = {
    courseCode: OS_CODE,
    user: { _id: "64b000000000000000000010" },
    sessionId: "session-os",
    app: {
      get: () => ({
        to: (room) => ({
          emit: (eventName, payload) =>
            emissions.push({ room, eventName, payload }),
        }),
      }),
    },
  };
  try {
    const event = await recordActivity({
      req,
      eventType: "TOPIC_OPENED",
      topicId,
    });
    assert.equal(event.courseCode, OS_CODE);
    assert.equal(emissions.length, 1);
    assert.equal(emissions[0].room, "admins");
    assert.equal(emissions[0].eventName, "admin:activity");
    assert.equal(emissions[0].payload.courseCode, OS_CODE);
  } finally {
    ActivityLog.create = originalCreate;
  }
});

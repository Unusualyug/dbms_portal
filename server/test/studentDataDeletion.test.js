const test = require("node:test");
const assert = require("node:assert/strict");
const {
  STUDENT_DATA_COLLECTIONS,
  deleteStudentData,
} = require("../src/services/studentDataDeletionService");

test("student removal includes every student-owned data collection", () => {
  assert.deepEqual(
    STUDENT_DATA_COLLECTIONS.map((entry) => entry.name),
    [
      "learningTimers",
      "sessions",
      "topicProgress",
      "questionAttempts",
      "officialPracticalAttempts",
      "practiceArenaAttempts",
      "moduleManualProgress",
      "learningTime",
      "activityLogs",
      "examResults",
    ],
  );
});

test("student data cleanup deletes each collection for the selected student and returns counts", async () => {
  const studentId = "student-object-id";
  const calls = [];
  const collections = STUDENT_DATA_COLLECTIONS.map(({ name }) => ({
    name,
    model: {
      async deleteMany(filter) {
        calls.push({ name, filter });
        return { deletedCount: name === "sessions" ? 2 : 1 };
      },
    },
  }));

  const deletedCounts = await deleteStudentData(studentId, collections);
  assert.equal(calls.length, collections.length);
  assert.ok(calls.every((call) => call.filter.studentId === studentId));
  assert.equal(deletedCounts.sessions, 2);
  assert.equal(deletedCounts.practiceArenaAttempts, 1);
  assert.equal(deletedCounts.activityLogs, 1);
});

test("student cleanup stops and surfaces a collection deletion error for retry", async () => {
  const error = new Error("database unavailable");
  const collections = [
    {
      name: "sessions",
      model: {
        async deleteMany() {
          return { deletedCount: 1 };
        },
      },
    },
    {
      name: "topicProgress",
      model: {
        async deleteMany() {
          throw error;
        },
      },
    },
    {
      name: "activityLogs",
      model: {
        async deleteMany() {
          assert.fail("cleanup must stop after an error");
        },
      },
    },
  ];
  await assert.rejects(
    deleteStudentData("student-object-id", collections),
    error,
  );
});

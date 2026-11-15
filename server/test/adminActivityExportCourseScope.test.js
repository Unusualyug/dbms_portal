const test = require("node:test");
const assert = require("node:assert/strict");
const ActivityLog = require("../src/models/ActivityLog");
const { COURSE_CODE, OS_COURSE_CONTENT } = require("../src/config/constants");
const { exportCsv } = require("../src/controllers/adminController");

function replace(target, key, value) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

function fakeQuery(value) {
  return {
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    populate() {
      return this;
    },
    lean() {
      return Promise.resolve(value);
    },
  };
}

test("activity CSV export filters DBMS legacy rows and OS rows to their own course", async () => {
  const OS_CODE = OS_COURSE_CONTENT.course.courseCode;
  const event = {
    timestamp: new Date("2026-10-08T10:00:00.000Z"),
    studentId: { name: "Asha", studentId: "GMIU-1" },
    eventType: "TOPIC_OPENED",
    moduleId: { moduleNumber: 1 },
    topicId: { title: "Course topic" },
    sessionId: "session-1",
  };
  const restore = replace(ActivityLog, "find", () => fakeQuery([event]));

  try {
    for (const courseCode of [COURSE_CODE, OS_CODE]) {
      let filter;
      const captureFilter = replace(ActivityLog, "find", (value) => {
        filter = value;
        return fakeQuery([event]);
      });
      let csv = "";
      let contentDisposition = "";
      const response = {
        setHeader(name, value) {
          if (name === "Content-Disposition") contentDisposition = value;
        },
        send(value) {
          csv = value;
        },
      };
      try {
        await exportCsv(
          { courseCode, params: { type: "activity" }, query: {} },
          response,
        );
      } finally {
        captureFilter();
      }
      if (courseCode === COURSE_CODE) {
        assert.deepEqual(filter, {
          $or: [
            { courseCode: COURSE_CODE },
            { courseCode: { $exists: false } },
            { courseCode: null },
          ],
        });
      } else {
        assert.deepEqual(filter, { courseCode: OS_CODE });
      }
      assert.ok(csv.startsWith('\uFEFF"courseCode"'));
      assert.ok(
        csv.includes(`"${courseCode}"`),
        "CSV identifies the selected course",
      );
      assert.match(
        contentDisposition,
        new RegExp(
          `filename="${courseCode}-activity-\\d{4}-\\d{2}-\\d{2}\\.csv"`,
        ),
      );
    }
  } finally {
    restore();
  }
});

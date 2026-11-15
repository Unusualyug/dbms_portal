const test = require("node:test");
const assert = require("node:assert/strict");
const { COURSE_CODE, OS_COURSE_CONTENT } = require("../src/config/constants");
const { courseFilter } = require("../src/services/courseScope");

const OS_CODE = OS_COURSE_CONTENT.course.courseCode;

test("DBMS course filters retain legacy untagged records as well as tagged DBMS records", () => {
  assert.deepEqual(courseFilter(COURSE_CODE, { studentId: "student-1" }), {
    $and: [
      { studentId: "student-1" },
      {
        $or: [
          { courseCode: COURSE_CODE },
          { courseCode: { $exists: false } },
          { courseCode: null },
        ],
      },
    ],
  });
});

test("OS course filters require an exact OS code and never include legacy DBMS records", () => {
  assert.deepEqual(courseFilter(OS_CODE, { studentId: "student-1" }), {
    $and: [{ studentId: "student-1" }, { courseCode: OS_CODE }],
  });
});

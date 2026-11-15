const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../src/models/User");
const { COURSE_CODE, OS_COURSE_CONTENT } = require("../src/config/constants");
const {
  findCohortStudents,
} = require("../src/controllers/examResultController");

function replace(target, key, value) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

function fakeQuery(value) {
  return {
    select() {
      return this;
    },
    sort() {
      return this;
    },
    lean() {
      return Promise.resolve(value);
    },
  };
}

test("DBMS Exam Result preserves its existing semester and class cohorts", async () => {
  let filter;
  const restore = replace(User, "find", (value) => {
    filter = value;
    return fakeQuery([]);
  });
  try {
    await findCohortStudents({
      courseCode: COURSE_CODE,
      semester: 3,
      classSection: "X1",
    });
    assert.deepEqual(filter, {
      role: "student",
      isActive: true,
      classSection: "X1",
      semester: 3,
    });
  } finally {
    restore();
  }
});

test("OS Exam Result uses official Semester 4 and the saved class without excluding shared DBMS student accounts", async () => {
  const OS_CODE = OS_COURSE_CONTENT.course.courseCode;
  let filter;
  const restore = replace(User, "find", (value) => {
    filter = value;
    return fakeQuery([]);
  });
  try {
    await findCohortStudents({
      courseCode: OS_CODE,
      semester: 4,
      classSection: "Y1",
    });
    assert.deepEqual(filter, {
      role: "student",
      isActive: true,
      classSection: "Y1",
    });
    assert.equal(OS_COURSE_CONTENT.course.semester, 4);
  } finally {
    restore();
  }
});

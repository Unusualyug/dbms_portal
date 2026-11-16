const test = require("node:test");
const assert = require("node:assert/strict");
const { attachCourseContext } = require("../src/middleware/courseContext");
const { COURSE_CODE, OS_COURSE_CONTENT } = require("../src/config/constants");

const OS_COURSE_CODE = OS_COURSE_CONTENT.course.courseCode;

function runCourseContext({ header, queryCourseCode } = {}) {
  const req = {
    query: queryCourseCode ? { courseCode: queryCourseCode } : {},
    get(name) {
      return name.toLowerCase() === "x-course-code" ? header : undefined;
    },
  };
  const variedHeaders = [];
  const res = {
    vary(name) {
      variedHeaders.push(name);
      return this;
    },
  };
  let nextError = null;
  attachCourseContext(req, res, (error) => {
    nextError = error || null;
  });
  return { req, variedHeaders, nextError };
}

test("course context uses the query parameter when a proxy omits the custom course header", () => {
  const { req, variedHeaders, nextError } = runCourseContext({
    queryCourseCode: OS_COURSE_CODE,
  });
  assert.equal(nextError, null);
  assert.equal(req.courseCode, OS_COURSE_CODE);
  assert.equal(req.course.code, OS_COURSE_CODE);
  assert.deepEqual(variedHeaders, ["x-course-code"]);
});

test("course context prefers the explicit course header and defaults to DBMS when neither is supplied", () => {
  const fromHeader = runCourseContext({
    header: OS_COURSE_CODE,
    queryCourseCode: COURSE_CODE,
  });
  assert.equal(fromHeader.nextError, null);
  assert.equal(fromHeader.req.courseCode, OS_COURSE_CODE);

  const defaultScope = runCourseContext();
  assert.equal(defaultScope.nextError, null);
  assert.equal(defaultScope.req.courseCode, COURSE_CODE);
});

test("course context rejects unsupported course codes rather than silently falling back", () => {
  const { req, nextError } = runCourseContext({
    queryCourseCode: "NOT-A-COURSE",
  });
  assert.equal(req.courseCode, undefined);
  assert.equal(nextError?.status, 400);
  assert.equal(nextError?.message, "Choose a supported subject.");
});

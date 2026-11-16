const test = require("node:test");
const assert = require("node:assert/strict");

test("API requests and CSV downloads send the selected course in both query and header for both courses", async () => {
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousFetch = global.fetch;
  const values = new Map();
  const calls = [];
  const clickedFiles = [];
  global.window = {
    localStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
  };
  global.document = {
    createElement: () => ({
      click() {
        clickedFiles.push(this.download);
      },
    }),
  };
  global.fetch = async (url, options) => {
    calls.push({ url, courseCode: options.headers["x-course-code"] });
    return new Response('{"ok":true}', {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const { DEFAULT_COURSE_CODE, OS_COURSE_CODE, saveSelectedCourseCode } =
      await import("../../client/src/services/courseSelection.js");
    const { api } = await import("../../client/src/services/api.js");
    for (const [courseCode, shortName] of [
      [DEFAULT_COURSE_CODE, "dbms"],
      [OS_COURSE_CODE, "os"],
    ]) {
      saveSelectedCourseCode(courseCode);
      await api.get("/student/progress?page=2&limit=10");
      await api.download("/admin/export/activity", `${shortName}-activity.csv`);
    }

    assert.deepEqual(calls, [
      {
        url: `/api/student/progress?page=2&limit=10&courseCode=${DEFAULT_COURSE_CODE}`,
        courseCode: DEFAULT_COURSE_CODE,
      },
      {
        url: `/api/admin/export/activity?courseCode=${DEFAULT_COURSE_CODE}`,
        courseCode: DEFAULT_COURSE_CODE,
      },
      {
        url: `/api/student/progress?page=2&limit=10&courseCode=${OS_COURSE_CODE}`,
        courseCode: OS_COURSE_CODE,
      },
      {
        url: `/api/admin/export/activity?courseCode=${OS_COURSE_CODE}`,
        courseCode: OS_COURSE_CODE,
      },
    ]);
    assert.deepEqual(clickedFiles, ["dbms-activity.csv", "os-activity.csv"]);
  } finally {
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
    global.fetch = previousFetch;
  }
});

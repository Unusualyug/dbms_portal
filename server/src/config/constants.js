// const COURSE_CONTENT = require('../seed/courseContent.json');
// const FIXED_ADMIN_EMAIL = 'yglakhani@gmiu.edu.in';
// const COURSE_CODE = COURSE_CONTENT.course.courseCode;

// module.exports = { COURSE_CONTENT, FIXED_ADMIN_EMAIL, COURSE_CODE };

const COURSE_CONTENT = require("../seed/courseContent.json");
const OS_COURSE_CONTENT = require("../seed/osCourseContent.json");

const FIXED_ADMIN_EMAIL = "yglakhani@gmiu.edu.in";
const COURSE_CODE = COURSE_CONTENT.course.courseCode;
const COURSE_CATALOG = Object.freeze({
  [COURSE_CODE]: Object.freeze({
    code: COURSE_CODE,
    shortName: "DBMS",
    subjectName: "Database Management System",
    portalLabel: "DBMS",
    course: COURSE_CONTENT.course,
    syllabus: COURSE_CONTENT,
    pointsField: "totalPoints",
    pointKeysField: "pointAwardKeys",
  }),
  [OS_COURSE_CONTENT.course.courseCode]: Object.freeze({
    code: OS_COURSE_CONTENT.course.courseCode,
    shortName: "OS",
    subjectName: "Operating Systems",
    portalLabel: "Operating Systems",
    course: OS_COURSE_CONTENT.course,
    syllabus: OS_COURSE_CONTENT,
    pointsField: `coursePoints.${OS_COURSE_CONTENT.course.courseCode}`,
    pointKeysField: `pointAwardKeysByCourse.${OS_COURSE_CONTENT.course.courseCode}`,
  }),
});
const COURSE_CODES = Object.freeze(Object.keys(COURSE_CATALOG));

function normalizeCourseCode(value) {
  const candidate = String(value || "")
    .trim()
    .toUpperCase();
  if (!candidate || candidate === "DBMS") return COURSE_CODE;
  if (
    candidate === "OS" ||
    candidate === "OPERATING SYSTEM" ||
    candidate === "OPERATING SYSTEMS"
  ) {
    return OS_COURSE_CONTENT.course.courseCode;
  }
  return COURSE_CATALOG[candidate] ? candidate : null;
}

function getCourse(courseCode = COURSE_CODE) {
  const normalized = normalizeCourseCode(courseCode);
  return normalized ? COURSE_CATALOG[normalized] : null;
}

function getCourseContent(courseCode = COURSE_CODE) {
  return getCourse(courseCode)?.syllabus || null;
}

module.exports = {
  COURSE_CONTENT,
  OS_COURSE_CONTENT,
  COURSE_CODE,
  COURSE_CODES,
  COURSE_CATALOG,
  FIXED_ADMIN_EMAIL,
  normalizeCourseCode,
  getCourse,
  getCourseContent,
};

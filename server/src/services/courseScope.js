const { COURSE_CODE, normalizeCourseCode } = require("../config/constants");

/**
 * Scope records to one course while treating pre-course-scope records as legacy DBMS
 * rows. OS reads never include missing courseCode values, so existing data stays
 * visible in DBMS and cannot leak into the new subject.
 */
function courseFilter(courseCode = COURSE_CODE, criteria = {}) {
  const normalized = normalizeCourseCode(courseCode) || COURSE_CODE;
  const scope =
    normalized === COURSE_CODE
      ? {
          $or: [
            { courseCode: COURSE_CODE },
            { courseCode: { $exists: false } },
            { courseCode: null },
          ],
        }
      : { courseCode: normalized };
  const hasCriteria =
    criteria &&
    typeof criteria === "object" &&
    Object.keys(criteria).length > 0;
  return hasCriteria ? { $and: [criteria, scope] } : scope;
}

function courseCodeForRecord(record, fallback = COURSE_CODE) {
  const code = normalizeCourseCode(record?.courseCode);
  return code || fallback;
}

module.exports = { courseFilter, courseCodeForRecord };

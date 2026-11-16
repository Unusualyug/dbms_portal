const HttpError = require("../utils/httpError");
const {
  COURSE_CODE,
  normalizeCourseCode,
  getCourse,
} = require("../config/constants");

function attachCourseContext(req, res, next) {
  res.vary("x-course-code");
  const requested =
    req.get("x-course-code") || req.query.courseCode || COURSE_CODE;
  const courseCode = normalizeCourseCode(requested);
  if (!courseCode)
    return next(new HttpError(400, "Choose a supported subject."));
  req.courseCode = courseCode;
  req.course = getCourse(courseCode);
  next();
}

module.exports = { attachCourseContext };

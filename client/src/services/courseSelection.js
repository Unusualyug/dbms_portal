export const DEFAULT_COURSE_CODE = "BETICE13305";
export const OS_COURSE_CODE = "BET1CE14311";
export const COURSE_STORAGE_KEY = "gmiu-learning-selected-course-v1";
export const SUPPORTED_COURSE_CODES = Object.freeze([
  DEFAULT_COURSE_CODE,
  OS_COURSE_CODE,
]);
let inMemoryCourseCode = DEFAULT_COURSE_CODE;

export function readSelectedCourseCode() {
  try {
    const value = window.localStorage.getItem(COURSE_STORAGE_KEY);
    if (SUPPORTED_COURSE_CODES.includes(value)) {
      inMemoryCourseCode = value;
      return value;
    }
  } catch {
    // Fall through to the in-memory selection when storage is blocked.
  }
  return inMemoryCourseCode;
}

export function saveSelectedCourseCode(courseCode) {
  if (!SUPPORTED_COURSE_CODES.includes(courseCode)) return false;
  inMemoryCourseCode = courseCode;
  try {
    window.localStorage.setItem(COURSE_STORAGE_KEY, courseCode);
  } catch {
    // In-memory selection still works when browser storage is unavailable.
  }
  return true;
}

export function fallbackCourse(code) {
  if (code === OS_COURSE_CODE) {
    return {
      code,
      shortName: "OS",
      subjectName: "Operating Systems",
      portalLabel: "Operating Systems",
      semester: 4,
    };
  }
  return {
    code: DEFAULT_COURSE_CODE,
    shortName: "DBMS",
    subjectName: "Database Management System",
    portalLabel: "DBMS",
    semester: 3,
  };
}

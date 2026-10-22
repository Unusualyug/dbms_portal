const HttpError = require("../utils/httpError");

const ASSESSMENT_TYPES = Object.freeze(["session1", "session2", "ala"]);
const SEMESTERS = Object.freeze([3, 5]);
const CLASS_SECTIONS = Object.freeze(["X1", "X2", "Y1", "Y2"]);

function normalizeAssessmentType(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (key === "session1") return "session1";
  if (key === "session2") return "session2";
  if (key === "ala") return "ala";
  throw new HttpError(400, "Choose Session 1, Session 2, or ALA.");
}

function normalizeAcademicYear(value) {
  const academicYear = String(value || "").trim();
  const match = /^(\d{4})-(\d{2}|\d{4})$/.exec(academicYear);
  if (!match)
    throw new HttpError(
      400,
      "Academic year must use a format such as 2026-27.",
    );
  const startYear = Number(match[1]);
  const endYear =
    match[2].length === 2
      ? Math.floor(startYear / 100) * 100 + Number(match[2])
      : Number(match[2]);
  if (endYear !== startYear + 1)
    throw new HttpError(400, "Academic year must cover two consecutive years.");
  return academicYear;
}

function normalizeSubjects(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) {
    throw new HttpError(400, "Add between 1 and 30 subjects.");
  }
  const seenNames = new Set();
  const seenIds = new Set();
  return value.map((subject) => {
    if (!subject || typeof subject !== "object")
      throw new HttpError(400, "Each subject needs a name and maximum marks.");
    const name = String(subject.name || "")
      .trim()
      .replace(/\s+/g, " ");
    const maxMarks = Number(subject.maxMarks);
    if (name.length < 2 || name.length > 100)
      throw new HttpError(400, "Subject names must be 2 to 100 characters.");
    if (!Number.isFinite(maxMarks) || maxMarks <= 0 || maxMarks > 10000) {
      throw new HttpError(400, `Enter a valid maximum mark for ${name}.`);
    }
    const nameKey = name.toLocaleLowerCase();
    if (seenNames.has(nameKey))
      throw new HttpError(
        400,
        "Subject names must be unique within an assessment.",
      );
    seenNames.add(nameKey);
    const rawId = subject.id ?? subject._id;
    let id;
    if (rawId !== undefined && rawId !== null && String(rawId).trim()) {
      id = String(rawId).trim();
      if (!/^[a-f\d]{24}$/i.test(id))
        throw new HttpError(400, "A subject ID is invalid.");
      if (seenIds.has(id))
        throw new HttpError(400, "Subject IDs must be unique.");
      seenIds.add(id);
    }
    return {
      ...(id ? { id } : {}),
      name,
      maxMarks: Math.round(maxMarks * 100) / 100,
    };
  });
}

function normalizeExamAssessment(body = {}) {
  const assessmentType = normalizeAssessmentType(body.assessmentType);
  const title = String(body.title || "")
    .trim()
    .replace(/\s+/g, " ");
  if (title.length < 2 || title.length > 100)
    throw new HttpError(400, "Assessment name must be 2 to 100 characters.");
  const academicYear = normalizeAcademicYear(body.academicYear);
  const semester = Number(body.semester);
  if (!SEMESTERS.includes(semester))
    throw new HttpError(400, "Choose semester 3 or 5.");
  const classSection = String(body.classSection || "")
    .trim()
    .toUpperCase();
  if (!CLASS_SECTIONS.includes(classSection))
    throw new HttpError(400, "Choose a valid class section.");
  const subjects = normalizeSubjects(body.subjects);
  return {
    assessmentType,
    title,
    academicYear,
    semester,
    classSection,
    subjects,
  };
}

function normalizeExamMarks(results, subjects) {
  if (!Array.isArray(results) || results.length > 1000)
    throw new HttpError(400, "Marks must be submitted as a student list.");
  const subjectMap = new Map(
    subjects.map((subject) => [String(subject._id || subject.id), subject]),
  );
  const studentIds = new Set();
  return results.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      !/^[a-f\d]{24}$/i.test(String(row.studentId || ""))
    ) {
      throw new HttpError(400, "A student ID is invalid.");
    }
    const studentId = String(row.studentId);
    if (studentIds.has(studentId))
      throw new HttpError(
        400,
        "A student appears more than once in the marks list.",
      );
    studentIds.add(studentId);
    if (!Array.isArray(row.marks))
      throw new HttpError(400, "Each student must have a subject-mark list.");
    const seenSubjects = new Set();
    const marks = [];
    for (const mark of row.marks) {
      if (!mark || typeof mark !== "object")
        throw new HttpError(400, "A subject mark is invalid.");
      const subjectId = String(mark.subjectId || "");
      if (!/^[a-f\d]{24}$/i.test(subjectId) || !subjectMap.has(subjectId)) {
        throw new HttpError(
          400,
          "A mark refers to a subject outside this assessment.",
        );
      }
      if (seenSubjects.has(subjectId))
        throw new HttpError(
          400,
          "A subject appears more than once for a student.",
        );
      seenSubjects.add(subjectId);
      if (
        mark.marksObtained === "" ||
        mark.marksObtained === null ||
        mark.marksObtained === undefined
      )
        continue;
      const marksObtained = Number(mark.marksObtained);
      const subject = subjectMap.get(subjectId);
      if (
        !Number.isFinite(marksObtained) ||
        marksObtained < 0 ||
        marksObtained > Number(subject.maxMarks)
      ) {
        throw new HttpError(
          400,
          `Marks for ${subject.name} must be between 0 and ${subject.maxMarks}.`,
        );
      }
      marks.push({
        subjectId,
        marksObtained: Math.round(marksObtained * 100) / 100,
      });
    }
    return { studentId, marks };
  });
}

function countMissingExamMarks(studentIds, subjects, results) {
  const resultByStudent = new Map(
    results.map((result) => [String(result.studentId), result]),
  );
  let missingCount = 0;
  for (const studentId of studentIds) {
    const result = resultByStudent.get(String(studentId));
    const markedSubjectIds = new Set(
      (result?.marks || []).map((mark) => String(mark.subjectId)),
    );
    for (const subject of subjects) {
      if (!markedSubjectIds.has(String(subject._id || subject.id)))
        missingCount += 1;
    }
  }
  return missingCount;
}

module.exports = {
  ASSESSMENT_TYPES,
  SEMESTERS,
  CLASS_SECTIONS,
  normalizeExamAssessment,
  normalizeExamMarks,
  countMissingExamMarks,
};

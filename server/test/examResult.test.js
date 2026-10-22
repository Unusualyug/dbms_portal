const test = require("node:test");
const assert = require("node:assert/strict");
const HttpError = require("../src/utils/httpError");
const {
  normalizeExamAssessment,
  normalizeExamMarks,
  countMissingExamMarks,
} = require("../src/services/examResultValidation");

const subjectMathId = "64b000000000000000000001";
const subjectDbmsId = "64b000000000000000000002";
const studentOneId = "64b000000000000000000010";
const studentTwoId = "64b000000000000000000011";

function validAssessment(overrides = {}) {
  return {
    assessmentType: "Session 1",
    title: "Session 1",
    academicYear: "2026-27",
    semester: "3",
    classSection: "x1",
    subjects: [
      { name: "Mathematics", maxMarks: "100" },
      { name: "DBMS", maxMarks: 75 },
    ],
    ...overrides,
  };
}

test("exam assessment setup normalizes type, cohort, subject names and max marks", () => {
  assert.deepEqual(normalizeExamAssessment(validAssessment()), {
    assessmentType: "session1",
    title: "Session 1",
    academicYear: "2026-27",
    semester: 3,
    classSection: "X1",
    subjects: [
      { name: "Mathematics", maxMarks: 100 },
      { name: "DBMS", maxMarks: 75 },
    ],
  });
});

test("exam assessment setup rejects bad types, academic years and duplicate subjects", () => {
  assert.throws(
    () => normalizeExamAssessment(validAssessment({ assessmentType: "quiz" })),
    (error) => error instanceof HttpError && error.status === 400,
  );
  assert.throws(
    () => normalizeExamAssessment(validAssessment({ academicYear: "2026-29" })),
    (error) => error instanceof HttpError && error.status === 400,
  );
  assert.throws(
    () =>
      normalizeExamAssessment(
        validAssessment({
          subjects: [
            { name: "DBMS", maxMarks: 100 },
            { name: " dbms ", maxMarks: 50 },
          ],
        }),
      ),
    (error) => error instanceof HttpError && error.status === 400,
  );
});

test("marks allow zero and blank cells while enforcing subject maximums", () => {
  const subjects = [
    { _id: subjectMathId, name: "Mathematics", maxMarks: 100 },
    { _id: subjectDbmsId, name: "DBMS", maxMarks: 75 },
  ];
  const results = normalizeExamMarks(
    [
      {
        studentId: studentOneId,
        marks: [
          { subjectId: subjectMathId, marksObtained: "0" },
          { subjectId: subjectDbmsId, marksObtained: "" },
        ],
      },
    ],
    subjects,
  );
  assert.deepEqual(results, [
    {
      studentId: studentOneId,
      marks: [{ subjectId: subjectMathId, marksObtained: 0 }],
    },
  ]);
  assert.throws(
    () =>
      normalizeExamMarks(
        [
          {
            studentId: studentOneId,
            marks: [{ subjectId: subjectMathId, marksObtained: 101 }],
          },
        ],
        subjects,
      ),
    (error) => error instanceof HttpError && error.status === 400,
  );
  assert.throws(
    () =>
      normalizeExamMarks(
        [
          {
            studentId: studentOneId,
            marks: [
              { subjectId: "64b000000000000000000099", marksObtained: 10 },
            ],
          },
        ],
        subjects,
      ),
    (error) => error instanceof HttpError && error.status === 400,
  );
});

test("publish completeness counts every missing student-subject mark", () => {
  const students = [studentOneId, studentTwoId];
  const subjects = [{ _id: subjectMathId }, { _id: subjectDbmsId }];
  const results = [
    {
      studentId: studentOneId,
      marks: [{ subjectId: subjectMathId }, { subjectId: subjectDbmsId }],
    },
    { studentId: studentTwoId, marks: [{ subjectId: subjectMathId }] },
  ];
  assert.equal(countMissingExamMarks(students, subjects, results), 1);
  results[1].marks.push({ subjectId: subjectDbmsId });
  assert.equal(countMissingExamMarks(students, subjects, results), 0);
});

const ExamAssessment = require("../models/ExamAssessment");
const ExamResult = require("../models/ExamResult");
const User = require("../models/User");
const HttpError = require("../utils/httpError");
const {
  normalizeExamAssessment,
  normalizeExamMarks,
  countMissingExamMarks,
} = require("../services/examResultValidation");

const ASSESSMENT_LIST_LIMIT = 200;

function assertObjectId(id) {
  if (!/^[a-f\d]{24}$/i.test(String(id || "")))
    throw new HttpError(400, "Assessment ID is invalid.");
}

function mapAssessment(row) {
  return {
    id: String(row._id),
    assessmentType: row.assessmentType,
    title: row.title,
    academicYear: row.academicYear,
    semester: row.semester,
    classSection: row.classSection,
    subjects: (row.subjects || []).map((subject) => ({
      id: String(subject._id),
      name: subject.name,
      maxMarks: subject.maxMarks,
    })),
    status: row.status,
    publishedAt: row.publishedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function subjectDocuments(subjects) {
  return subjects.map(({ id, name, maxMarks }) => ({
    ...(id ? { _id: id } : {}),
    name,
    maxMarks,
  }));
}

async function getAssessmentOrThrow(id) {
  assertObjectId(id);
  const assessment = await ExamAssessment.findById(id);
  if (!assessment) throw new HttpError(404, "Assessment not found.");
  return assessment;
}

async function findCohortStudents(assessment) {
  return User.find({
    role: "student",
    isActive: true,
    semester: assessment.semester,
    classSection: assessment.classSection,
  })
    .select("name studentId semester classSection")
    .sort({ name: 1, studentId: 1 })
    .lean();
}

async function getAdminAssessmentData(assessment) {
  const [roster, records] = await Promise.all([
    findCohortStudents(assessment),
    ExamResult.find({ assessmentId: assessment._id })
      .select("studentId marks")
      .lean(),
  ]);
  const resultByStudent = new Map(
    records.map((record) => [String(record.studentId), record]),
  );
  const students = roster.map((student) => {
    const record = resultByStudent.get(String(student._id));
    const markBySubject = new Map(
      (record?.marks || []).map((mark) => [
        String(mark.subjectId),
        mark.marksObtained,
      ]),
    );
    return {
      id: String(student._id),
      name: student.name,
      studentId: student.studentId || "",
      marks: (assessment.subjects || []).map((subject) => ({
        subjectId: String(subject._id),
        marksObtained: markBySubject.has(String(subject._id))
          ? markBySubject.get(String(subject._id))
          : "",
      })),
    };
  });
  const missingMarks = countMissingExamMarks(
    roster.map((student) => student._id),
    assessment.subjects,
    records,
  );
  return {
    assessment: mapAssessment(assessment),
    students,
    missingMarks,
    studentCount: roster.length,
  };
}

async function listAdminAssessments(req, res) {
  const assessments = await ExamAssessment.find({})
    .sort({ academicYear: -1, createdAt: -1 })
    .limit(ASSESSMENT_LIST_LIMIT)
    .lean();
  res.json({
    assessments: assessments.map(mapAssessment),
    limit: ASSESSMENT_LIST_LIMIT,
  });
}

async function createAssessment(req, res) {
  const input = normalizeExamAssessment(req.body);
  try {
    const assessment = await ExamAssessment.create({
      ...input,
      subjects: subjectDocuments(input.subjects),
      createdBy: req.user._id,
    });
    res.status(201).json({ assessment: mapAssessment(assessment) });
  } catch (error) {
    if (error.code === 11000)
      throw new HttpError(
        409,
        "An assessment with that name, cohort, and academic year already exists.",
      );
    throw error;
  }
}

async function getAdminAssessment(req, res) {
  const assessment = await getAssessmentOrThrow(req.params.id);
  res.json(await getAdminAssessmentData(assessment));
}

async function updateAssessment(req, res) {
  const assessment = await getAssessmentOrThrow(req.params.id);
  if (assessment.status !== "draft")
    throw new HttpError(
      409,
      "Unpublish this assessment before changing its setup.",
    );
  const input = normalizeExamAssessment({
    assessmentType: assessment.assessmentType,
    title: req.body.title ?? assessment.title,
    academicYear: assessment.academicYear,
    semester: assessment.semester,
    classSection: assessment.classSection,
    subjects: req.body.subjects ?? assessment.subjects,
  });
  assessment.title = input.title;
  assessment.subjects = subjectDocuments(input.subjects);
  try {
    await assessment.save();
  } catch (error) {
    if (error.code === 11000)
      throw new HttpError(
        409,
        "An assessment with that name, cohort, and academic year already exists.",
      );
    throw error;
  }
  const retainedSubjectIds = assessment.subjects.map((subject) => subject._id);
  await ExamResult.updateMany(
    { assessmentId: assessment._id },
    { $pull: { marks: { subjectId: { $nin: retainedSubjectIds } } } },
  );
  res.json(await getAdminAssessmentData(assessment));
}

async function saveAssessmentMarks(req, res) {
  const assessment = await getAssessmentOrThrow(req.params.id);
  if (assessment.status !== "draft")
    throw new HttpError(
      409,
      "Unpublish this assessment before changing marks.",
    );
  const roster = await findCohortStudents(assessment);
  const allowedStudentIds = new Set(
    roster.map((student) => String(student._id)),
  );
  const normalizedRows = normalizeExamMarks(
    req.body.results,
    assessment.subjects,
  );
  if (normalizedRows.some((row) => !allowedStudentIds.has(row.studentId))) {
    throw new HttpError(
      400,
      "Marks can only be entered for active students in this assessment cohort.",
    );
  }
  if (normalizedRows.length) {
    await ExamResult.bulkWrite(
      normalizedRows.map((row) => ({
        updateOne: {
          filter: { assessmentId: assessment._id, studentId: row.studentId },
          update: { $set: { marks: row.marks, updatedBy: req.user._id } },
          upsert: true,
        },
      })),
      { ordered: true },
    );
  }
  res.json(await getAdminAssessmentData(assessment));
}

async function publishAssessment(req, res) {
  const assessment = await getAssessmentOrThrow(req.params.id);
  if (assessment.status === "published")
    return res.json({
      assessment: mapAssessment(assessment),
      alreadyPublished: true,
    });
  const roster = await findCohortStudents(assessment);
  if (!roster.length)
    throw new HttpError(
      409,
      "There are no active students in this cohort to publish.",
    );
  const records = await ExamResult.find({
    assessmentId: assessment._id,
    studentId: { $in: roster.map((student) => student._id) },
  })
    .select("studentId marks")
    .lean();
  const missingMarks = countMissingExamMarks(
    roster.map((student) => student._id),
    assessment.subjects,
    records,
  );
  if (missingMarks) {
    throw new HttpError(
      409,
      `Cannot publish yet: ${missingMarks} student subject mark${missingMarks === 1 ? " is" : "s are"} missing.`,
    );
  }
  assessment.status = "published";
  assessment.publishedAt = new Date();
  await assessment.save();
  res.json({ assessment: mapAssessment(assessment), published: true });
}

async function unpublishAssessment(req, res) {
  const assessment = await getAssessmentOrThrow(req.params.id);
  if (assessment.status !== "published")
    throw new HttpError(409, "This assessment is already a draft.");
  assessment.status = "draft";
  assessment.publishedAt = null;
  await assessment.save();
  res.json({ assessment: mapAssessment(assessment), unpublished: true });
}

async function deleteAssessment(req, res) {
  const assessment = await getAssessmentOrThrow(req.params.id);
  if (assessment.status !== "draft")
    throw new HttpError(409, "Unpublish this assessment before deleting it.");
  await ExamResult.deleteMany({ assessmentId: assessment._id });
  await ExamAssessment.deleteOne({ _id: assessment._id });
  res.json({ deleted: true, id: String(assessment._id) });
}

async function listStudentExamResults(req, res) {
  if (!req.user.semester || !req.user.classSection)
    return res.json({ assessments: [] });
  const studentResults = await ExamResult.find({ studentId: req.user._id })
    .select("assessmentId marks")
    .lean();
  if (!studentResults.length) return res.json({ assessments: [] });
  const resultByAssessment = new Map(
    studentResults.map((row) => [String(row.assessmentId), row]),
  );
  const assessments = await ExamAssessment.find({
    _id: { $in: studentResults.map((row) => row.assessmentId) },
    semester: req.user.semester,
    classSection: req.user.classSection,
    status: "published",
  })
    .sort({ academicYear: -1, publishedAt: -1, createdAt: -1 })
    .lean();

  res.json({
    assessments: assessments.map((assessment) => {
      const result = resultByAssessment.get(String(assessment._id));
      const markBySubject = new Map(
        (result?.marks || []).map((mark) => [
          String(mark.subjectId),
          mark.marksObtained,
        ]),
      );
      const subjects = assessment.subjects.map((subject) => ({
        id: String(subject._id),
        name: subject.name,
        maxMarks: subject.maxMarks,
        marksObtained: markBySubject.has(String(subject._id))
          ? markBySubject.get(String(subject._id))
          : null,
      }));
      const totalObtained = subjects.reduce(
        (total, subject) =>
          total +
          (Number.isFinite(subject.marksObtained) ? subject.marksObtained : 0),
        0,
      );
      const totalMaximum = subjects.reduce(
        (total, subject) => total + Number(subject.maxMarks || 0),
        0,
      );
      return {
        ...mapAssessment(assessment),
        subjects,
        totalObtained,
        totalMaximum,
        percentage: totalMaximum
          ? Math.round((totalObtained / totalMaximum) * 1000) / 10
          : 0,
      };
    }),
  });
}

module.exports = {
  listAdminAssessments,
  createAssessment,
  getAdminAssessment,
  updateAssessment,
  saveAssessmentMarks,
  publishAssessment,
  unpublishAssessment,
  deleteAssessment,
  listStudentExamResults,
  mapAssessment,
};

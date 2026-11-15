const ExamAssessment = require("../models/ExamAssessment");
const ExamResult = require("../models/ExamResult");
const User = require("../models/User");
const { COURSE_CODE, getCourse } = require("../config/constants");
const { courseFilter } = require("../services/courseScope");
const HttpError = require("../utils/httpError");
const {
  normalizeExamAssessment,
  normalizeExamMarks,
  countMissingExamMarks,
  findReadyExamResultStudentIds,
} = require("../services/examResultValidation");

const ASSESSMENT_LIST_LIMIT = 200;

function assertObjectId(id) {
  if (!/^[a-f\d]{24}$/i.test(String(id || "")))
    throw new HttpError(400, "Assessment ID is invalid.");
}

function mapAssessment(row) {
  return {
    id: String(row._id),
    courseCode: row.courseCode || COURSE_CODE,
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

async function getAssessmentOrThrow(id, courseCode = COURSE_CODE) {
  assertObjectId(id);
  const assessment = await ExamAssessment.findOne(
    courseFilter(courseCode, { _id: id }),
  );
  if (!assessment) throw new HttpError(404, "Assessment not found.");
  return assessment;
}

async function findCohortStudents(assessment) {
  const courseCode = assessment.courseCode || COURSE_CODE;
  const filter = {
    role: "student",
    isActive: true,
    classSection: assessment.classSection,
  };
  // DBMS keeps its existing student-semester cohorts. Other curricula may use
  // their official semester even when the shared student profile was created for DBMS.
  if (courseCode === COURSE_CODE) filter.semester = assessment.semester;
  return User.find(filter)
    .select("name studentId semester classSection")
    .sort({ name: 1, studentId: 1 })
    .lean();
}

async function getAdminAssessmentData(assessment) {
  const courseCode = assessment.courseCode || COURSE_CODE;
  const [roster, records] = await Promise.all([
    findCohortStudents(assessment),
    ExamResult.find(courseFilter(courseCode, { assessmentId: assessment._id }))
      .select("studentId marks publishedAt")
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
      publishedAt: record?.publishedAt || null,
      marks: (assessment.subjects || []).map((subject) => ({
        subjectId: String(subject._id),
        marksObtained: markBySubject.has(String(subject._id))
          ? markBySubject.get(String(subject._id))
          : "",
      })),
    };
  });
  const rosterIds = roster.map((student) => student._id);
  const missingMarks = countMissingExamMarks(
    rosterIds,
    assessment.subjects,
    records,
  );
  const publishedCount = roster.filter(
    (student) => resultByStudent.get(String(student._id))?.publishedAt,
  ).length;
  const readyToPublishCount = findReadyExamResultStudentIds(
    rosterIds,
    assessment.subjects,
    records,
  ).length;
  const incompleteStudentCount = Math.max(
    0,
    roster.length - publishedCount - readyToPublishCount,
  );
  return {
    courseCode,
    assessment: mapAssessment(assessment),
    students,
    missingMarks,
    studentCount: roster.length,
    publishedCount,
    readyToPublishCount,
    incompleteStudentCount,
  };
}

async function listAdminAssessments(req, res) {
  const assessments = await ExamAssessment.find(
    courseFilter(req.courseCode, {}),
  )
    .sort({ academicYear: -1, createdAt: -1 })
    .limit(ASSESSMENT_LIST_LIMIT)
    .lean();
  res.json({
    courseCode: req.courseCode,
    assessments: assessments.map(mapAssessment),
    limit: ASSESSMENT_LIST_LIMIT,
  });
}

async function createAssessment(req, res) {
  const input = normalizeExamAssessment(req.body);
  const course = getCourse(req.courseCode || COURSE_CODE);
  if (
    course &&
    course.code !== COURSE_CODE &&
    input.semester !== Number(course.course.semester)
  ) {
    throw new HttpError(
      400,
      `This course's official semester is ${course.course.semester}.`,
    );
  }
  try {
    const assessment = await ExamAssessment.create({
      courseCode: req.courseCode,
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
  const assessment = await getAssessmentOrThrow(req.params.id, req.courseCode);
  res.json(await getAdminAssessmentData(assessment));
}

async function updateAssessment(req, res) {
  const assessment = await getAssessmentOrThrow(req.params.id, req.courseCode);
  const courseCode = assessment.courseCode || COURSE_CODE;
  assessment.courseCode = courseCode;
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
    courseFilter(courseCode, { assessmentId: assessment._id }),
    { $pull: { marks: { subjectId: { $nin: retainedSubjectIds } } } },
  );
  res.json(await getAdminAssessmentData(assessment));
}

async function saveAssessmentMarks(req, res) {
  const assessment = await getAssessmentOrThrow(req.params.id, req.courseCode);
  const courseCode = assessment.courseCode || COURSE_CODE;
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
    const alreadyPublished = await ExamResult.exists(
      courseFilter(courseCode, {
        assessmentId: assessment._id,
        studentId: { $in: normalizedRows.map((row) => row.studentId) },
        publishedAt: { $ne: null },
      }),
    );
    if (alreadyPublished)
      throw new HttpError(
        409,
        "Unpublish this assessment before changing marks that are already visible to students.",
      );
    await ExamResult.bulkWrite(
      normalizedRows.map((row) => ({
        updateOne: {
          filter: courseFilter(courseCode, {
            assessmentId: assessment._id,
            studentId: row.studentId,
          }),
          update: {
            $set: { courseCode, marks: row.marks, updatedBy: req.user._id },
          },
          upsert: true,
        },
      })),
      { ordered: true },
    );
  }
  res.json(await getAdminAssessmentData(assessment));
}

async function publishAssessment(req, res) {
  const assessment = await getAssessmentOrThrow(req.params.id, req.courseCode);
  const courseCode = assessment.courseCode || COURSE_CODE;
  assessment.courseCode = courseCode;
  const roster = await findCohortStudents(assessment);
  if (!roster.length)
    throw new HttpError(
      409,
      "There are no active students in this cohort to publish.",
    );
  const rosterIds = roster.map((student) => student._id);
  const records = await ExamResult.find(
    courseFilter(courseCode, {
      assessmentId: assessment._id,
      studentId: { $in: rosterIds },
    }),
  )
    .select("studentId marks publishedAt")
    .lean();
  const readyStudentIds = findReadyExamResultStudentIds(
    rosterIds,
    assessment.subjects,
    records,
  );
  if (!readyStudentIds.length)
    throw new HttpError(
      409,
      "No complete student marks are ready to publish. Enter and save at least one student’s marks first.",
    );

  const publishedAt = new Date();
  const updated = await ExamResult.updateMany(
    courseFilter(courseCode, {
      assessmentId: assessment._id,
      studentId: { $in: readyStudentIds },
      publishedAt: null,
    }),
    { $set: { publishedAt } },
  );
  assessment.status = "published";
  assessment.publishedAt = assessment.publishedAt || publishedAt;
  await assessment.save();
  const publishedCount = await ExamResult.countDocuments(
    courseFilter(courseCode, {
      assessmentId: assessment._id,
      studentId: { $in: rosterIds },
      publishedAt: { $ne: null },
    }),
  );
  res.json({
    courseCode,
    assessment: mapAssessment(assessment),
    publishedNow: Number(updated.modifiedCount) || 0,
    publishedCount,
    pendingCount: Math.max(0, roster.length - publishedCount),
  });
}

async function unpublishAssessment(req, res) {
  const assessment = await getAssessmentOrThrow(req.params.id, req.courseCode);
  const courseCode = assessment.courseCode || COURSE_CODE;
  assessment.courseCode = courseCode;
  if (assessment.status !== "published")
    throw new HttpError(409, "This assessment is already a draft.");
  await ExamResult.updateMany(
    courseFilter(courseCode, { assessmentId: assessment._id }),
    { $set: { publishedAt: null } },
  );
  assessment.status = "draft";
  assessment.publishedAt = null;
  await assessment.save();
  res.json({ assessment: mapAssessment(assessment), unpublished: true });
}

async function deleteAssessment(req, res) {
  const assessment = await getAssessmentOrThrow(req.params.id, req.courseCode);
  const courseCode = assessment.courseCode || COURSE_CODE;
  if (assessment.status !== "draft")
    throw new HttpError(409, "Unpublish this assessment before deleting it.");
  await ExamResult.deleteMany(
    courseFilter(courseCode, { assessmentId: assessment._id }),
  );
  await ExamAssessment.deleteOne(
    courseFilter(courseCode, { _id: assessment._id }),
  );
  res.json({ deleted: true, id: String(assessment._id) });
}

async function listStudentExamResults(req, res) {
  const courseCode = req.courseCode || COURSE_CODE;
  const course = getCourse(courseCode);
  const semester =
    courseCode === COURSE_CODE
      ? req.user.semester
      : Number(course?.course?.semester);
  if (!semester || !req.user.classSection)
    return res.json({ courseCode, assessments: [] });
  const studentResults = await ExamResult.find(
    courseFilter(courseCode, {
      studentId: req.user._id,
      publishedAt: { $ne: null },
    }),
  )
    .select("assessmentId marks publishedAt")
    .lean();
  if (!studentResults.length) return res.json({ courseCode, assessments: [] });
  const resultByAssessment = new Map(
    studentResults.map((row) => [String(row.assessmentId), row]),
  );
  const assessments = await ExamAssessment.find(
    courseFilter(courseCode, {
      _id: { $in: studentResults.map((row) => row.assessmentId) },
      semester,
      classSection: req.user.classSection,
      status: "published",
    }),
  )
    .sort({ academicYear: -1, publishedAt: -1, createdAt: -1 })
    .lean();

  res.json({
    courseCode,
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
        publishedAt: result?.publishedAt || assessment.publishedAt,
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
  findCohortStudents,
  mapAssessment,
};

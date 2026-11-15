const mongoose = require("mongoose");
const Practical = require("../models/Practical");
const PracticalAttempt = require("../models/PracticalAttempt");
const { courseFilter } = require("../services/courseScope");
const {
  getPointAwardKeys,
  getCoursePoints,
} = require("../services/pointsService");
const {
  ensureSubmissionAvailable,
} = require("../services/submissionLockService");
const { recordActivity, touchUser } = require("../services/activityService");
const { COURSE_CODE } = require("../config/constants");
const HttpError = require("../utils/httpError");

function practicalQuery(id) {
  return mongoose.isValidObjectId(id) ? { _id: id } : { key: id };
}

async function findPracticalOrThrow(id, courseCode = COURSE_CODE) {
  const practical = await Practical.findOne(
    courseFilter(courseCode, { ...practicalQuery(id), isActive: true }),
  );
  if (!practical) throw new HttpError(404, "Practical task not found.");
  return practical;
}

function mapAttempt(attempt) {
  return {
    _id: attempt._id,
    attemptNumber: attempt.attemptNumber,
    reviewStatus: attempt.reviewStatus || "pending",
    reviewFeedback: attempt.reviewFeedback || "",
    reviewedAt: attempt.reviewedAt || null,
    submittedAt: attempt.submittedAt,
    completedAt: attempt.completedAt || null,
    isCorrect: attempt.isCorrect,
    pointsAwarded: attempt.pointsAwarded || 0,
    executionMode: attempt.executionMode,
    syntaxStatus: attempt.syntaxStatus,
    validationEngine: attempt.validationEngine,
    validationNote: attempt.validationNote,
  };
}

async function listPracticals(req, res) {
  const courseCode = req.courseCode || COURSE_CODE;
  const [practicals, attempts, awardKeys] = await Promise.all([
    Practical.find(courseFilter(courseCode, { isActive: true }))
      .select(
        "courseCode key moduleId number prompt sourcePage sourceWordingUnclear dialect validationPolicy isActive",
      )
      .populate("moduleId", "moduleNumber title slug")
      .sort({ moduleId: 1, number: 1 })
      .lean(),
    PracticalAttempt.find(courseFilter(courseCode, { studentId: req.user._id }))
      .select(
        "practicalId attemptNumber reviewStatus reviewFeedback reviewedAt submittedAt completedAt isCorrect pointsAwarded executionMode syntaxStatus validationEngine validationNote",
      )
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean(),
    getPointAwardKeys(req.user._id, courseCode),
  ]);
  const latestByPractical = new Map();
  for (const attempt of attempts)
    if (!latestByPractical.has(String(attempt.practicalId)))
      latestByPractical.set(String(attempt.practicalId), attempt);
  const awardedKeys = new Set(awardKeys);
  res.json({
    courseCode,
    practicals: practicals.map((practical) => {
      const latest = latestByPractical.get(String(practical._id));
      const completed =
        awardedKeys.has(`practical:${practical._id}`) ||
        Boolean(latest?.completedAt) ||
        latest?.reviewStatus === "approved";
      return {
        ...practical,
        completed,
        lastAttempt: latest ? mapAttempt(latest) : null,
      };
    }),
  });
}

async function openPractical(req, res) {
  const practical = await findPracticalOrThrow(
    req.params.practicalId,
    req.courseCode,
  );
  await recordActivity({
    req,
    eventType: "PRACTICAL_OPENED",
    moduleId: practical.moduleId,
    practicalId: practical._id,
  });
  res.json({ practical });
}

async function getHistory(req, res) {
  const practical = await findPracticalOrThrow(
    req.params.practicalId,
    req.courseCode,
  );
  const attempts = await PracticalAttempt.find(
    courseFilter(req.courseCode, {
      studentId: req.user._id,
      practicalId: practical._id,
    }),
  )
    .select(
      "attemptNumber reviewStatus reviewFeedback reviewedAt submittedAt completedAt isCorrect pointsAwarded executionMode syntaxStatus validationEngine validationNote",
    )
    .sort({ submittedAt: -1, createdAt: -1 })
    .lean();
  res.json({ courseCode: req.courseCode, attempts: attempts.map(mapAttempt) });
}

async function submit(req, res) {
  const practical = await findPracticalOrThrow(
    req.params.practicalId,
    req.courseCode,
  );
  const submittedCode = req.body?.code;
  if (typeof submittedCode !== "string" || !submittedCode.trim())
    throw new HttpError(
      400,
      "Write your solution before submitting it for instructor review.",
    );
  if (submittedCode.length > 20000)
    throw new HttpError(413, "Your submission exceeds the 20 KB limit.");

  const awardKey = `practical:${practical._id}`;
  await ensureSubmissionAvailable({
    AttemptModel: PracticalAttempt,
    studentId: req.user._id,
    itemFilter: { practicalId: practical._id },
    awardKey,
    itemLabel: "practical",
    courseCode: req.courseCode,
  });

  const attemptNumber =
    (await PracticalAttempt.countDocuments(
      courseFilter(req.courseCode, {
        studentId: req.user._id,
        practicalId: practical._id,
      }),
    )) + 1;
  const now = new Date();
  const attempt = await PracticalAttempt.create({
    courseCode: req.courseCode,
    studentId: req.user._id,
    moduleId: practical.moduleId,
    practicalId: practical._id,
    sessionId: req.sessionId,
    attemptNumber,
    submittedCode,
    executionMode: "submission-only",
    syntaxStatus: "not-run",
    validationEngine: "manual review",
    validationNote:
      "Saved for instructor review. This submission was not executed.",
    expectedResultStatus: "not-run",
    databaseStateStatus: "not-run",
    isCorrect: null,
    reviewStatus: "pending",
    reviewFeedback: "",
    output: "",
    expectedOutput: "",
    error: "",
    pointsAwarded: 0,
    startedAt: now,
    submittedAt: now,
    completedAt: null,
  });
  await touchUser(req.user._id);
  await recordActivity({
    req,
    eventType: "PRACTICAL_SUBMITTED",
    moduleId: practical.moduleId,
    practicalId: practical._id,
    metadata: { attemptNumber, result: "pending" },
  });
  const totalPoints = await getCoursePoints({
    studentId: req.user._id,
    courseCode: req.courseCode,
  });
  res.status(201).json({
    courseCode: req.courseCode,
    practicalId: String(practical._id),
    attempt: mapAttempt(attempt),
    pointsAwarded: 0,
    pointsAlreadyEarned: false,
    totalPoints,
    note: "Your solution is waiting for instructor review. It was not executed, and points are awarded only if the instructor approves it.",
  });
}

module.exports = {
  listPracticals,
  openPractical,
  getHistory,
  submit,
  findPracticalOrThrow,
};

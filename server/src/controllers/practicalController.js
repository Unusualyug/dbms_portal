const mongoose = require('mongoose');
const Practical = require('../models/Practical');
const PracticalAttempt = require('../models/PracticalAttempt');
const LearningTime = require('../models/LearningTime');
const { recordActivity } = require('../services/activityService');
const { getPointAwardKeys } = require('../services/pointsService');
const { ensureSubmissionAvailable } = require('../services/submissionLockService');
const HttpError = require('../utils/httpError');

async function findPractical(id) {
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { key: id };
  const practical = await Practical.findOne({ ...query, isActive: true });
  if (!practical) throw new HttpError(404, 'Practical not found.');
  return practical;
}

async function listPracticals(req, res) {
  const practicals = await Practical.find({ isActive: true }).populate('moduleId', 'moduleNumber title slug').sort({ moduleId: 1, number: 1 }).lean();
  const [attempts, pointAwardKeys] = await Promise.all([
    PracticalAttempt.find({ studentId: req.user._id })
      .select('practicalId attemptNumber reviewStatus reviewFeedback isCorrect submittedAt completedAt pointsAwarded executionMode')
      .sort({ submittedAt: -1 }).lean(),
    getPointAwardKeys(req.user._id),
  ]);
  const awardedKeys = new Set(pointAwardKeys);
  const latest = new Map();
  const approved = new Map();
  const completed = new Set();
  for (const attempt of attempts) {
    const key = String(attempt.practicalId);
    if (!latest.has(key)) latest.set(key, attempt);
    if (attempt.reviewStatus === 'approved' && !approved.has(key)) approved.set(key, attempt);
    if (attempt.completedAt) completed.add(key);
  }
  const awardedPracticalIds = practicals
    .filter((practical) => awardedKeys.has(`practical:${practical._id}`))
    .map((practical) => practical._id);
  for (const practicalId of awardedPracticalIds) completed.add(String(practicalId));
  if (awardedPracticalIds.length) {
    await PracticalAttempt.updateMany(
      { studentId: req.user._id, practicalId: { $in: awardedPracticalIds }, submittedCode: { $exists: true, $type: 'string', $ne: '' } },
      { $unset: { submittedCode: 1 }, $set: { solutionPurgedAt: new Date() } },
    );
  }
  res.json({ practicals: practicals.map((practical) => {
    const awardKey = `practical:${practical._id}`;
    const awarded = awardedKeys.has(awardKey);
    const practicalId = String(practical._id);
    const lastAttempt = (awarded ? approved.get(practicalId) : null) || latest.get(practicalId) || null;
    return {
      ...practical,
      completed: completed.has(practicalId),
      lastAttempt: awarded && lastAttempt ? { ...lastAttempt, reviewStatus: 'approved', isCorrect: true } : lastAttempt,
    };
  }) });
}

async function getHistory(req, res) {
  const practical = await findPractical(req.params.practicalId);
  const attempts = await PracticalAttempt.find({ studentId: req.user._id, practicalId: practical._id })
    .sort({ submittedAt: -1 }).limit(30).lean();
  res.json({ attempts });
}

async function openPractical(req, res) {
  const practical = await findPractical(req.params.practicalId);
  await recordActivity({ req, eventType: 'PRACTICAL_OPENED', moduleId: practical.moduleId, practicalId: practical._id });
  res.json({ practical });
}

/**
 * Save a student's SQL/PLSQL as a submission for instructor review. This endpoint
 * intentionally never executes the submitted source and never returns SQL output.
 */
async function submit(req, res) {
  const practical = await findPractical(req.params.practicalId);
  const awardKey = `practical:${practical._id}`;
  await ensureSubmissionAvailable({
    AttemptModel: PracticalAttempt,
    studentId: req.user._id,
    itemFilter: { practicalId: practical._id },
    awardKey,
    itemLabel: 'practical',
  });
  const code = req.body?.code;
  if (typeof code !== 'string' || !code.trim()) throw new HttpError(400, 'Add SQL or PL/SQL code before submitting.');
  if (code.length > 20000) throw new HttpError(413, 'Code exceeds the 20 KB practical limit.');

  const attemptNumber = (await PracticalAttempt.countDocuments({ studentId: req.user._id, practicalId: practical._id })) + 1;
  const [timeRows] = await Promise.all([
    LearningTime.aggregate([
      { $match: { studentId: req.user._id, practicalId: practical._id } },
      { $group: { _id: null, seconds: { $sum: '$activeSeconds' } } },
    ]),
  ]);
  const now = new Date();
  const attempt = await PracticalAttempt.create({
    studentId: req.user._id,
    moduleId: practical.moduleId,
    practicalId: practical._id,
    sessionId: req.sessionId,
    attemptNumber,
    submittedCode: code,
    executionMode: 'submission-only',
    syntaxStatus: 'not-run',
    validationEngine: 'manual review',
    validationNote: 'Saved for instructor review. This submission was not executed.',
    expectedResultStatus: 'not-run',
    databaseStateStatus: 'not-run',
    isCorrect: null,
    reviewStatus: 'pending',
    reviewFeedback: '',
    pointsAwarded: 0,
    output: '',
    expectedOutput: '',
    error: '',
    executionTimeMs: null,
    timeSpentSec: timeRows[0]?.seconds || 0,
    startedAt: now,
    submittedAt: now,
    completedAt: null,
  });
  await recordActivity({
    req,
    eventType: 'PRACTICAL_SUBMITTED',
    moduleId: practical.moduleId,
    practicalId: practical._id,
    metadata: { attemptNumber, result: 'pending-review', pointsAwarded: 0 },
  });

  res.status(201).json({
    attempt: {
      id: attempt._id,
      attemptNumber,
      isCorrect: null,
      reviewStatus: attempt.reviewStatus,
      reviewFeedback: attempt.reviewFeedback,
      executionMode: attempt.executionMode,
      syntaxStatus: attempt.syntaxStatus,
      validationEngine: attempt.validationEngine,
      validationNote: attempt.validationNote,
      expectedResultStatus: attempt.expectedResultStatus,
      databaseStateStatus: attempt.databaseStateStatus,
      output: '',
      expectedOutput: '',
      error: '',
      executionTimeMs: null,
      timeSpentSec: attempt.timeSpentSec,
      submittedAt: attempt.submittedAt,
      completedAt: null,
      pointsAwarded: 0,
    },
    completionRecorded: false,
    pointsAwarded: 0,
    pointsAlreadyEarned: false,
    totalPoints: req.user.totalPoints || 0,
    note: 'Your solution was submitted for instructor review. It was not executed, and points are awarded only if it is approved.',
  });
}

module.exports = { listPracticals, getHistory, openPractical, submit, run: submit, findPractical };

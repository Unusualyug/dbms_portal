const mongoose = require('mongoose');
const PracticalAttempt = require('../models/PracticalAttempt');
const PracticeArenaAttempt = require('../models/PracticeArenaAttempt');
const User = require('../models/User');
const { POINT_VALUES, awardPointsOnce } = require('../services/pointsService');
const { normalizeReviewDecision, buildReviewFields } = require('../services/submissionReviewService');
const HttpError = require('../utils/httpError');
const practiceArenaRounds = require('../../../shared/practiceArena.json');
const { syncStudentModuleManualProgress } = require('../services/moduleManualProgressService');

const challengeById = new Map(practiceArenaRounds.flatMap((round) => round.sections.flatMap((section) => section.tasks.map((task) => [
  task.id,
  { ...task, roundTitle: round.title, sectionTitle: section.title },
]))));

function listParams(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 30));
  return { page, limit, skip: (page - 1) * limit };
}

function getStatusFilter(status) {
  if (status === 'all') return { reviewStatus: { $in: ['pending', 'approved', 'rejected', 'superseded'] } };
  if (['pending', 'approved', 'rejected'].includes(status)) return { reviewStatus: status };
  throw new HttpError(400, 'Status must be pending, approved, rejected, or all.');
}

function mapPracticalAttempt(attempt) {
  const module = attempt.moduleId || {};
  const practical = attempt.practicalId || {};
  const student = attempt.studentId || {};
  const number = practical.number == null ? '—' : String(practical.number).padStart(2, '0');
  return {
    id: String(attempt._id),
    type: 'practical',
    reviewStatus: attempt.reviewStatus || 'pending',
    reviewFeedback: attempt.reviewFeedback || '',
    reviewedAt: attempt.reviewedAt || null,
    submittedAt: attempt.submittedAt,
    attemptNumber: attempt.attemptNumber,
    submittedCode: attempt.submittedCode,
    pointsAwarded: attempt.pointsAwarded || 0,
    student: {
      id: student._id ? String(student._id) : null,
      name: student.name || 'Student account unavailable',
      studentId: student.studentId || '',
      email: student.email || '',
      semester: student.semester || null,
      classSection: student.classSection || '',
    },
    title: `Module ${module.moduleNumber || '—'} · Practical ${number}`,
    moduleTitle: module.title || '',
    prompt: practical.prompt || 'The practical prompt is unavailable.',
  };
}

function mapArenaAttempt(attempt) {
  const student = attempt.studentId || {};
  const challenge = challengeById.get(attempt.challengeId);
  return {
    id: String(attempt._id),
    type: 'arena',
    reviewStatus: attempt.reviewStatus || 'pending',
    reviewFeedback: attempt.reviewFeedback || '',
    reviewedAt: attempt.reviewedAt || null,
    submittedAt: attempt.submittedAt,
    attemptNumber: attempt.attemptNumber,
    submittedCode: attempt.submittedCode,
    pointsAwarded: attempt.pointsAwarded || 0,
    student: {
      id: student._id ? String(student._id) : null,
      name: student.name || 'Student account unavailable',
      studentId: student.studentId || '',
      email: student.email || '',
      semester: student.semester || null,
      classSection: student.classSection || '',
    },
    title: challenge ? `${challenge.roundTitle} · ${challenge.title}` : `Practice Arena · ${attempt.challengeId}`,
    moduleTitle: challenge?.sectionTitle || 'Practice Arena',
    prompt: challenge?.prompt || 'The challenge prompt is unavailable.',
  };
}

async function listSubmissions(req, res) {
  const status = req.query.status || 'pending';
  const filter = getStatusFilter(status);
  const type = req.query.type || 'all';
  if (!['all', 'practical', 'arena'].includes(type)) throw new HttpError(400, 'Type must be all, practical, or arena.');
  const { page, limit, skip } = listParams(req.query);
  const fetchLimit = skip + limit;
  const sort = { submittedAt: status === 'pending' ? 1 : -1 };
  const shouldQueryPracticals = type === 'all' || type === 'practical';
  const shouldQueryArena = type === 'all' || type === 'arena';
  const [practicalRows, arenaRows, practicalTotal, arenaTotal, pendingPractical, pendingArena] = await Promise.all([
    shouldQueryPracticals
      ? PracticalAttempt.find(filter).sort(sort).limit(fetchLimit)
        .populate('studentId', 'name studentId email semester classSection')
        .populate('practicalId', 'number prompt')
        .populate('moduleId', 'moduleNumber title').lean()
      : [],
    shouldQueryArena
      ? PracticeArenaAttempt.find(filter).sort(sort).limit(fetchLimit)
        .populate('studentId', 'name studentId email semester classSection').lean()
      : [],
    shouldQueryPracticals ? PracticalAttempt.countDocuments(filter) : 0,
    shouldQueryArena ? PracticeArenaAttempt.countDocuments(filter) : 0,
    shouldQueryPracticals ? PracticalAttempt.countDocuments({ reviewStatus: 'pending' }) : 0,
    shouldQueryArena ? PracticeArenaAttempt.countDocuments({ reviewStatus: 'pending' }) : 0,
  ]);
  const submissions = [
    ...practicalRows.map(mapPracticalAttempt),
    ...arenaRows.map(mapArenaAttempt),
  ].sort((a, b) => {
    const timeA = new Date(a.submittedAt || 0).getTime();
    const timeB = new Date(b.submittedAt || 0).getTime();
    return status === 'pending' ? timeA - timeB : timeB - timeA;
  }).slice(skip, skip + limit);
  const total = practicalTotal + arenaTotal;
  res.json({
    submissions,
    pendingCount: pendingPractical + pendingArena,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

async function reviewSubmission(req, res) {
  const type = req.params.type;
  const Model = type === 'practical' ? PracticalAttempt : type === 'arena' ? PracticeArenaAttempt : null;
  if (!Model) throw new HttpError(400, 'Submission type must be practical or arena.');
  if (!mongoose.isValidObjectId(req.params.attemptId)) throw new HttpError(400, 'Invalid submission ID.');

  let decision;
  try {
    decision = normalizeReviewDecision(req.body || {});
  } catch (error) {
    throw new HttpError(400, error.message);
  }
  const reviewedAt = new Date();
  const update = buildReviewFields({ ...decision, reviewerId: req.user._id, reviewedAt });
  const attempt = await Model.findOneAndUpdate(
    { _id: req.params.attemptId, reviewStatus: 'pending' },
    { $set: update },
    { new: true },
  );
  if (!attempt) throw new HttpError(409, 'This submission is no longer pending review. Refresh the queue and try again.');

  let pointAward = { awarded: false, pointsAwarded: 0, totalPoints: null };
  let moduleManualProgress = null;
  let moduleManualProgressWarning = false;
  if (decision.decision === 'approve') {
    const awardKey = type === 'practical'
      ? `practical:${attempt.practicalId}`
      : `practice-arena:${attempt.challengeId}`;
    try {
      pointAward = await awardPointsOnce({
        studentId: attempt.studentId,
        awardKey,
        points: POINT_VALUES.practical,
      });
      const itemFilter = type === 'practical'
        ? { studentId: attempt.studentId, practicalId: attempt.practicalId }
        : { studentId: attempt.studentId, challengeId: attempt.challengeId };
      await Model.updateOne(
        { _id: attempt._id, reviewStatus: 'approved' },
        { $set: { pointsAwarded: pointAward.pointsAwarded } },
      );
      await Model.updateMany(
        { ...itemFilter, reviewStatus: 'pending', _id: { $ne: attempt._id } },
        { $set: {
          reviewStatus: 'superseded',
          reviewFeedback: 'This attempt was closed because another submission for this item was approved.',
          reviewedBy: req.user._id,
          reviewedAt,
          isCorrect: null,
          completedAt: null,
          pointsAwarded: 0,
          solutionPurgedAt: reviewedAt,
        } },
      );
      await Model.updateMany(
        itemFilter,
        { $set: { solutionPurgedAt: reviewedAt }, $unset: { submittedCode: 1 } },
      );
      attempt.pointsAwarded = pointAward.pointsAwarded;
      attempt.solutionPurgedAt = reviewedAt;
      attempt.submittedCode = undefined;
    } catch (error) {
      // If the point service completed, keep the approved state even if a later
      // purge write failed; student list/progress reads and startup cleanup retry it.
      if (pointAward.totalPoints === null) {
        await Model.updateOne(
          { _id: attempt._id, reviewStatus: 'approved', reviewedBy: req.user._id },
          { $set: { reviewStatus: 'pending', reviewFeedback: '', reviewedBy: null, reviewedAt: null, isCorrect: null, completedAt: null, pointsAwarded: 0 } },
        );
      }
      throw error;
    }
  } else {
    await Model.updateOne(
      { _id: attempt._id, reviewStatus: 'rejected' },
      { $set: { solutionPurgedAt: reviewedAt }, $unset: { submittedCode: 1 } },
    );
    attempt.solutionPurgedAt = reviewedAt;
    attempt.submittedCode = undefined;
  }

  if (type === 'practical' && decision.decision === 'approve') {
    try {
      moduleManualProgress = await syncStudentModuleManualProgress(attempt.studentId, attempt.moduleId);
    } catch (error) {
      moduleManualProgressWarning = true;
      console.error('Could not update module manual progress:', error.message);
    }
  }

  const latestStudent = pointAward.totalPoints === null
    ? await User.findById(attempt.studentId).select('totalPoints').lean()
    : null;
  const totalPoints = pointAward.totalPoints ?? latestStudent?.totalPoints ?? 0;
  const io = req.app?.get('io');
  if (io) io.to(`student:${attempt.studentId}`).emit('student:submission-reviewed', {
    type,
    itemId: type === 'practical' ? String(attempt.practicalId) : attempt.challengeId,
    reviewStatus: attempt.reviewStatus,
    reviewFeedback: attempt.reviewFeedback,
    completed: decision.decision === 'approve',
    pointsAwarded: pointAward.pointsAwarded,
    totalPoints,
    moduleManualStatus: moduleManualProgress?.moduleManualStatus || null,
  });
  res.json({
    submission: {
      id: String(attempt._id),
      type,
      reviewStatus: attempt.reviewStatus,
      reviewFeedback: attempt.reviewFeedback,
      reviewedAt: attempt.reviewedAt,
      solutionPurgedAt: attempt.solutionPurgedAt || null,
      completedAt: attempt.completedAt,
      pointsAwarded: attempt.pointsAwarded || 0,
    },
    pointsAwarded: pointAward.pointsAwarded,
    pointsAlreadyEarned: decision.decision === 'approve' && !pointAward.awarded,
    totalPoints,
    moduleManualProgress: moduleManualProgress ? {
      moduleNumber: moduleManualProgress.moduleNumber,
      moduleManualStatus: moduleManualProgress.moduleManualStatus,
      completedPracticals: moduleManualProgress.completedPracticals,
      totalPracticals: moduleManualProgress.totalPracticals,
    } : null,
    moduleManualProgressWarning,
  });
}

module.exports = { listSubmissions, reviewSubmission };

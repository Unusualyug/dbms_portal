const PracticeArenaAttempt = require('../models/PracticeArenaAttempt');
const { touchUser } = require('../services/activityService');
const { getPointAwardKeys } = require('../services/pointsService');
const { ensureSubmissionAvailable } = require('../services/submissionLockService');
const HttpError = require('../utils/httpError');
const practiceArenaRounds = require('../../../shared/practiceArena.json');

const challenges = new Map(practiceArenaRounds.flatMap((round) => round.sections.flatMap((section) => section.tasks.map((task) => [
  task.id,
  { ...task, roundTitle: round.title, sectionTitle: section.title },
]))));

async function getProgress(req, res) {
  const [rows, pointAwardKeys, approvedAttempts] = await Promise.all([
    PracticeArenaAttempt.aggregate([
      { $match: { studentId: req.user._id } },
      { $sort: { submittedAt: -1 } },
      { $group: { _id: '$challengeId', latest: { $first: '$$ROOT' }, completedAt: { $max: '$completedAt' } } },
    ]),
    getPointAwardKeys(req.user._id),
    PracticeArenaAttempt.find({ studentId: req.user._id, reviewStatus: 'approved' })
      .select('challengeId attemptNumber isCorrect reviewStatus reviewFeedback reviewedAt executionMode syntaxStatus expectedResultStatus databaseStateStatus validationEngine validationNote pointsAwarded submittedAt completedAt')
      .sort({ submittedAt: -1 }).lean(),
  ]);
  const approvedByChallenge = new Map();
  for (const attempt of approvedAttempts) {
    if (!approvedByChallenge.has(attempt.challengeId)) approvedByChallenge.set(attempt.challengeId, attempt);
  }
  const awardedChallengeIds = new Set(pointAwardKeys
    .filter((key) => key.startsWith('practice-arena:'))
    .map((key) => key.slice('practice-arena:'.length)));
  const progress = {};
  for (const row of rows) {
    const completedByPoints = awardedChallengeIds.has(row._id);
    const latest = completedByPoints ? (approvedByChallenge.get(row._id) || row.latest) : row.latest;
    progress[row._id] = {
      completed: Boolean(row.completedAt || completedByPoints),
      completedAt: row.completedAt || null,
      latest: {
        attemptNumber: latest.attemptNumber,
        isCorrect: completedByPoints ? true : latest.isCorrect,
        reviewStatus: completedByPoints ? 'approved' : (latest.reviewStatus || 'not-required'),
        reviewFeedback: latest.reviewFeedback || '',
        reviewedAt: latest.reviewedAt || null,
        executionMode: latest.executionMode,
        syntaxStatus: latest.syntaxStatus,
        expectedResultStatus: latest.expectedResultStatus,
        databaseStateStatus: latest.databaseStateStatus,
        validationEngine: latest.validationEngine,
        validationNote: latest.validationNote,
        pointsAwarded: latest.pointsAwarded,
        submittedAt: latest.submittedAt,
        completedAt: latest.completedAt,
      },
    };
  }
  for (const challengeId of awardedChallengeIds) {
    if (!progress[challengeId]) {
      progress[challengeId] = { completed: true, completedAt: null, latest: null };
    }
  }
  if (awardedChallengeIds.size) {
    await PracticeArenaAttempt.updateMany(
      { studentId: req.user._id, challengeId: { $in: [...awardedChallengeIds] }, submittedCode: { $exists: true, $type: 'string', $ne: '' } },
      { $unset: { submittedCode: 1 }, $set: { solutionPurgedAt: new Date() } },
    );
  }
  res.json({ progress, completedCount: Object.values(progress).filter((item) => item.completed).length });
}

/** Save code for review; this handler deliberately never executes student SQL. */
async function submitChallenge(req, res) {
  const challenge = challenges.get(req.params.challengeId);
  if (!challenge) throw new HttpError(404, 'Practice Arena challenge not found.');
  const awardKey = `practice-arena:${challenge.id}`;
  await ensureSubmissionAvailable({
    AttemptModel: PracticeArenaAttempt,
    studentId: req.user._id,
    itemFilter: { challengeId: challenge.id },
    awardKey,
    itemLabel: 'challenge',
  });

  const code = req.body?.code;
  if (typeof code !== 'string' || !code.trim()) throw new HttpError(400, 'Write a SQL or PL/SQL solution before submitting it.');
  if (code.length > 20000) throw new HttpError(413, 'Solution exceeds the 20 KB limit.');

  const attemptNumber = (await PracticeArenaAttempt.countDocuments({ studentId: req.user._id, challengeId: challenge.id })) + 1;
  const now = new Date();
  const attempt = await PracticeArenaAttempt.create({
    studentId: req.user._id,
    challengeId: challenge.id,
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
    output: '',
    expectedOutput: '',
    error: '',
    executionTimeMs: null,
    pointsAwarded: 0,
    submittedAt: now,
    completedAt: null,
  });
  await touchUser(req.user._id);

  res.status(201).json({
    challengeId: challenge.id,
    attempt: {
      attemptNumber: attempt.attemptNumber,
      isCorrect: null,
      reviewStatus: attempt.reviewStatus,
      reviewFeedback: attempt.reviewFeedback,
      executionMode: attempt.executionMode,
      syntaxStatus: attempt.syntaxStatus,
      expectedResultStatus: attempt.expectedResultStatus,
      databaseStateStatus: attempt.databaseStateStatus,
      validationEngine: attempt.validationEngine,
      validationNote: attempt.validationNote,
      submittedAt: attempt.submittedAt,
      completedAt: null,
      pointsAwarded: 0,
    },
    pointsAwarded: 0,
    pointsAlreadyEarned: false,
    totalPoints: req.user.totalPoints || 0,
    note: 'Your solution was submitted for instructor review. It was not executed. After a decision, the stored code is deleted; points are awarded only if approved.',
  });
}

module.exports = { getProgress, submitChallenge, runChallenge: submitChallenge };

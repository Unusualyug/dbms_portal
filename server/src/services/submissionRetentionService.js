const PracticalAttempt = require('../models/PracticalAttempt');
const PracticeArenaAttempt = require('../models/PracticeArenaAttempt');

const REVIEWED_SOLUTION_FILTER = {
  $or: [
    { completedAt: { $ne: null } },
    { reviewStatus: { $in: ['approved', 'rejected', 'superseded', 'not-required'] } },
  ],
  submittedCode: { $exists: true, $type: 'string', $ne: '' },
};

/** Permanently clear SQL/PLSQL text after a review or existing completion. */
async function purgeReviewedSolutions() {
  const solutionPurgedAt = new Date();
  const update = {
    $unset: { submittedCode: 1 },
    $set: { solutionPurgedAt },
  };
  const [practical, arena] = await Promise.all([
    PracticalAttempt.updateMany(REVIEWED_SOLUTION_FILTER, update),
    PracticeArenaAttempt.updateMany(REVIEWED_SOLUTION_FILTER, update),
  ]);
  return {
    practicals: Number(practical.modifiedCount) || 0,
    arena: Number(arena.modifiedCount) || 0,
    total: (Number(practical.modifiedCount) || 0) + (Number(arena.modifiedCount) || 0),
  };
}

module.exports = { REVIEWED_SOLUTION_FILTER, purgeReviewedSolutions };

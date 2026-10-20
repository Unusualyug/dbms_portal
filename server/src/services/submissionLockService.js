const { hasPointsAward } = require('./pointsService');
const HttpError = require('../utils/httpError');

async function ensureSubmissionAvailable({ AttemptModel, studentId, itemFilter, awardKey, itemLabel }) {
  const filter = { studentId, ...itemFilter };
  const [completedAttempt, alreadyAwarded] = await Promise.all([
    AttemptModel.exists({ ...filter, completedAt: { $ne: null } }),
    hasPointsAward({ studentId, awardKey }),
  ]);
  if (completedAttempt || alreadyAwarded) {
    throw new HttpError(409, `You already earned points for this ${itemLabel}. It is now locked.`);
  }

  const pendingAttempt = await AttemptModel.exists({ ...filter, reviewStatus: 'pending' });
  if (pendingAttempt) {
    throw new HttpError(409, `A submission for this ${itemLabel} is already awaiting review. Wait for a decision before submitting again.`);
  }
}

module.exports = { ensureSubmissionAvailable };

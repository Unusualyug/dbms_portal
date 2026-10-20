const User = require('../models/User');

const POINT_VALUES = Object.freeze({ mcq: 10, practical: 20 });

/**
 * Atomically grants an item award once per student. The per-user award key and
 * points total are changed by one MongoDB document update, so concurrent retries
 * cannot increment the same question/practical more than once.
 */
async function awardPointsOnce({ studentId, awardKey, points }) {
  if (!studentId || !awardKey || !Number.isInteger(points) || points <= 0) {
    throw new TypeError('A student, award key, and positive integer point value are required.');
  }

  const updated = await User.findOneAndUpdate(
    { _id: studentId, role: 'student', pointAwardKeys: { $ne: awardKey } },
    { $addToSet: { pointAwardKeys: awardKey }, $inc: { totalPoints: points } },
    { new: true },
  ).select('totalPoints').lean();

  if (updated) return { awarded: true, pointsAwarded: points, totalPoints: updated.totalPoints || 0 };

  const current = await User.findById(studentId).select('totalPoints').lean();
  if (!current) throw new Error('Student account was not found while awarding points.');
  return { awarded: false, pointsAwarded: 0, totalPoints: current.totalPoints || 0 };
}

async function hasPointsAward({ studentId, awardKey }) {
  if (!studentId || !awardKey) return false;
  return Boolean(await User.exists({ _id: studentId, role: 'student', pointAwardKeys: awardKey }));
}

async function getPointAwardKeys(studentId) {
  if (!studentId) return [];
  const user = await User.findById(studentId).select('+pointAwardKeys').lean();
  return Array.isArray(user?.pointAwardKeys) ? user.pointAwardKeys : [];
}

module.exports = { POINT_VALUES, awardPointsOnce, hasPointsAward, getPointAwardKeys };

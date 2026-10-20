const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/User');
const PracticalAttempt = require('../src/models/PracticalAttempt');
const PracticeArenaAttempt = require('../src/models/PracticeArenaAttempt');
const { ensureSubmissionAvailable } = require('../src/services/submissionLockService');
const { awardPointsOnce, hasPointsAward } = require('../src/services/pointsService');
const { REVIEWED_SOLUTION_FILTER, purgeReviewedSolutions } = require('../src/services/submissionRetentionService');

function replace(target, key, value) {
  const original = target[key];
  target[key] = value;
  return () => { target[key] = original; };
}

function queryResult(value) {
  return { select: () => ({ lean: async () => value }) };
}

test('attempt schemas keep purge metadata and allow Arena code to be absent', () => {
  assert.ok(PracticalAttempt.schema.path('solutionPurgedAt'));
  assert.ok(PracticeArenaAttempt.schema.path('solutionPurgedAt'));
  const submittedCode = PracticeArenaAttempt.schema.path('submittedCode');
  assert.equal(submittedCode.options.required, undefined);
  assert.equal(submittedCode.defaultValue, '');
  assert.ok(PracticalAttempt.schema.path('reviewStatus').enumValues.includes('superseded'));
  assert.ok(PracticeArenaAttempt.schema.path('reviewStatus').enumValues.includes('superseded'));
});

test('retention filter purges completed, reviewed, superseded, and legacy non-review submissions', () => {
  assert.ok(REVIEWED_SOLUTION_FILTER.$or.some((filter) => filter.completedAt?.$ne === null));
  assert.deepEqual(REVIEWED_SOLUTION_FILTER.$or.find((filter) => filter.reviewStatus)?.reviewStatus.$in, ['approved', 'rejected', 'superseded', 'not-required']);
  assert.deepEqual(REVIEWED_SOLUTION_FILTER.submittedCode, { $exists: true, $type: 'string', $ne: '' });
});

test('retention cleanup unsets submittedCode in both attempt collections', async () => {
  const restorePractical = replace(PracticalAttempt, 'updateMany', async (filter, update) => {
    assert.equal(filter, REVIEWED_SOLUTION_FILTER);
    assert.equal(update.$unset.submittedCode, 1);
    assert.ok(update.$set.solutionPurgedAt instanceof Date);
    return { modifiedCount: 2 };
  });
  const restoreArena = replace(PracticeArenaAttempt, 'updateMany', async (filter, update) => {
    assert.equal(filter, REVIEWED_SOLUTION_FILTER);
    assert.equal(update.$unset.submittedCode, 1);
    assert.ok(update.$set.solutionPurgedAt instanceof Date);
    return { modifiedCount: 3 };
  });
  try {
    assert.deepEqual(await purgeReviewedSolutions(), { practicals: 2, arena: 3, total: 5 });
  } finally {
    restorePractical();
    restoreArena();
  }
});

test('submission lock blocks an already awarded item in both student workflows', async () => {
  const originalExists = User.exists;
  const queryLog = [];
  User.exists = async (filter) => {
    queryLog.push(filter);
    return filter.pointAwardKeys === 'practical:task-1' || filter.pointAwardKeys === 'practice-arena:challenge-1';
  };
  const AttemptModel = { exists: async () => false };
  try {
    await assert.rejects(
      ensureSubmissionAvailable({ AttemptModel, studentId: 'student-1', itemFilter: { practicalId: 'task-1' }, awardKey: 'practical:task-1', itemLabel: 'practical' }),
      (error) => error.status === 409 && /locked/i.test(error.message),
    );
    await assert.rejects(
      ensureSubmissionAvailable({ AttemptModel, studentId: 'student-1', itemFilter: { challengeId: 'challenge-1' }, awardKey: 'practice-arena:challenge-1', itemLabel: 'challenge' }),
      (error) => error.status === 409 && /locked/i.test(error.message),
    );
    assert.deepEqual(queryLog.map((item) => item.pointAwardKeys), ['practical:task-1', 'practice-arena:challenge-1']);
  } finally {
    User.exists = originalExists;
  }
});

test('a completed attempt also locks submission even if its award key is missing', async () => {
  const originalExists = User.exists;
  User.exists = async () => false;
  const AttemptModel = { exists: async (filter) => Boolean(filter.completedAt) };
  try {
    await assert.rejects(
      ensureSubmissionAvailable({ AttemptModel, studentId: 'student-1', itemFilter: { practicalId: 'task-1' }, awardKey: 'practical:task-1', itemLabel: 'practical' }),
      (error) => error.status === 409 && /locked/i.test(error.message),
    );
  } finally {
    User.exists = originalExists;
  }
});

test('only one submission may wait for review, while a rejected item can be resubmitted', async () => {
  const originalExists = User.exists;
  User.exists = async () => false;
  const pendingModel = { exists: async (filter) => filter.reviewStatus === 'pending' };
  const openModel = { exists: async () => false };
  try {
    await assert.rejects(
      ensureSubmissionAvailable({ AttemptModel: pendingModel, studentId: 'student-1', itemFilter: { challengeId: 'challenge-1' }, awardKey: 'practice-arena:challenge-1', itemLabel: 'challenge' }),
      (error) => error.status === 409 && /awaiting review/i.test(error.message),
    );
    await assert.doesNotReject(
      ensureSubmissionAvailable({ AttemptModel: openModel, studentId: 'student-1', itemFilter: { challengeId: 'challenge-1' }, awardKey: 'practice-arena:challenge-1', itemLabel: 'challenge' }),
    );
  } finally {
    User.exists = originalExists;
  }
});

test('point awards are atomic and do not increment twice for the same item', async () => {
  const originalUpdate = User.findOneAndUpdate;
  const originalFindById = User.findById;
  const keys = new Set();
  let totalPoints = 40;
  User.findOneAndUpdate = (filter, update, options) => {
    assert.equal(filter.pointAwardKeys.$ne, 'practical:task-1');
    assert.deepEqual(update.$addToSet, { pointAwardKeys: 'practical:task-1' });
    assert.deepEqual(update.$inc, { totalPoints: 20 });
    assert.equal(options.new, true);
    if (keys.has('practical:task-1')) return queryResult(null);
    keys.add('practical:task-1');
    totalPoints += 20;
    return queryResult({ totalPoints });
  };
  User.findById = () => queryResult({ totalPoints });
  try {
    assert.deepEqual(await awardPointsOnce({ studentId: 'student-1', awardKey: 'practical:task-1', points: 20 }), {
      awarded: true, pointsAwarded: 20, totalPoints: 60,
    });
    assert.deepEqual(await awardPointsOnce({ studentId: 'student-1', awardKey: 'practical:task-1', points: 20 }), {
      awarded: false, pointsAwarded: 0, totalPoints: 60,
    });
  } finally {
    User.findOneAndUpdate = originalUpdate;
    User.findById = originalFindById;
  }
});

test('point-award existence check identifies a previously completed item', async () => {
  const originalExists = User.exists;
  let seen;
  User.exists = async (filter) => { seen = filter; return { _id: 'student-1' }; };
  try {
    assert.equal(await hasPointsAward({ studentId: 'student-1', awardKey: 'practical:task-1' }), true);
    assert.deepEqual(seen, { _id: 'student-1', role: 'student', pointAwardKeys: 'practical:task-1' });
  } finally {
    User.exists = originalExists;
  }
});

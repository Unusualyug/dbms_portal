const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeReviewDecision, buildReviewFields, MAX_FEEDBACK_LENGTH } = require('../src/services/submissionReviewService');

test('manual review requires an explicit approve or reject decision', () => {
  assert.throws(() => normalizeReviewDecision({ decision: 'maybe' }), /approve or reject/i);
});

test('rejecting a submission requires useful student feedback', () => {
  assert.throws(() => normalizeReviewDecision({ decision: 'reject', feedback: '   ' }), /feedback/i);
  assert.deepEqual(normalizeReviewDecision({ decision: 'reject', feedback: '  Fix the join condition.  ' }), {
    decision: 'reject',
    feedback: 'Fix the join condition.',
  });
});

test('review feedback is trimmed and bounded', () => {
  const result = normalizeReviewDecision({ decision: 'approve', feedback: ` ${'x'.repeat(MAX_FEEDBACK_LENGTH + 40)} ` });
  assert.equal(result.feedback.length, MAX_FEEDBACK_LENGTH);
});

test('approval completes the submission and prepares a one-time point award', () => {
  const reviewedAt = new Date('2026-10-19T00:00:00Z');
  const fields = buildReviewFields({ decision: 'approve', feedback: 'Good work.', reviewerId: 'admin-id', reviewedAt });
  assert.equal(fields.reviewStatus, 'approved');
  assert.equal(fields.isCorrect, true);
  assert.equal(fields.completedAt, reviewedAt);
  assert.equal(fields.reviewedBy, 'admin-id');
  assert.equal(fields.pointsAwarded, 0);
});

test('rejection leaves the submission incomplete and does not award points', () => {
  const reviewedAt = new Date('2026-10-19T00:00:00Z');
  const fields = buildReviewFields({ decision: 'reject', feedback: 'Please fix the syntax.', reviewerId: 'admin-id', reviewedAt });
  assert.equal(fields.reviewStatus, 'rejected');
  assert.equal(fields.isCorrect, false);
  assert.equal(fields.completedAt, null);
  assert.equal(fields.pointsAwarded, 0);
});

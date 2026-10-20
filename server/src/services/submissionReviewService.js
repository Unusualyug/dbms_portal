const MAX_FEEDBACK_LENGTH = 1000;

function normalizeReviewDecision({ decision, feedback }) {
  if (!['approve', 'reject'].includes(decision)) {
    throw new TypeError('Choose whether to approve or reject this submission.');
  }
  if (feedback !== undefined && feedback !== null && typeof feedback !== 'string') {
    throw new TypeError('Review feedback must be text.');
  }
  const normalizedFeedback = String(feedback || '').trim().slice(0, MAX_FEEDBACK_LENGTH);
  if (decision === 'reject' && !normalizedFeedback) {
    throw new TypeError('Add feedback explaining what the student should correct before rejecting.');
  }
  return { decision, feedback: normalizedFeedback };
}

function buildReviewFields({ decision, feedback, reviewerId, reviewedAt = new Date() }) {
  const approved = decision === 'approve';
  return {
    reviewStatus: approved ? 'approved' : 'rejected',
    reviewFeedback: feedback,
    reviewedBy: reviewerId,
    reviewedAt,
    isCorrect: approved,
    completedAt: approved ? reviewedAt : null,
    pointsAwarded: 0,
  };
}

module.exports = { MAX_FEEDBACK_LENGTH, normalizeReviewDecision, buildReviewFields };

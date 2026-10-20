const mongoose = require('mongoose');

const practiceArenaAttemptSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  challengeId: { type: String, required: true, trim: true, maxlength: 100 },
  attemptNumber: { type: Number, required: true, min: 1 },
  submittedCode: { type: String, maxlength: 20000, default: '' },
  executionMode: { type: String, enum: ['oracle-sandbox', 'preflight-only', 'submission-only'], required: true },
  syntaxStatus: { type: String, enum: ['passed', 'failed', 'not-run'], default: 'not-run' },
  validationEngine: { type: String, maxlength: 100, default: 'not-configured' },
  validationNote: { type: String, maxlength: 1000, default: '' },
  expectedResultStatus: { type: String, enum: ['passed', 'failed', 'not-run'], default: 'not-run' },
  databaseStateStatus: { type: String, enum: ['passed', 'failed', 'not-run'], default: 'not-run' },
  isCorrect: { type: Boolean, default: null },
  reviewStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'superseded', 'not-required'], default: 'not-required', index: true },
  reviewFeedback: { type: String, maxlength: 1000, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  solutionPurgedAt: { type: Date, default: null },
  output: { type: String, maxlength: 12000, default: '' },
  expectedOutput: { type: String, maxlength: 6000, default: '' },
  error: { type: String, maxlength: 6000, default: '' },
  executionTimeMs: { type: Number, default: null, min: 0 },
  pointsAwarded: { type: Number, default: 0, min: 0 },
  submittedAt: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

practiceArenaAttemptSchema.index({ studentId: 1, challengeId: 1, attemptNumber: 1 }, { unique: true });
practiceArenaAttemptSchema.index({ studentId: 1, challengeId: 1, submittedAt: -1 });
practiceArenaAttemptSchema.index({ studentId: 1, submittedAt: -1 });
practiceArenaAttemptSchema.index({ reviewStatus: 1, submittedAt: 1 });

module.exports = mongoose.model('PracticeArenaAttempt', practiceArenaAttemptSchema);

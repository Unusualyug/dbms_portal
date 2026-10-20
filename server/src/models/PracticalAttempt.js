const mongoose = require('mongoose');

const practicalAttemptSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
  practicalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Practical', required: true, index: true },
  sessionId: { type: String, index: true },
  attemptNumber: { type: Number, required: true },
  submittedCode: { type: String, maxlength: 20000, default: '' },
  executionMode: { type: String, enum: ['oracle-sandbox', 'mysql-sandbox', 'preflight-only', 'judge0', 'submission-only'], default: 'preflight-only' },
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
  pointsAwarded: { type: Number, default: 0, min: 0 },
  output: { type: String, maxlength: 12000, default: '' },
  expectedOutput: { type: String, maxlength: 6000, default: '' },
  error: { type: String, maxlength: 6000, default: '' },
  executionTimeMs: { type: Number, default: null },
  timeSpentSec: { type: Number, default: 0, min: 0 },
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });
practicalAttemptSchema.index({ studentId: 1, practicalId: 1, attemptNumber: 1 }, { unique: true });
practicalAttemptSchema.index({ studentId: 1, submittedAt: -1 });
practicalAttemptSchema.index({ reviewStatus: 1, submittedAt: 1 });

module.exports = mongoose.model('PracticalAttempt', practicalAttemptSchema);

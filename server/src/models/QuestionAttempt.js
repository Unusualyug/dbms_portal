const mongoose = require('mongoose');

const questionAttemptSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', index: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
  sessionId: { type: String, index: true },
  attemptNumber: { type: Number, required: true },
  selectedAnswer: { type: mongoose.Schema.Types.Mixed, default: null },
  isCorrect: { type: Boolean, default: null },
  status: { type: String, enum: ['in_progress', 'submitted', 'abandoned'], default: 'in_progress' },
  startedAt: { type: Date, default: Date.now },
  lastHeartbeatAt: { type: Date, default: Date.now },
  submittedAt: { type: Date, default: null },
  timeSpentSec: { type: Number, default: 0, min: 0 },
}, { timestamps: true, versionKey: false });
questionAttemptSchema.index({ studentId: 1, questionId: 1, attemptNumber: 1 }, { unique: true });
questionAttemptSchema.index({ studentId: 1, submittedAt: -1 });

module.exports = mongoose.model('QuestionAttempt', questionAttemptSchema);

const mongoose = require('mongoose');

const learningTimerSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  scopeType: { type: String, enum: ['course', 'module', 'topic', 'question', 'practical'], required: true },
  scopeKey: { type: String, required: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', index: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', index: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', index: true },
  practicalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Practical', index: true },
  lastHeartbeatAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });
learningTimerSchema.index({ studentId: 1, sessionId: 1, scopeType: 1, scopeKey: 1, isActive: 1 });

module.exports = mongoose.model('LearningTimer', learningTimerSchema);

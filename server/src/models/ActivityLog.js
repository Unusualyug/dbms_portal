const mongoose = require('mongoose');

const EVENTS = [
  'LOGIN', 'LOGOUT', 'MODULE_OPENED', 'TOPIC_OPENED', 'TOPIC_COMPLETED',
  'QUESTION_OPENED', 'QUESTION_STARTED', 'QUESTION_SUBMITTED',
  'PRACTICAL_OPENED', 'PRACTICAL_RUN', 'PRACTICAL_SUBMITTED', 'PRACTICAL_COMPLETED',
  'VIDEO_STARTED', 'VIDEO_COMPLETED', 'SESSION_STARTED', 'SESSION_ENDED', 'HEARTBEAT',
];

const activityLogSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  eventType: { type: String, enum: EVENTS, required: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', index: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', index: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', index: true },
  practicalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Practical', index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  sessionId: { type: String, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { versionKey: false });
activityLogSchema.index({ eventType: 1, timestamp: -1 });
activityLogSchema.index({ studentId: 1, timestamp: -1 });
activityLogSchema.index({ moduleId: 1, topicId: 1, eventType: 1 });

activityLogSchema.statics.EVENTS = EVENTS;
module.exports = mongoose.model('ActivityLog', activityLogSchema);

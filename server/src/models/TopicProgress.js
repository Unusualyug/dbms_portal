const mongoose = require('mongoose');

const topicProgressSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },
  openedCount: { type: Number, default: 0 },
  firstOpenedAt: { type: Date, default: null },
  lastOpenedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  timeSpentSec: { type: Number, default: 0 },
}, { timestamps: true, versionKey: false });
topicProgressSchema.index({ studentId: 1, topicId: 1 }, { unique: true });
topicProgressSchema.index({ moduleId: 1, completedAt: 1 });

module.exports = mongoose.model('TopicProgress', topicProgressSchema);

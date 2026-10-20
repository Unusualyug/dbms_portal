const mongoose = require('mongoose');

const learningTimeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  scopeType: { type: String, enum: ['course', 'module', 'topic', 'question', 'practical'], required: true },
  scopeKey: { type: String, required: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', index: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', index: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', index: true },
  practicalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Practical', index: true },
  dateKey: { type: String, required: true },
  activeSeconds: { type: Number, default: 0 },
}, { timestamps: true, versionKey: false });
learningTimeSchema.index({ studentId: 1, scopeType: 1, scopeKey: 1, dateKey: 1 }, { unique: true });
learningTimeSchema.index({ dateKey: 1, scopeType: 1 });

module.exports = mongoose.model('LearningTime', learningTimeSchema);

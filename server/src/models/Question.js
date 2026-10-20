const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', index: true },
  title: { type: String, required: true },
  prompt: { type: String, required: true },
  type: { type: String, enum: ['mcq', 'true_false', 'multiple_select', 'short_answer'], default: 'mcq' },
  options: [{ id: String, text: String }],
  correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true, select: false },
  explanation: { type: String, default: '' },
  sourceType: { type: String, enum: ['official', 'derived_practice'], default: 'derived_practice' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });
questionSchema.index({ moduleId: 1, isActive: 1 });

module.exports = mongoose.model('Question', questionSchema);

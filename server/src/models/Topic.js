const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
  order: { type: Number, required: true },
  title: { type: String, required: true },
  group: { type: String, required: true },
  explanation: { type: String, default: '' },
  importantPoints: [{ type: String }],
  example: { type: String, default: '' },
  analogy: { type: String, default: '' },
  animationKey: { type: String, default: 'concept' },
  sourcePages: [{ type: Number }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });
topicSchema.index({ moduleId: 1, order: 1 }, { unique: true });

module.exports = mongoose.model('Topic', topicSchema);

const mongoose = require('mongoose');

const moduleManualProgressSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
  moduleManualStatus: { type: String, enum: ['pending', 'completed'], default: 'pending', required: true },
  completedPracticals: { type: Number, default: 0, min: 0 },
  totalPracticals: { type: Number, default: 0, min: 0 },
  completedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

moduleManualProgressSchema.index({ studentId: 1, moduleId: 1 }, { unique: true });
moduleManualProgressSchema.index({ moduleId: 1, moduleManualStatus: 1 });

module.exports = mongoose.model('ModuleManualProgress', moduleManualProgressSchema);

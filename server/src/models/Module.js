const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
  courseCode: { type: String, required: true, index: true },
  moduleNumber: { type: Number, required: true },
  slug: { type: String, required: true },
  title: { type: String, required: true },
  hours: { type: Number, default: 0 },
  weightagePercent: { type: Number, default: 0 },
  sourcePages: [{ type: Number }],
  assessments: [{ title: String, marks: Number, description: String }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });
moduleSchema.index({ courseCode: 1, moduleNumber: 1 }, { unique: true });

module.exports = mongoose.model('Module', moduleSchema);

const mongoose = require('mongoose');

const practicalSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
  number: { type: Number, required: true },
  prompt: { type: String, required: true },
  sourcePage: { type: Number },
  sourceWordingUnclear: { type: Boolean, default: false },
  dialect: { type: String, enum: ['oracle', 'mysql-workbench'], default: 'oracle' },
  validationPolicy: { type: String, default: 'sandbox-required' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });
practicalSchema.index({ moduleId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model('Practical', practicalSchema);

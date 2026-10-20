const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['admin', 'student'], required: true },
  startedAt: { type: Date, default: Date.now },
  lastHeartbeatAt: { type: Date, default: Date.now, index: true },
  endedAt: { type: Date, default: null },
  activeSeconds: { type: Number, default: 0 },
  userAgent: { type: String, maxlength: 300, default: '' },
}, { timestamps: true, versionKey: false });
sessionSchema.index({ role: 1, endedAt: 1, lastHeartbeatAt: -1 });
sessionSchema.index({ studentId: 1, startedAt: -1 });

module.exports = mongoose.model('Session', sessionSchema);

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  studentId: { type: String, unique: true, sparse: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  semester: { type: Number, enum: [3, 5] },
  classSection: { type: String, enum: ['X1', 'X2', 'Y1', 'Y2'], trim: true },
  totalPoints: { type: Number, default: 0, min: 0 },
  pointAwardKeys: { type: [String], default: [], select: false },
  passwordHash: { type: String, required: true, select: false },
  authVersion: { type: Number, default: 0, min: 0 },
  passwordResetTokenHash: { type: String, select: false, default: undefined },
  passwordResetExpiresAt: { type: Date, select: false, default: undefined },
  role: { type: String, enum: ['admin', 'student'], default: 'student', required: true },
  profilePhotoUrl: { type: String, trim: true, maxlength: 2048, default: undefined },
  profilePhotoPublicId: { type: String, trim: true, maxlength: 255, select: false, default: undefined },
  lastLogin: { type: Date, default: null },
  lastActive: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });

userSchema.index({ role: 1 }, {
  unique: true,
  partialFilterExpression: { role: 'admin' },
  name: 'only_one_admin_account',
});
userSchema.index({ name: 'text', email: 'text', studentId: 'text' });
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true, name: 'password_reset_token_lookup' });

module.exports = mongoose.model('User', userSchema);

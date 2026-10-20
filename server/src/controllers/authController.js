const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const LearningTimer = require('../models/LearningTimer');
const HttpError = require('../utils/httpError');
const { authCookieOptions } = require('../utils/cookies');
const { recordActivity } = require('../services/activityService');
const { sendPasswordResetEmail } = require('../services/passwordResetEmailService');
const { syncModuleManualProgressForStudents } = require('../services/moduleManualProgressService');
const { registerSchema, loginSchema, profileUpdateSchema, passwordChangeSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validators/authSchemas');
const { FIXED_ADMIN_EMAIL } = require('../config/constants');

function makeStudentId() {
  return `GMIU-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}
function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
function disconnectStudentSockets(req, studentId) {
  const io = req.app?.get('io');
  if (io) io.in(`student:${String(studentId)}`).disconnectSockets(true);
}
function signToken(user, sessionId) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new HttpError(503, 'JWT_SECRET must contain at least 32 characters.');
  return jwt.sign({ sub: String(user._id), role: user.role, sid: sessionId, av: Number(user.authVersion || 0) }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '4h',
    issuer: 'dbms-learning-portal',
    audience: 'dbms-learning-portal-users',
  });
}
function sendAuth(res, user, sessionId) {
  const token = signToken(user, sessionId);
  res.cookie('access_token', token, authCookieOptions());
}
function userPayload(user) {
  return { id: String(user._id), studentId: user.studentId || null, name: user.name, email: user.email, role: user.role, semester: user.semester ?? null, classSection: user.classSection || null, totalPoints: user.totalPoints || 0, profilePhotoUrl: user.profilePhotoUrl || null, createdAt: user.createdAt, lastLogin: user.lastLogin };
}

async function createSession(user, req) {
  const sessionId = crypto.randomUUID();
  await Session.create({
    sessionId,
    studentId: user._id,
    role: user.role,
    startedAt: new Date(),
    lastHeartbeatAt: new Date(),
    userAgent: String(req.get('user-agent') || '').slice(0, 300),
  });
  return sessionId;
}

async function initializeStudentModuleManualProgress(user) {
  if (user?.role !== 'student') return;
  try {
    await syncModuleManualProgressForStudents([user._id]);
  } catch (error) {
    // A report/export or the next practical approval can reconcile it later.
    console.error('Could not initialize module manual progress:', error.message);
  }
}

async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Please check your name, email and password.', parsed.error.flatten());
  const { name, email, password, semester, classSection } = parsed.data;
  if (email === FIXED_ADMIN_EMAIL) throw new HttpError(409, 'That address is reserved for the seeded administrator.');
  if (await User.exists({ email })) throw new HttpError(409, 'An account already exists for that email.');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role: 'student', studentId: makeStudentId(), semester, classSection });
  const sessionId = await createSession(user, req);
  user.lastLogin = new Date();
  user.lastActive = new Date();
  await user.save();
  await initializeStudentModuleManualProgress(user);
  sendAuth(res, user, sessionId);
  req.user = user;
  req.sessionId = sessionId;
  await recordActivity({ req, eventType: 'SESSION_STARTED' });
  await recordActivity({ req, eventType: 'LOGIN' });
  res.status(201).json({ user: userPayload(user) });
}

async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Enter a valid email and password.');
  const { email, password } = parsed.data;
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  const sessionId = await createSession(user, req);
  user.lastLogin = new Date();
  user.lastActive = new Date();
  await user.save();
  await initializeStudentModuleManualProgress(user);
  sendAuth(res, user, sessionId);
  req.user = user;
  req.sessionId = sessionId;
  await recordActivity({ req, eventType: 'SESSION_STARTED' });
  await recordActivity({ req, eventType: 'LOGIN' });
  res.json({ user: userPayload(user) });
}

async function updateProfile(req, res) {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Enter a name between 2 and 100 characters.', parsed.error.flatten());
  const user = await User.findOneAndUpdate(
    { _id: req.user._id, role: 'student', isActive: true },
    { $set: { name: parsed.data.name } },
    { new: true, runValidators: true },
  ).select('studentId name email role semester classSection totalPoints profilePhotoUrl createdAt lastLogin').lean();
  if (!user) throw new HttpError(404, 'Student account not found.');
  res.json({ user: userPayload(user) });
}

async function changePassword(req, res) {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Use a new password with at least 12 characters.', parsed.error.flatten());
  const user = await User.findOne({ _id: req.user._id, role: 'student', isActive: true }).select('+passwordHash');
  if (!user) throw new HttpError(404, 'Student account not found.');
  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'Your current password is incorrect.');
  }
  if (await bcrypt.compare(parsed.data.newPassword, user.passwordHash)) {
    throw new HttpError(400, 'Choose a password different from your current password.');
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  const updatedUser = await User.findOneAndUpdate(
    { _id: user._id, role: 'student', isActive: true, passwordHash: user.passwordHash },
    { $set: { passwordHash }, $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 }, $inc: { authVersion: 1 } },
    { new: true },
  ).select('+passwordHash');
  if (!updatedUser) throw new HttpError(409, 'Your password changed during this request. Sign in again and retry.');
  await Promise.all([
    Session.deleteMany({ studentId: user._id }),
    LearningTimer.deleteMany({ studentId: user._id }),
  ]);
  const sessionId = await createSession(updatedUser, req);
  sendAuth(res, updatedUser, sessionId);
  res.on('finish', () => disconnectStudentSockets(req, user._id));
  res.json({ changed: true, message: 'Password updated. Other signed-in sessions were ended.' });
}

async function requestPasswordReset(req, res) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Enter a valid email address.');
  const responseMessage = 'If an active student account matches that email, a one-time password reset link will be sent.';
  const student = await User.findOne({ email: parsed.data.email, role: 'student', isActive: true }).select('name email');
  if (student) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await User.updateOne(
      { _id: student._id, role: 'student', isActive: true },
      { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } },
    );
    try {
      await sendPasswordResetEmail(student, token);
    } catch (error) {
      // Keep responses identical for existing and unknown addresses; never log the reset token.
      console.error('Password reset email delivery failed:', error.message);
      await User.updateOne(
        { _id: student._id, passwordResetTokenHash: tokenHash },
        { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } },
      ).catch(() => {});
    }
  }
  res.json({ message: responseMessage });
}

async function resetPassword(req, res) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'The reset link or new password is invalid. Use a password of at least 12 characters.');
  const tokenHash = hashResetToken(parsed.data.token);
  const criteria = {
    role: 'student',
    isActive: true,
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  };
  const student = await User.findOne(criteria).select('_id');
  if (!student) throw new HttpError(400, 'This reset link is invalid or expired. Request a new one.');
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  // Atomically consume the token, change the password, and advance authVersion so all prior JWTs are invalid.
  const updated = await User.findOneAndUpdate(
    { _id: student._id, role: 'student', isActive: true, passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: new Date() } },
    { $set: { passwordHash }, $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 }, $inc: { authVersion: 1 } },
    { new: true },
  ).select('_id');
  if (!updated) throw new HttpError(400, 'This reset link is invalid or expired. Request a new one.');
  await Promise.all([
    Session.deleteMany({ studentId: student._id }),
    LearningTimer.deleteMany({ studentId: student._id }),
  ]);
  res.clearCookie('access_token', { ...authCookieOptions(), maxAge: undefined });
  res.on('finish', () => disconnectStudentSockets(req, student._id));
  res.json({ reset: true, message: 'Password updated. Sign in with your new password.' });
}

async function me(req, res) {
  res.json({ user: userPayload(req.user) });
}

async function logout(req, res) {
  const now = new Date();
  if (req.sessionId) {
    await Session.updateOne({ sessionId: req.sessionId, studentId: req.user._id, endedAt: null }, { $set: { endedAt: now, lastHeartbeatAt: now } });
  }
  await recordActivity({ req, eventType: 'LOGOUT' });
  await recordActivity({ req, eventType: 'SESSION_ENDED' });
  res.clearCookie('access_token', { ...authCookieOptions(), maxAge: undefined });
  res.json({ ok: true });
}

module.exports = { register, login, updateProfile, changePassword, requestPasswordReset, resetPassword, me, logout, userPayload };

const { z } = require('zod');
const Session = require('../models/Session');
const User = require('../models/User');
const { recordActivity, touchUser } = require('../services/activityService');
const { startTimer, heartbeatTimer } = require('../services/timeTrackingService');
const HttpError = require('../utils/httpError');

const activitySchema = z.object({
  eventType: z.string(),
  moduleId: z.string().optional(),
  topicId: z.string().optional(),
  questionId: z.string().optional(),
  practicalId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
}).strict();

async function track(req, res) {
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Invalid activity event.');
  const data = parsed.data;
  const event = await recordActivity({ req, ...data });
  await touchUser(req.user._id);
  res.status(201).json({ ok: true, eventId: event._id });
}

async function pulse(req, res) {
  const now = new Date();
  if (req.sessionId) await Session.updateOne({ sessionId: req.sessionId, studentId: req.user._id, endedAt: null }, { $set: { lastHeartbeatAt: now } });
  await User.updateOne({ _id: req.user._id }, { $set: { lastActive: now } });
  const io = req.app.get('io');
  if (io && req.user.role === 'student') {
    const activeStudents = await Session.distinct('studentId', { role: 'student', endedAt: null, lastHeartbeatAt: { $gte: new Date(now.getTime() - 90000) } });
    io.to('admins').emit('admin:presence', { onlineCount: activeStudents.length, studentId: String(req.user._id), lastHeartbeatAt: now });
  }
  res.json({ ok: true, serverTime: now });
}

async function timerStart(req, res) {
  const schema = z.object({ scopeType: z.enum(['course', 'module', 'topic', 'question', 'practical']), scopeId: z.string().optional() }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Invalid timer scope.');
  const timer = await startTimer({ studentId: req.user._id, sessionId: req.sessionId, ...parsed.data });
  res.status(201).json({ timerId: timer._id, startedAt: timer.createdAt });
}

async function timerHeartbeat(req, res) {
  const schema = z.object({ timerId: z.string().min(1), stop: z.boolean().optional() }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Invalid timer heartbeat.');
  const result = await heartbeatTimer({ studentId: req.user._id, sessionId: req.sessionId, ...parsed.data });
  res.json({ ok: true, secondsAdded: result.secondsAdded, stopped: !result.timer.isActive });
}

module.exports = { track, pulse, timerStart, timerHeartbeat };

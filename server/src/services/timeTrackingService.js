const LearningTimer = require('../models/LearningTimer');
const LearningTime = require('../models/LearningTime');
const TopicProgress = require('../models/TopicProgress');
const HttpError = require('../utils/httpError');
const Module = require('../models/Module');
const Topic = require('../models/Topic');
const Practical = require('../models/Practical');

const MAX_HEARTBEAT_GAP_SEC = 45;
const VALID_SCOPES = ['course', 'module', 'topic', 'question', 'practical'];

async function resolveScope(scopeType, scopeId) {
  if (!VALID_SCOPES.includes(scopeType)) throw new HttpError(400, 'Unsupported time-tracking scope.');
  if (scopeType === 'course') return { scopeType, scopeKey: 'course' };
  if (!scopeId) throw new HttpError(400, 'A scope identifier is required.');
  let doc;
  let field;
  if (scopeType === 'module') { doc = await Module.findOne({ $or: [{ _id: scopeId }, { slug: scopeId }] }).select('_id'); field = 'moduleId'; }
  if (scopeType === 'topic') { doc = await Topic.findOne({ $or: [{ _id: scopeId }, { key: scopeId }] }).select('_id moduleId'); field = 'topicId'; }
  if (scopeType === 'question') { const Question = require('../models/Question'); doc = await Question.findOne({ $or: [{ _id: scopeId }, { key: scopeId }] }).select('_id moduleId topicId'); field = 'questionId'; }
  if (scopeType === 'practical') { doc = await Practical.findOne({ $or: [{ _id: scopeId }, { key: scopeId }] }).select('_id moduleId'); field = 'practicalId'; }
  if (!doc) throw new HttpError(404, 'Learning item not found.');
  const result = { scopeType, scopeKey: String(doc._id), moduleId: doc.moduleId };
  result[field] = doc._id;
  if (doc.topicId) result.topicId = doc.topicId;
  return result;
}

function dateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type) => parts.find((item) => item.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

async function addActiveSeconds({ timer, now = new Date(), stop = false }) {
  const last = timer.lastHeartbeatAt || timer.createdAt || now;
  const elapsed = Math.floor((now.getTime() - new Date(last).getTime()) / 1000);
  const seconds = elapsed > 0 && elapsed <= MAX_HEARTBEAT_GAP_SEC ? elapsed : 0;
  if (seconds > 0) {
    const scope = {
      studentId: timer.studentId,
      scopeType: timer.scopeType,
      scopeKey: timer.scopeKey,
      dateKey: dateKey(now),
    };
    for (const field of ['moduleId', 'topicId', 'questionId', 'practicalId']) if (timer[field]) scope[field] = timer[field];
    await LearningTime.findOneAndUpdate(scope, { $inc: { activeSeconds: seconds } }, { upsert: true, setDefaultsOnInsert: true });
    if (timer.scopeType === 'topic' && timer.topicId) {
      await TopicProgress.findOneAndUpdate(
        { studentId: timer.studentId, topicId: timer.topicId },
        { $set: { moduleId: timer.moduleId }, $inc: { timeSpentSec: seconds } },
        { upsert: true, setDefaultsOnInsert: true },
      );
    }
  }
  const updated = await LearningTimer.findByIdAndUpdate(timer._id, {
    $set: { lastHeartbeatAt: now, ...(stop ? { isActive: false } : {}) },
  }, { new: true });
  return { timer: updated, secondsAdded: seconds };
}

async function startTimer({ studentId, sessionId, scopeType, scopeId }) {
  const scope = await resolveScope(scopeType, scopeId);
  const active = await LearningTimer.findOne({ studentId, sessionId, scopeType, scopeKey: scope.scopeKey, isActive: true });
  if (active) return active;
  return LearningTimer.create({ studentId, sessionId, ...scope, lastHeartbeatAt: new Date(), isActive: true });
}

async function heartbeatTimer({ studentId, sessionId, timerId, stop = false }) {
  const timer = await LearningTimer.findOne({ _id: timerId, studentId, sessionId, isActive: true });
  if (!timer) throw new HttpError(404, 'Active learning timer not found.');
  return addActiveSeconds({ timer, stop });
}

async function closeSessionTimers({ studentId, sessionId }) {
  const timers = await LearningTimer.find({ studentId, sessionId, isActive: true });
  for (const timer of timers) await addActiveSeconds({ timer, stop: true });
}

module.exports = { startTimer, heartbeatTimer, closeSessionTimers, resolveScope, MAX_HEARTBEAT_GAP_SEC };

const ActivityLog = require('../models/ActivityLog');
const TopicProgress = require('../models/TopicProgress');
const User = require('../models/User');
const EVENTS = require('../utils/eventConstants');

const ALLOWED_METADATA_KEYS = new Set(['source', 'result', 'attemptNumber', 'section', 'scopeType', 'durationSec', 'note']);
function safeMetadata(input = {}) {
  const clean = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return clean;
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;
    if (typeof value === 'string') clean[key] = value.slice(0, 160);
    else if (typeof value === 'number' && Number.isFinite(value)) clean[key] = Math.max(0, Math.min(value, 10000000));
    else if (typeof value === 'boolean') clean[key] = value;
  }
  return clean;
}

async function recordActivity({ req, studentId, eventType, moduleId, topicId, questionId, practicalId, metadata = {} }) {
  if (!EVENTS[eventType]) throw new Error(`Unsupported activity event: ${eventType}`);
  const event = await ActivityLog.create({
    studentId: studentId || req.user._id,
    eventType,
    moduleId: moduleId || undefined,
    topicId: topicId || undefined,
    questionId: questionId || undefined,
    practicalId: practicalId || undefined,
    sessionId: req.sessionId || undefined,
    timestamp: new Date(),
    metadata: safeMetadata(metadata),
  });
  const io = req.app?.get('io');
  if (io) {
    io.to('admins').emit('admin:activity', {
      _id: event._id,
      eventType,
      studentId: String(studentId || req.user._id),
      timestamp: event.timestamp,
    });
  }
  return event;
}

async function incrementTopicOpened(studentId, topic) {
  await TopicProgress.findOneAndUpdate(
    { studentId, topicId: topic._id },
    {
      $set: { moduleId: topic.moduleId, lastOpenedAt: new Date() },
      $setOnInsert: { firstOpenedAt: new Date(), completedAt: null, timeSpentSec: 0 },
      $inc: { openedCount: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function touchUser(studentId) {
  await User.updateOne({ _id: studentId }, { $set: { lastActive: new Date() } });
}

module.exports = { recordActivity, incrementTopicOpened, touchUser, safeMetadata };

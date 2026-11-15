const { z } = require("zod");
const Session = require("../models/Session");
const User = require("../models/User");
const Module = require("../models/Module");
const Topic = require("../models/Topic");
const Question = require("../models/Question");
const Practical = require("../models/Practical");
const mongoose = require("mongoose");
const { courseFilter } = require("../services/courseScope");
const { recordActivity, touchUser } = require("../services/activityService");
const {
  startTimer,
  heartbeatTimer,
  closeCourseTimers,
} = require("../services/timeTrackingService");
const HttpError = require("../utils/httpError");

const activitySchema = z
  .object({
    eventType: z.string(),
    moduleId: z.string().optional(),
    topicId: z.string().optional(),
    questionId: z.string().optional(),
    practicalId: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict();

const CLIENT_ACTIVITY_REFERENCE = Object.freeze({
  MODULE_OPENED: "moduleId",
  TOPIC_OPENED: "topicId",
  QUESTION_OPENED: "questionId",
  QUESTION_STARTED: "questionId",
  PRACTICAL_OPENED: "practicalId",
  VIDEO_STARTED: "topicId",
  VIDEO_COMPLETED: "topicId",
});
const CONTENT_MODELS = Object.freeze({ Module, Topic, Question, Practical });

async function resolveClientActivityReferences(
  data,
  courseCode,
  models = CONTENT_MODELS,
) {
  const targetField = CLIENT_ACTIVITY_REFERENCE[data.eventType];
  if (!targetField)
    throw new HttpError(
      400,
      "This activity event can only be recorded by its authenticated server workflow.",
    );
  if (!data[targetField])
    throw new HttpError(
      400,
      `A ${targetField.replace("Id", "")} is required for this activity event.`,
    );

  const modelByField = {
    moduleId: models.Module,
    topicId: models.Topic,
    questionId: models.Question,
    practicalId: models.Practical,
  };
  const labelByField = {
    moduleId: "module",
    topicId: "topic",
    questionId: "question",
    practicalId: "practical",
  };
  const records = {};
  for (const field of Object.keys(modelByField)) {
    if (!data[field]) continue;
    if (!mongoose.isValidObjectId(data[field]))
      throw new HttpError(400, `Invalid ${labelByField[field]} reference.`);
    const record = await modelByField[field]
      .findOne(
        courseFilter(courseCode, {
          _id: data[field],
          isActive: { $ne: false },
        }),
      )
      .select("_id moduleId topicId");
    if (!record)
      throw new HttpError(
        400,
        `The ${labelByField[field]} does not belong to the selected subject.`,
      );
    records[field] = record;
  }

  const referencedModuleIds = [
    records.moduleId?._id,
    records.topicId?.moduleId,
    records.questionId?.moduleId,
    records.practicalId?.moduleId,
  ]
    .filter(Boolean)
    .map(String);
  if (new Set(referencedModuleIds).size > 1) {
    throw new HttpError(
      400,
      "The learning-item references do not belong to the same module.",
    );
  }
  const moduleId =
    records.moduleId?._id ||
    records.topicId?.moduleId ||
    records.questionId?.moduleId ||
    records.practicalId?.moduleId;
  if (
    records.topicId &&
    records.questionId &&
    String(records.topicId._id) !== String(records.questionId.topicId)
  ) {
    throw new HttpError(400, "The question and topic references do not match.");
  }
  return {
    moduleId,
    topicId: records.topicId?._id || records.questionId?.topicId,
    questionId: records.questionId?._id,
    practicalId: records.practicalId?._id,
  };
}

async function track(req, res) {
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid activity event.");
  const data = parsed.data;
  const references = await resolveClientActivityReferences(
    data,
    req.courseCode,
  );
  const event = await recordActivity({
    req,
    eventType: data.eventType,
    ...references,
    metadata: data.metadata,
  });
  await touchUser(req.user._id);
  res.status(201).json({ ok: true, eventId: event._id });
}

async function pulse(req, res) {
  const now = new Date();
  if (req.sessionId)
    await Session.updateOne(
      { sessionId: req.sessionId, studentId: req.user._id, endedAt: null },
      { $set: { lastHeartbeatAt: now } },
    );
  await User.updateOne({ _id: req.user._id }, { $set: { lastActive: now } });
  const io = req.app.get("io");
  if (io && req.user.role === "student") {
    const activeStudents = await Session.distinct("studentId", {
      role: "student",
      endedAt: null,
      lastHeartbeatAt: { $gte: new Date(now.getTime() - 90000) },
    });
    io.to("admins").emit("admin:presence", {
      onlineCount: activeStudents.length,
      studentId: String(req.user._id),
      lastHeartbeatAt: now,
    });
  }
  res.json({ ok: true, serverTime: now });
}

async function timerStart(req, res) {
  const schema = z
    .object({
      scopeType: z.enum(["course", "module", "topic", "question", "practical"]),
      scopeId: z.string().optional(),
    })
    .strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid timer scope.");
  const timer = await startTimer({
    studentId: req.user._id,
    sessionId: req.sessionId,
    courseCode: req.courseCode,
    ...parsed.data,
  });
  res.status(201).json({ timerId: timer._id, startedAt: timer.createdAt });
}

async function timerHeartbeat(req, res) {
  const schema = z
    .object({ timerId: z.string().min(1), stop: z.boolean().optional() })
    .strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid timer heartbeat.");
  const result = await heartbeatTimer({
    studentId: req.user._id,
    sessionId: req.sessionId,
    courseCode: req.courseCode,
    ...parsed.data,
  });
  res.json({
    ok: true,
    secondsAdded: result.secondsAdded,
    stopped: !result.timer.isActive,
  });
}

async function timerStopAll(req, res) {
  await closeCourseTimers({
    studentId: req.user._id,
    sessionId: req.sessionId,
    courseCode: req.courseCode,
  });
  res.json({ ok: true, stopped: true });
}

module.exports = {
  track,
  pulse,
  timerStart,
  timerHeartbeat,
  timerStopAll,
  resolveClientActivityReferences,
  CLIENT_ACTIVITY_REFERENCE,
};

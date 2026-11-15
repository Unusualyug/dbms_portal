const LearningTimer = require("../models/LearningTimer");
const LearningTime = require("../models/LearningTime");
const TopicProgress = require("../models/TopicProgress");
const HttpError = require("../utils/httpError");
const Module = require("../models/Module");
const Topic = require("../models/Topic");
const Practical = require("../models/Practical");
const Question = require("../models/Question");
const { COURSE_CODE, normalizeCourseCode } = require("../config/constants");
const { courseFilter } = require("./courseScope");

const MAX_HEARTBEAT_GAP_SEC = 45;
const VALID_SCOPES = ["course", "module", "topic", "question", "practical"];

async function resolveScope(
  scopeType,
  scopeId,
  requestedCourseCode = COURSE_CODE,
) {
  const courseCode = normalizeCourseCode(requestedCourseCode) || COURSE_CODE;
  if (!VALID_SCOPES.includes(scopeType))
    throw new HttpError(400, "Unsupported time-tracking scope.");
  if (scopeType === "course") {
    return {
      courseCode,
      scopeType,
      scopeKey: courseCode === COURSE_CODE ? "course" : `course:${courseCode}`,
    };
  }
  if (!scopeId) throw new HttpError(400, "A scope identifier is required.");
  let doc;
  let field;
  if (scopeType === "module") {
    const idOrSlug = mongooseIdOrSlug(scopeId);
    doc = await Module.findOne(
      courseFilter(courseCode, { ...idOrSlug, isActive: { $ne: false } }),
    ).select("_id courseCode");
    field = "moduleId";
  }
  if (scopeType === "topic") {
    doc = await Topic.findOne(
      courseFilter(courseCode, mongooseIdOrKey(scopeId)),
    ).select("_id moduleId courseCode");
    field = "topicId";
  }
  if (scopeType === "question") {
    doc = await Question.findOne(
      courseFilter(courseCode, mongooseIdOrKey(scopeId)),
    ).select("_id moduleId topicId courseCode");
    field = "questionId";
  }
  if (scopeType === "practical") {
    doc = await Practical.findOne(
      courseFilter(courseCode, mongooseIdOrKey(scopeId)),
    ).select("_id moduleId courseCode");
    field = "practicalId";
  }
  if (!doc) throw new HttpError(404, "Learning item not found.");
  const result = {
    courseCode,
    scopeType,
    scopeKey: String(doc._id),
    moduleId: doc.moduleId,
  };
  result[field] = doc._id;
  if (doc.topicId) result.topicId = doc.topicId;
  return result;
}

function mongooseIdOrSlug(value) {
  const mongoose = require("mongoose");
  return mongoose.isValidObjectId(value) ? { _id: value } : { slug: value };
}

function mongooseIdOrKey(value) {
  const mongoose = require("mongoose");
  return mongoose.isValidObjectId(value) ? { _id: value } : { key: value };
}

function dateKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((item) => item.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function addActiveSeconds({ timer, now = new Date(), stop = false }) {
  const courseCode = normalizeCourseCode(timer.courseCode) || COURSE_CODE;
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
    for (const field of ["moduleId", "topicId", "questionId", "practicalId"])
      if (timer[field]) scope[field] = timer[field];
    await LearningTime.findOneAndUpdate(
      courseFilter(courseCode, scope),
      {
        $setOnInsert: { ...scope, courseCode },
        $inc: { activeSeconds: seconds },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    if (timer.scopeType === "topic" && timer.topicId) {
      await TopicProgress.findOneAndUpdate(
        courseFilter(courseCode, {
          studentId: timer.studentId,
          topicId: timer.topicId,
        }),
        {
          $set: { courseCode, moduleId: timer.moduleId },
          $inc: { timeSpentSec: seconds },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
    }
  }
  const updated = await LearningTimer.findOneAndUpdate(
    courseFilter(courseCode, { _id: timer._id }),
    { $set: { lastHeartbeatAt: now, ...(stop ? { isActive: false } : {}) } },
    { new: true },
  );
  return { timer: updated, secondsAdded: seconds };
}

async function startTimer({
  studentId,
  sessionId,
  courseCode = COURSE_CODE,
  scopeType,
  scopeId,
}) {
  const scope = await resolveScope(scopeType, scopeId, courseCode);
  const active = await LearningTimer.findOne(
    courseFilter(scope.courseCode, {
      studentId,
      sessionId,
      scopeType,
      scopeKey: scope.scopeKey,
      isActive: true,
    }),
  );
  if (active) return active;
  return LearningTimer.create({
    studentId,
    sessionId,
    ...scope,
    lastHeartbeatAt: new Date(),
    isActive: true,
  });
}

async function heartbeatTimer({
  studentId,
  sessionId,
  courseCode = COURSE_CODE,
  timerId,
  stop = false,
}) {
  const timer = await LearningTimer.findOne(
    courseFilter(courseCode, {
      _id: timerId,
      studentId,
      sessionId,
      isActive: true,
    }),
  );
  if (!timer) throw new HttpError(404, "Active learning timer not found.");
  return addActiveSeconds({ timer, stop });
}

async function closeCourseTimers({
  studentId,
  sessionId,
  courseCode = COURSE_CODE,
}) {
  const timers = await LearningTimer.find(
    courseFilter(courseCode, { studentId, sessionId, isActive: true }),
  );
  for (const timer of timers) await addActiveSeconds({ timer, stop: true });
}

async function closeSessionTimers({ studentId, sessionId }) {
  // A shared login may visit both courses; end every timer owned by this session,
  // while each timer records its final seconds back to its own course.
  const timers = await LearningTimer.find({
    studentId,
    sessionId,
    isActive: true,
  });
  for (const timer of timers) await addActiveSeconds({ timer, stop: true });
}

module.exports = {
  startTimer,
  heartbeatTimer,
  closeCourseTimers,
  closeSessionTimers,
  resolveScope,
  MAX_HEARTBEAT_GAP_SEC,
};

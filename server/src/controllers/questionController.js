const mongoose = require('mongoose');
const Question = require('../models/Question');
const QuestionAttempt = require('../models/QuestionAttempt');
const LearningTime = require('../models/LearningTime');
const { recordActivity } = require('../services/activityService');
const HttpError = require('../utils/httpError');
const { POINT_VALUES, awardPointsOnce } = require('../services/pointsService');

async function addQuestionTime(attempt, seconds, now = new Date()) {
  if (!seconds || seconds <= 0) return;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type) => parts.find((item) => item.type === type).value;
  const dateKey = `${get('year')}-${get('month')}-${get('day')}`;
  await LearningTime.findOneAndUpdate(
    { studentId: attempt.studentId, scopeType: 'question', scopeKey: String(attempt.questionId), dateKey },
    { $setOnInsert: { moduleId: attempt.moduleId, topicId: attempt.topicId, questionId: attempt.questionId }, $inc: { activeSeconds: seconds } },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

async function findQuestion(id, includeAnswer = false) {
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { key: id };
  let q = Question.findOne({ ...query, isActive: true });
  if (includeAnswer) q = q.select('+correctAnswer');
  const question = await q;
  if (!question) throw new HttpError(404, 'Question not found.');
  return question;
}

async function listQuestions(req, res) {
  const filter = { isActive: true };
  if (req.query.moduleId) filter.moduleId = req.query.moduleId;
  const rows = await Question.find(filter).select('key moduleId topicId title prompt type options sourceType').populate('moduleId', 'moduleNumber title').populate('topicId', 'title key').sort({ moduleId: 1, createdAt: 1 }).lean();
  const attempts = await QuestionAttempt.find({ studentId: req.user._id, status: 'submitted' }).select('questionId isCorrect submittedAt timeSpentSec attemptNumber').sort({ submittedAt: -1 }).lean();
  const latest = new Map();
  for (const attempt of attempts) if (!latest.has(String(attempt.questionId))) latest.set(String(attempt.questionId), attempt);
  res.json({ questions: rows.map((question) => ({ ...question, lastAttempt: latest.get(String(question._id)) || null })) });
}

async function startQuestion(req, res) {
  const question = await findQuestion(req.params.questionId);
  await QuestionAttempt.updateMany({ studentId: req.user._id, questionId: question._id, sessionId: req.sessionId, status: 'in_progress' }, { $set: { status: 'abandoned' } });
  const attemptNumber = (await QuestionAttempt.countDocuments({ studentId: req.user._id, questionId: question._id })) + 1;
  const attempt = await QuestionAttempt.create({
    studentId: req.user._id,
    moduleId: question.moduleId,
    topicId: question.topicId,
    questionId: question._id,
    sessionId: req.sessionId,
    attemptNumber,
    startedAt: new Date(),
    lastHeartbeatAt: new Date(),
    status: 'in_progress',
  });
  await recordActivity({ req, eventType: 'QUESTION_OPENED', moduleId: question.moduleId, topicId: question.topicId, questionId: question._id });
  await recordActivity({ req, eventType: 'QUESTION_STARTED', moduleId: question.moduleId, topicId: question.topicId, questionId: question._id, metadata: { attemptNumber } });
  res.status(201).json({ attemptId: attempt._id, attemptNumber, startedAt: attempt.startedAt, question: {
    id: question._id, key: question.key, title: question.title, prompt: question.prompt, type: question.type, options: question.options, explanation: null,
  } });
}

async function questionHeartbeat(req, res) {
  const attempt = await QuestionAttempt.findOne({ _id: req.params.attemptId, studentId: req.user._id, status: 'in_progress' });
  if (!attempt) throw new HttpError(404, 'Active question attempt not found.');
  const now = new Date();
  const elapsed = Math.floor((now.getTime() - attempt.lastHeartbeatAt.getTime()) / 1000);
  const seconds = elapsed > 0 && elapsed <= 45 ? elapsed : 0;
  attempt.timeSpentSec += seconds;
  attempt.lastHeartbeatAt = now;
  await attempt.save();
  await addQuestionTime(attempt, seconds, now);
  res.json({ ok: true, timeSpentSec: attempt.timeSpentSec });
}

function answerEquals(expected, selected) {
  if (Array.isArray(expected) && Array.isArray(selected)) return [...expected].sort().join('|') === [...selected].sort().join('|');
  if (expected === null || expected === undefined || selected === null || selected === undefined) return false;
  return String(expected).trim().toLowerCase() === String(selected).trim().toLowerCase();
}

async function submitQuestion(req, res) {
  const attempt = await QuestionAttempt.findOne({ _id: req.params.attemptId, studentId: req.user._id, status: 'in_progress' });
  if (!attempt) throw new HttpError(404, 'Active question attempt not found.');
  const question = await findQuestion(attempt.questionId, true);
  const selectedAnswer = req.body?.selectedAnswer;
  if (selectedAnswer === undefined || selectedAnswer === null || (Array.isArray(selectedAnswer) && selectedAnswer.length === 0)) {
    throw new HttpError(400, 'Select an answer before submitting.');
  }
  const now = new Date();
  const finalGap = Math.floor((now.getTime() - attempt.lastHeartbeatAt.getTime()) / 1000);
  const finalSeconds = finalGap > 0 && finalGap <= 45 ? finalGap : 0;
  attempt.timeSpentSec += finalSeconds;
  const isCorrect = answerEquals(question.correctAnswer, selectedAnswer);
  attempt.selectedAnswer = selectedAnswer;
  attempt.isCorrect = isCorrect;
  attempt.status = 'submitted';
  attempt.submittedAt = now;
  attempt.lastHeartbeatAt = now;
  await attempt.save();
  await addQuestionTime(attempt, finalSeconds, now);
  const pointAward = isCorrect && question.type === 'mcq'
    ? await awardPointsOnce({ studentId: req.user._id, awardKey: `mcq:${question._id}`, points: POINT_VALUES.mcq })
    : { awarded: false, pointsAwarded: 0, totalPoints: req.user.totalPoints || 0 };
  await recordActivity({ req, eventType: 'QUESTION_SUBMITTED', moduleId: attempt.moduleId, topicId: attempt.topicId, questionId: attempt.questionId, metadata: { attemptNumber: attempt.attemptNumber, result: isCorrect ? 'correct' : 'incorrect', durationSec: attempt.timeSpentSec, pointsAwarded: pointAward.pointsAwarded } });
  res.json({
    attemptId: attempt._id,
    attemptNumber: attempt.attemptNumber,
    selectedAnswer,
    correctAnswer: question.correctAnswer,
    isCorrect,
    timeSpentSec: attempt.timeSpentSec,
    explanation: question.explanation,
    submittedAt: attempt.submittedAt,
    pointsAwarded: pointAward.pointsAwarded,
    pointsAlreadyEarned: isCorrect && question.type === 'mcq' && !pointAward.awarded,
    totalPoints: pointAward.totalPoints,
  });
}

module.exports = { listQuestions, startQuestion, questionHeartbeat, submitQuestion, findQuestion };

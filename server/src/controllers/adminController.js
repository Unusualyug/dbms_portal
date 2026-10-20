const mongoose = require('mongoose');
const User = require('../models/User');
const Module = require('../models/Module');
const Topic = require('../models/Topic');
const Practical = require('../models/Practical');
const Question = require('../models/Question');
const TopicProgress = require('../models/TopicProgress');
const QuestionAttempt = require('../models/QuestionAttempt');
const PracticalAttempt = require('../models/PracticalAttempt');
const ActivityLog = require('../models/ActivityLog');
const LearningTime = require('../models/LearningTime');
const Session = require('../models/Session');
const { COURSE_CODE } = require('../config/constants');
const { COURSE_CONTENT } = require('../config/constants');
const HttpError = require('../utils/httpError');
const { sendStudentReportEmail } = require('../services/studentReportEmailService');
const { syncModuleManualProgressForStudents } = require('../services/moduleManualProgressService');
const { deleteStudentData } = require('../services/studentDataDeletionService');
const { deleteStudentPhoto } = require('../services/profilePhotoService');

const ONLINE_SECONDS = Math.max(30, Number(process.env.ONLINE_THRESHOLD_SECONDS) || 90);
const ONLINE_CUTOFF = () => new Date(Date.now() - ONLINE_SECONDS * 1000);
function pageParams(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
function indiaDayStart(daysAgo = 0) {
  const date = new Date(Date.now() - daysAgo * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type) => parts.find((item) => item.type === type).value;
  const key = `${get('year')}-${get('month')}-${get('day')}`;
  return new Date(`${key}T00:00:00+05:30`);
}
function indiaDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type) => parts.find((item) => item.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function escapedRegex(input) { return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function dashboard(req, res) {
  const modules = await Module.find({ courseCode: COURSE_CODE, isActive: true }).sort({ moduleNumber: 1 }).lean();
  const moduleIds = modules.map((m) => m._id);
  const todayStart = indiaDayStart(0);
  const cutoff = ONLINE_CUTOFF();
  const [
    totalStudents, activeToday, onlineSessions, totalTopics, openedTopics, completedTopics,
    totalQuestions, questionAttempts, questionCorrect, practicalsTotal, practicalRuns,
    practicalCompleted, timeRows, moduleTopicCounts, topicCompletedByModule,
    recentActivity, dailyActive, dailyLearningTime, avgQuestion,
  ] = await Promise.all([
    User.countDocuments({ role: 'student', isActive: true }),
    User.countDocuments({ role: 'student', isActive: true, lastActive: { $gte: todayStart } }),
    Session.aggregate([
      { $match: { role: 'student', endedAt: null, lastHeartbeatAt: { $gte: cutoff } } },
      { $sort: { lastHeartbeatAt: -1 } },
      { $group: { _id: '$studentId', lastHeartbeatAt: { $first: '$lastHeartbeatAt' } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'student' } },
      { $unwind: '$student' },
      { $project: { _id: 1, lastHeartbeatAt: 1, name: '$student.name', email: '$student.email', studentId: '$student.studentId' } },
    ]),
    Topic.countDocuments({ moduleId: { $in: moduleIds }, isActive: true }),
    ActivityLog.countDocuments({ eventType: 'TOPIC_OPENED' }),
    TopicProgress.countDocuments({ moduleId: { $in: moduleIds }, completedAt: { $ne: null } }),
    Question.countDocuments({ moduleId: { $in: moduleIds }, isActive: true }),
    QuestionAttempt.countDocuments({ status: 'submitted' }),
    QuestionAttempt.countDocuments({ status: 'submitted', isCorrect: true }),
    Practical.countDocuments({ moduleId: { $in: moduleIds }, isActive: true }),
    PracticalAttempt.countDocuments({ moduleId: { $in: moduleIds } }),
    PracticalAttempt.countDocuments({ moduleId: { $in: moduleIds }, completedAt: { $ne: null } }),
    LearningTime.aggregate([{ $group: { _id: null, seconds: { $sum: '$activeSeconds' } } }]),
    Topic.aggregate([{ $match: { moduleId: { $in: moduleIds }, isActive: true } }, { $group: { _id: '$moduleId', total: { $sum: 1 } } }]),
    TopicProgress.aggregate([{ $match: { moduleId: { $in: moduleIds }, completedAt: { $ne: null } } }, { $group: { _id: '$moduleId', count: { $sum: 1 } } }]),
    ActivityLog.find({}).sort({ timestamp: -1 }).limit(12).populate('studentId', 'name studentId').populate('moduleId', 'moduleNumber title').populate('topicId', 'title').populate('questionId', 'title').populate('practicalId', 'number').lean(),
    ActivityLog.aggregate([
      { $match: { timestamp: { $gte: indiaDayStart(6) }, studentId: { $exists: true } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } }, students: { $addToSet: '$studentId' } } },
      { $project: { date: '$_id', activeStudents: { $size: '$students' } } }, { $sort: { date: 1 } },
    ]),
    LearningTime.aggregate([{ $match: { dateKey: { $gte: indiaDateKey(indiaDayStart(6)) } } }, { $group: { _id: '$dateKey', seconds: { $sum: '$activeSeconds' } } }, { $sort: { _id: 1 } }]),
    QuestionAttempt.aggregate([{ $match: { status: 'submitted' } }, { $group: { _id: null, avgSec: { $avg: '$timeSpentSec' } } }]),
  ]);
  const onlineStudents = onlineSessions.map((session) => ({ id: session._id, name: session.name, studentId: session.studentId, email: session.email, lastHeartbeatAt: session.lastHeartbeatAt }));
  const topicCountMap = new Map(moduleTopicCounts.map((row) => [String(row._id), row.total]));
  const completedCountMap = new Map(topicCompletedByModule.map((row) => [String(row._id), row.count]));
  const moduleProgress = modules.map((module) => {
    const total = topicCountMap.get(String(module._id)) || 0;
    const completed = completedCountMap.get(String(module._id)) || 0;
    return { moduleNumber: module.moduleNumber, title: module.title, percent: total ? Math.round((completed / total) * 100) : 0, completed, total };
  });
  const activityDays = new Map(dailyActive.map((row) => [row.date, row.activeStudents]));
  const timeDays = new Map(dailyLearningTime.map((row) => [row._id, row.seconds]));
  const daily = Array.from({ length: 7 }, (_, i) => {
    const day = indiaDayStart(6 - i);
    const key = indiaDateKey(day);
    return { date: key, activeStudents: activityDays.get(key) || 0, learningMinutes: Math.round((timeDays.get(key) || 0) / 60) };
  });
  const accuracy = questionAttempts ? Math.round((questionCorrect / questionAttempts) * 1000) / 10 : 0;
  res.json({
    stats: {
      totalStudents,
      currentlyOnline: onlineStudents.length,
      activeToday,
      totalTopics,
      topicsOpened: openedTopics,
      topicCompletions: completedTopics,
      totalQuestions,
      questionsAttempted: questionAttempts,
      correctAnswers: questionCorrect,
      incorrectAnswers: questionAttempts - questionCorrect,
      accuracy,
      practicalsTotal,
      practicalRuns,
      practicalsCompleted: practicalCompleted,
      totalLearningTimeSec: timeRows[0]?.seconds || 0,
      averageQuestionTimeSec: Math.round(avgQuestion[0]?.avgSec || 0),
    },
    moduleProgress,
    daily,
    onlineStudents,
    recentActivity: recentActivity.map(formatActivity),
  });
}

function formatActivity(event) {
  return {
    id: event._id,
    eventType: event.eventType,
    timestamp: event.timestamp,
    student: event.studentId ? { id: event.studentId._id, name: event.studentId.name, studentId: event.studentId.studentId } : null,
    module: event.moduleId ? { number: event.moduleId.moduleNumber, title: event.moduleId.title } : null,
    topic: event.topicId?.title || null,
    question: event.questionId?.title || null,
    practicalNumber: event.practicalId?.number || null,
    metadata: event.metadata || {},
  };
}

async function students(req, res) {
  const { page, limit, skip } = pageParams(req.query);
  const filter = { role: 'student' };
  if (req.query.q) {
    const re = new RegExp(escapedRegex(req.query.q.trim().slice(0, 100)), 'i');
    filter.$or = [{ name: re }, { email: re }, { studentId: re }];
  }
  if (req.query.status === 'online') filter._id = { $in: await Session.distinct('studentId', { role: 'student', endedAt: null, lastHeartbeatAt: { $gte: ONLINE_CUTOFF() } }) };
  if (req.query.status === 'offline') filter._id = { $nin: await Session.distinct('studentId', { role: 'student', endedAt: null, lastHeartbeatAt: { $gte: ONLINE_CUTOFF() } }) };
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }
  const [total, rows] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).select('studentId name email semester classSection totalPoints createdAt lastLogin lastActive isActive profilePhotoUrl').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);
  const ids = rows.map((user) => user._id);
  const [topicStats, questionStats, practicalStats, timeStats, onlineIds] = await Promise.all([
    TopicProgress.aggregate([{ $match: { studentId: { $in: ids } } }, { $group: { _id: '$studentId', opened: { $sum: '$openedCount' }, completed: { $sum: { $cond: [{ $ne: ['$completedAt', null] }, 1, 0] } } } }]),
    QuestionAttempt.aggregate([{ $match: { studentId: { $in: ids }, status: 'submitted' } }, { $group: { _id: '$studentId', attempted: { $sum: 1 }, correct: { $sum: { $cond: ['$isCorrect', 1, 0] } } } }]),
    PracticalAttempt.aggregate([{ $match: { studentId: { $in: ids } } }, { $group: { _id: '$studentId', attempted: { $addToSet: '$practicalId' }, completed: { $addToSet: { $cond: [{ $ne: ['$completedAt', null] }, '$practicalId', null] } } } }]),
    LearningTime.aggregate([{ $match: { studentId: { $in: ids } } }, { $group: { _id: '$studentId', seconds: { $sum: '$activeSeconds' } } }]),
    Session.distinct('studentId', { studentId: { $in: ids }, role: 'student', endedAt: null, lastHeartbeatAt: { $gte: ONLINE_CUTOFF() } }),
  ]);
  const mapBy = (list) => new Map(list.map((item) => [String(item._id), item]));
  const topicsMap = mapBy(topicStats); const questionsMap = mapBy(questionStats); const practicalsMap = mapBy(practicalStats); const timesMap = mapBy(timeStats);
  const onlineSet = new Set(onlineIds.map(String));
  res.json({
    students: rows.map((user) => {
      const topic = topicsMap.get(String(user._id)) || {};
      const question = questionsMap.get(String(user._id)) || {};
      const practical = practicalsMap.get(String(user._id)) || {};
      const time = timesMap.get(String(user._id)) || {};
      const completedPracticalIds = new Set((practical.completed || []).filter(Boolean).map(String));
      return {
        ...user,
        online: onlineSet.has(String(user._id)),
        topicsOpened: topic.opened || 0,
        topicsCompleted: topic.completed || 0,
        questionsAttempted: question.attempted || 0,
        correctAnswers: question.correct || 0,
        practicalsAttempted: (practical.attempted || []).length,
        practicalsCompleted: completedPracticalIds.size,
        activeSeconds: time.seconds || 0,
      };
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

async function removeStudent(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid student ID.');
  const student = await User.findOne({ _id: req.params.id, role: 'student' })
    .select('name studentId semester classSection +profilePhotoPublicId')
    .lean();
  if (!student) throw new HttpError(404, 'Student not found.');

  // Disable access first so existing sessions cannot continue creating records during deletion.
  const deactivated = await User.updateOne({ _id: student._id, role: 'student' }, { $set: { isActive: false } });
  if (!deactivated.matchedCount) throw new HttpError(404, 'Student not found.');
  req.app.get('io')?.in(`student:${student._id}`).disconnectSockets(true);

  // The account is retained (inactive) if any cleanup step fails, so an admin can retry safely.
  const deletedData = await deleteStudentData(student._id);
  if (student.profilePhotoPublicId) await deleteStudentPhoto(student.profilePhotoPublicId);
  const removedAccount = await User.deleteOne({ _id: student._id, role: 'student' });
  if (removedAccount.deletedCount !== 1) throw new HttpError(409, 'Student data was cleared, but the account could not be removed. Refresh and try again.');

  res.json({
    deleted: true,
    student: { name: student.name, studentId: student.studentId, semester: student.semester, classSection: student.classSection },
    deletedData,
  });
}

async function onlineStudents(req, res) {
  const sessions = await Session.find({ role: 'student', endedAt: null, lastHeartbeatAt: { $gte: ONLINE_CUTOFF() } }).sort({ lastHeartbeatAt: -1 }).populate('studentId', 'name email studentId lastLogin').lean();
  const seen = new Set();
  const students = sessions.filter((row) => {
    const id = String(row.studentId?._id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map((row) => ({ ...row.studentId, lastHeartbeatAt: row.lastHeartbeatAt, sessionStartedAt: row.startedAt }));
  res.json({ students, thresholdSeconds: ONLINE_SECONDS });
}

async function studentDetail(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid student ID.');
  const student = await User.findOne({ _id: req.params.id, role: 'student' }).select('studentId name email semester classSection totalPoints createdAt lastLogin lastActive isActive').lean();
  if (!student) throw new HttpError(404, 'Student not found.');
  const modules = await Module.find({ courseCode: COURSE_CODE, isActive: true }).sort({ moduleNumber: 1 }).lean();
  const [topics, progress, questionAttempts, practicalAttempts, activity, sessions, timeRows] = await Promise.all([
    Topic.find({ moduleId: { $in: modules.map((m) => m._id) } }).sort({ moduleId: 1, order: 1 }).populate('moduleId', 'moduleNumber title').lean(),
    TopicProgress.find({ studentId: student._id }).populate('topicId', 'title key order').populate('moduleId', 'moduleNumber title').lean(),
    QuestionAttempt.find({ studentId: student._id }).sort({ submittedAt: -1 }).limit(200).populate('questionId', 'title prompt').populate('moduleId', 'moduleNumber title').populate('topicId', 'title').lean(),
    PracticalAttempt.find({ studentId: student._id }).sort({ submittedAt: -1 }).limit(200).populate('practicalId', 'number prompt').populate('moduleId', 'moduleNumber title').lean(),
    ActivityLog.find({ studentId: student._id }).sort({ timestamp: -1 }).limit(100).populate('moduleId', 'moduleNumber title').populate('topicId', 'title').populate('questionId', 'title').populate('practicalId', 'number').lean(),
    Session.find({ studentId: student._id }).sort({ startedAt: -1 }).limit(50).lean(),
    LearningTime.find({ studentId: student._id }).lean(),
  ]);
  const moduleProgress = modules.map((module) => {
    const moduleTopics = topics.filter((topic) => String(topic.moduleId?._id || topic.moduleId) === String(module._id));
    const moduleP = progress.filter((row) => String(row.moduleId?._id || row.moduleId) === String(module._id));
    const complete = moduleP.filter((row) => row.completedAt).length;
    const time = timeRows.filter((row) => String(row.moduleId) === String(module._id)).reduce((sum, row) => sum + row.activeSeconds, 0);
    return { moduleNumber: module.moduleNumber, title: module.title, totalTopics: moduleTopics.length, openedTopics: moduleP.length, completedTopics: complete, completionPercent: moduleTopics.length ? Math.round((complete / moduleTopics.length) * 100) : 0, activeSeconds: time };
  });
  const totalLearningTimeSec = timeRows.reduce((sum, row) => sum + row.activeSeconds, 0);
  const topicOpenedCount = progress.reduce((sum, row) => sum + row.openedCount, 0);
  res.json({
    student,
    summary: {
      totalLearningTimeSec,
      topicsOpened: topicOpenedCount,
      topicsCompleted: progress.filter((row) => row.completedAt).length,
      questionsAttempted: questionAttempts.filter((a) => a.status === 'submitted').length,
      correctAnswers: questionAttempts.filter((a) => a.isCorrect === true).length,
      incorrectAnswers: questionAttempts.filter((a) => a.isCorrect === false).length,
      practicalsAttempted: new Set(practicalAttempts.map((a) => String(a.practicalId?._id || a.practicalId))).size,
      practicalsCompleted: new Set(practicalAttempts.filter((a) => a.completedAt).map((a) => String(a.practicalId?._id || a.practicalId))).size,
    },
    moduleProgress,
    topicProgress: progress,
    questionAttempts,
    practicalAttempts,
    activity: activity.map(formatActivity),
    sessions,
  });
}

async function emailStudentReport(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid student ID.');
  const student = await User.findOne({ _id: req.params.id, role: 'student', isActive: true })
    .select('studentId name email semester classSection totalPoints')
    .lean();
  if (!student) throw new HttpError(404, 'Active student not found.');

  const modules = await Module.find({ courseCode: COURSE_CODE, isActive: true }).sort({ moduleNumber: 1 }).lean();
  const moduleIds = modules.map((module) => module._id);
  const [topics, progress, questionStats, practicalStats, activityRows, timeRows] = await Promise.all([
    Topic.find({ moduleId: { $in: moduleIds }, isActive: true }).select('moduleId').lean(),
    TopicProgress.find({ studentId: student._id }).select('moduleId openedCount completedAt').lean(),
    QuestionAttempt.aggregate([
      { $match: { studentId: student._id, status: 'submitted' } },
      { $group: { _id: null, attempts: { $sum: 1 }, correct: { $sum: { $cond: [{ $eq: ['$isCorrect', true] }, 1, 0] } } } },
    ]),
    PracticalAttempt.aggregate([
      { $match: { studentId: student._id } },
      { $group: {
        _id: null,
        attempted: { $addToSet: '$practicalId' },
        completed: { $addToSet: { $cond: [{ $ne: ['$completedAt', null] }, '$practicalId', null] } },
      } },
    ]),
    ActivityLog.find({ studentId: student._id }).sort({ timestamp: -1 }).limit(10)
      .populate('moduleId', 'moduleNumber title').populate('topicId', 'title')
      .populate('questionId', 'title').populate('practicalId', 'number').lean(),
    LearningTime.aggregate([
      { $match: { studentId: student._id } },
      { $group: { _id: '$moduleId', seconds: { $sum: '$activeSeconds' } } },
    ]),
  ]);

  const totalTopicsByModule = new Map();
  for (const topic of topics) {
    const key = String(topic.moduleId);
    totalTopicsByModule.set(key, (totalTopicsByModule.get(key) || 0) + 1);
  }
  const learningByModule = new Map(timeRows.map((row) => [String(row._id), row.seconds]));
  const moduleProgress = modules.map((module) => {
    const key = String(module._id);
    const moduleTopics = totalTopicsByModule.get(key) || 0;
    const moduleRows = progress.filter((row) => String(row.moduleId) === key);
    const completedTopics = moduleRows.filter((row) => row.completedAt).length;
    return {
      moduleNumber: module.moduleNumber,
      title: module.title,
      totalTopics: moduleTopics,
      completedTopics,
      completionPercent: moduleTopics ? Math.round((completedTopics / moduleTopics) * 100) : 0,
      activeSeconds: learningByModule.get(key) || 0,
    };
  });
  const uniqueCompletedPracticals = new Set((practicalStats[0]?.completed || []).filter(Boolean).map(String));
  const toActivity = (event) => {
    const formatted = formatActivity(event);
    const detail = formatted.topic || formatted.question || (formatted.practicalNumber ? `Practical ${formatted.practicalNumber}` : formatted.module ? `Module ${formatted.module.number}` : '');
    return {
      timestamp: event.timestamp,
      label: String(event.eventType || 'Activity').replace(/_/g, ' ').toLowerCase().replace(/^./, (char) => char.toUpperCase()),
      detail,
    };
  };

  const report = {
    generatedAt: new Date(),
    totalPoints: student.totalPoints || 0,
    totalLearningTimeSec: timeRows.reduce((sum, row) => sum + (row.seconds || 0), 0),
    topicsOpened: progress.reduce((sum, row) => sum + (row.openedCount || 0), 0),
    topicsCompleted: progress.filter((row) => row.completedAt).length,
    questionsAttempted: questionStats[0]?.attempts || 0,
    correctAnswers: questionStats[0]?.correct || 0,
    practicalsAttempted: new Set((practicalStats[0]?.attempted || []).filter(Boolean).map(String)).size,
    practicalsCompleted: uniqueCompletedPracticals.size,
    modules: moduleProgress,
    recentActivity: activityRows.map(toActivity),
  };

  await sendStudentReportEmail(student, report);
  res.json({ sent: true, recipient: student.email });
}

async function topicAnalytics(req, res) {
  const modules = await Module.find({ courseCode: COURSE_CODE }).sort({ moduleNumber: 1 }).lean();
  const [topics, stats, times] = await Promise.all([
    Topic.find({ moduleId: { $in: modules.map((m) => m._id) }, isActive: true }).populate('moduleId', 'moduleNumber title').sort({ moduleId: 1, order: 1 }).lean(),
    TopicProgress.aggregate([{ $group: { _id: '$topicId', studentsOpened: { $sum: { $cond: [{ $gt: ['$openedCount', 0] }, 1, 0] } }, opens: { $sum: '$openedCount' }, completed: { $sum: { $cond: [{ $ne: ['$completedAt', null] }, 1, 0] } }, avgSeconds: { $avg: '$timeSpentSec' } } }]),
    LearningTime.aggregate([{ $match: { scopeType: 'topic' } }, { $group: { _id: '$topicId', seconds: { $sum: '$activeSeconds' } } }]),
  ]);
  const statMap = new Map(stats.map((s) => [String(s._id), s]));
  const timeMap = new Map(times.map((s) => [String(s._id), s.seconds]));
  const rows = topics.map((topic) => {
    const stat = statMap.get(String(topic._id)) || {};
    const totalStudents = 0; // total enrolled is supplied as a separate denominator below
    return { id: topic._id, key: topic.key, topic: topic.title, moduleNumber: topic.moduleId?.moduleNumber, moduleTitle: topic.moduleId?.title, totalStudents, studentsOpened: stat.studentsOpened || 0, opened: stat.opens || 0, completed: stat.completed || 0, averageTimeSec: Math.round(stat.avgSeconds || 0), totalActiveSeconds: timeMap.get(String(topic._id)) || 0 };
  });
  const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
  for (const row of rows) row.totalStudents = totalStudents;
  res.json({ rows, totalStudents });
}

async function questionAnalytics(req, res) {
  const modules = await Module.find({ courseCode: COURSE_CODE }).sort({ moduleNumber: 1 }).lean();
  const [questions, stats] = await Promise.all([
    Question.find({ moduleId: { $in: modules.map((m) => m._id) }, isActive: true }).select('-correctAnswer').populate('moduleId', 'moduleNumber title').populate('topicId', 'title').lean(),
    QuestionAttempt.aggregate([{ $match: { status: 'submitted' } }, { $group: { _id: '$questionId', attempts: { $sum: 1 }, students: { $addToSet: '$studentId' }, correct: { $sum: { $cond: ['$isCorrect', 1, 0] } }, incorrect: { $sum: { $cond: ['$isCorrect', 0, 1] } }, averageTimeSec: { $avg: '$timeSpentSec' } } }]),
  ]);
  const statMap = new Map(stats.map((s) => [String(s._id), s]));
  let rows = questions.map((question) => {
    const stat = statMap.get(String(question._id)) || {};
    const attempts = stat.attempts || 0; const correct = stat.correct || 0; const incorrect = stat.incorrect || 0;
    return { id: question._id, title: question.title, prompt: question.prompt, moduleNumber: question.moduleId?.moduleNumber, moduleTitle: question.moduleId?.title, topic: question.topicId?.title, attempts, uniqueStudents: stat.students?.length || 0, correct, incorrect, successRate: attempts ? Math.round((correct / attempts) * 1000) / 10 : 0, averageTimeSec: Math.round(stat.averageTimeSec || 0) };
  });
  const sort = req.query.sort;
  if (sort === 'most_attempted') rows.sort((a, b) => b.attempts - a.attempts);
  else if (sort === 'least_attempted') rows.sort((a, b) => a.attempts - b.attempts);
  else if (sort === 'most_difficult' || sort === 'highest_incorrect') rows.sort((a, b) => (b.attempts ? b.incorrect / b.attempts : 0) - (a.attempts ? a.incorrect / a.attempts : 0));
  else if (sort === 'highest_average_time') rows.sort((a, b) => b.averageTimeSec - a.averageTimeSec);
  res.json({ rows, sort: sort || 'most_attempted' });
}

async function practicalAnalytics(req, res) {
  const modules = await Module.find({ courseCode: COURSE_CODE }).sort({ moduleNumber: 1 }).lean();
  const practicals = await Practical.find({ moduleId: { $in: modules.map((m) => m._id) }, isActive: true }).populate('moduleId', 'moduleNumber title').sort({ moduleId: 1, number: 1 }).lean();
  const attempts = await PracticalAttempt.find({ practicalId: { $in: practicals.map((p) => p._id) } }).lean();
  const byPractical = new Map();
  for (const attempt of attempts) {
    const key = String(attempt.practicalId);
    if (!byPractical.has(key)) byPractical.set(key, []);
    byPractical.get(key).push(attempt);
  }
  const rows = practicals.map((practical) => {
    const list = byPractical.get(String(practical._id)) || [];
    const attemptedStudents = new Set(list.map((row) => String(row.studentId)));
    const completedStudents = new Set(list.filter((row) => row.completedAt).map((row) => String(row.studentId)));
    const verifiedRuns = list.filter((row) => row.isCorrect !== null);
    const successfulRuns = list.filter((row) => row.isCorrect === true).length;
    const failedRuns = list.filter((row) => row.isCorrect === false).length;
    const countsPerStudent = [...list.reduce((map, item) => map.set(String(item.studentId), (map.get(String(item.studentId)) || 0) + 1), new Map()).values()];
    const executionTimes = verifiedRuns.map((row) => row.executionTimeMs).filter(Number.isFinite);
    return {
      id: practical._id,
      practicalNumber: practical.number,
      prompt: practical.prompt,
      moduleNumber: practical.moduleId?.moduleNumber,
      moduleTitle: practical.moduleId?.title,
      studentsAttempted: attemptedStudents.size,
      studentsCompleted: completedStudents.size,
      successfulRuns,
      failedRuns,
      unverifiedSubmissions: list.filter((row) => row.isCorrect === null).length,
      averageAttempts: countsPerStudent.length ? Math.round((countsPerStudent.reduce((a, b) => a + b, 0) / countsPerStudent.length) * 10) / 10 : 0,
      averageExecutionTimeMs: executionTimes.length ? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length) : null,
      completionPercent: attemptedStudents.size ? Math.round((completedStudents.size / attemptedStudents.size) * 100) : 0,
    };
  });
  res.json({ rows });
}

async function timeAnalytics(req, res) {
  const fromDays = Math.min(90, Math.max(7, Number.parseInt(req.query.days, 10) || 14));
  const fromDate = indiaDayStart(fromDays - 1);
  const fromKey = indiaDateKey(fromDate);
  const [dailyTime, scopeTime, activeByDay, sessionStats, scopeAverages] = await Promise.all([
    LearningTime.aggregate([{ $match: { dateKey: { $gte: fromKey } } }, { $group: { _id: '$dateKey', seconds: { $sum: '$activeSeconds' } } }, { $sort: { _id: 1 } }]),
    LearningTime.aggregate([{ $group: { _id: '$scopeType', seconds: { $sum: '$activeSeconds' } } }]),
    ActivityLog.aggregate([{ $match: { timestamp: { $gte: fromDate } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } }, students: { $addToSet: '$studentId' } } }, { $project: { date: '$_id', activeStudents: { $size: '$students' } } }, { $sort: { date: 1 } }]),
    Session.aggregate([{ $match: { role: 'student', endedAt: { $ne: null }, startedAt: { $gte: fromDate } } }, { $group: { _id: null, averageDurationSec: { $avg: { $divide: [{ $subtract: ['$endedAt', '$startedAt'] }, 1000] } }, sessions: { $sum: 1 } } }]),
    LearningTime.aggregate([{ $match: { scopeType: { $in: ['topic', 'question', 'practical'] } } }, { $group: { _id: { scopeType: '$scopeType', scopeKey: '$scopeKey', studentId: '$studentId' }, seconds: { $sum: '$activeSeconds' } } }, { $group: { _id: '$_id.scopeType', averageSec: { $avg: '$seconds' }, count: { $sum: 1 } } }]),
  ]);
  const timeMap = new Map(dailyTime.map((row) => [row._id, row.seconds]));
  const activeMap = new Map(activeByDay.map((row) => [row.date, row.activeStudents]));
  const daily = Array.from({ length: fromDays }, (_, i) => {
    const d = indiaDayStart(fromDays - 1 - i);
    const key = indiaDateKey(d);
    return { date: key, learningMinutes: Math.round((timeMap.get(key) || 0) / 60), activeStudents: activeMap.get(key) || 0 };
  });
  res.json({
    daily,
    totalsByScope: scopeTime.map((row) => ({ scope: row._id, seconds: row.seconds })),
    averageSessionSec: Math.round(sessionStats[0]?.averageDurationSec || 0),
    completedSessions: sessionStats[0]?.sessions || 0,
    averageActiveTime: scopeAverages.map((row) => ({ scope: row._id, averageSec: Math.round(row.averageSec || 0), items: row.count })),
  });
}

async function activity(req, res) {
  const { page, limit, skip } = pageParams(req.query);
  const filter = {};
  if (req.query.eventType) filter.eventType = req.query.eventType;
  if (req.query.moduleId) {
    const module = await Module.findOne({ $or: [{ _id: req.query.moduleId }, { slug: req.query.moduleId }] }).select('_id');
    if (module) filter.moduleId = module._id;
    else filter.moduleId = new mongoose.Types.ObjectId();
  }
  for (const key of ['topicId', 'questionId', 'practicalId']) {
    if (req.query[key] && mongoose.isValidObjectId(req.query[key])) filter[key] = req.query[key];
  }
  if (req.query.studentId && mongoose.isValidObjectId(req.query.studentId)) filter.studentId = req.query.studentId;
  if (req.query.student) {
    const re = new RegExp(escapedRegex(req.query.student.trim().slice(0, 100)), 'i');
    const matchingUsers = await User.find({ role: 'student', $or: [{ name: re }, { email: re }, { studentId: re }] }).select('_id').limit(1000).lean();
    const studentIds = matchingUsers.map((user) => user._id);
    if (filter.studentId) filter.studentId = { $in: studentIds.filter((id) => String(id) === String(filter.studentId)) };
    else filter.studentId = { $in: studentIds };
  }
  if (req.query.status === 'online' || req.query.status === 'offline') {
    const onlineIds = await Session.distinct('studentId', { role: 'student', endedAt: null, lastHeartbeatAt: { $gte: ONLINE_CUTOFF() } });
    const statusIds = req.query.status === 'online' ? onlineIds : await User.distinct('_id', { role: 'student', _id: { $nin: onlineIds } });
    if (filter.studentId) {
      const current = Array.isArray(filter.studentId.$in) ? filter.studentId.$in : [filter.studentId];
      filter.studentId = { $in: current.filter((id) => statusIds.some((statusId) => String(statusId) === String(id))) };
    } else filter.studentId = { $in: statusIds };
  }
  if (req.query.result === 'correct' || req.query.result === 'incorrect') filter['metadata.result'] = req.query.result;
  if (req.query.completion === 'completed') filter.eventType = { $in: ['TOPIC_COMPLETED', 'PRACTICAL_COMPLETED'] };
  if (req.query.completion === 'incomplete') filter.eventType = { $in: ['TOPIC_OPENED', 'QUESTION_OPENED', 'PRACTICAL_OPENED', 'PRACTICAL_RUN'] };
  if (req.query.q) {
    const re = new RegExp(escapedRegex(req.query.q.trim().slice(0, 100)), 'i');
    filter.$or = [{ eventType: re }, { sessionId: re }, { 'metadata.note': re }, { 'metadata.source': re }];
  }
  if (req.query.from || req.query.to) {
    filter.timestamp = {};
    if (req.query.from) {
      const from = new Date(req.query.from);
      if (Number.isNaN(from.getTime())) throw new HttpError(400, 'Invalid start date filter.');
      filter.timestamp.$gte = from;
    }
    if (req.query.to) {
      const to = new Date(req.query.to);
      if (Number.isNaN(to.getTime())) throw new HttpError(400, 'Invalid end date filter.');
      filter.timestamp.$lte = to;
    }
  }
  const [total, events] = await Promise.all([
    ActivityLog.countDocuments(filter),
    ActivityLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).populate('studentId', 'name email studentId').populate('moduleId', 'moduleNumber title').populate('topicId', 'title').populate('questionId', 'title').populate('practicalId', 'number').lean(),
  ]);
  res.json({ events: events.map(formatActivity), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

function csvEscape(value) {
  const str = String(value ?? '');
  return `"${str.replace(/"/g, '""')}"`;
}
function indexModuleManualStatuses(rows) {
  const byStudent = new Map();
  for (const row of rows) {
    const studentKey = String(row.studentId);
    if (!byStudent.has(studentKey)) byStudent.set(studentKey, new Map());
    byStudent.get(studentKey).set(row.moduleNumber, row.moduleManualStatus);
  }
  return byStudent;
}
function moduleManualStatusValues(studentId, byStudent, modules) {
  const statuses = byStudent.get(String(studentId));
  return modules.map((module) => statuses?.get(module.moduleNumber) || 'pending');
}
async function exportCsv(req, res) {
  const type = req.params.type;
  let headers; let rows;
  if (type === 'students') {
    const studentsList = await User.find({ role: 'student' }).select('studentId name email semester classSection totalPoints createdAt lastLogin lastActive').lean();
    const studentIds = studentsList.map((student) => student._id);
    const moduleManualSync = await syncModuleManualProgressForStudents(studentIds);
    const manualByStudent = indexModuleManualStatuses(moduleManualSync.rows);
    const baseHeaders = ['studentId', 'name', 'email', 'semester', 'classSection', 'totalPoints', 'createdAt', 'lastLogin', 'lastActive'];
    const manualHeaders = moduleManualSync.modules.map((module) => `module${module.moduleNumber}ManualStatus`);
    headers = [...baseHeaders, ...manualHeaders];
    rows = studentsList.map((u) => [
      ...baseHeaders.map((header) => u[header]),
      ...moduleManualStatusValues(u._id, manualByStudent, moduleManualSync.modules),
    ]);
  } else if (type === 'questions') {
    const stats = await QuestionAttempt.aggregate([{ $match: { status: 'submitted' } }, { $group: { _id: '$questionId', attempts: { $sum: 1 }, correct: { $sum: { $cond: ['$isCorrect', 1, 0] } }, avgTimeSec: { $avg: '$timeSpentSec' } } }]);
    const map = new Map(stats.map((s) => [String(s._id), s]));
    const qs = await Question.find({}).select('title moduleId').populate('moduleId', 'moduleNumber').lean();
    headers = ['module', 'question', 'attempts', 'correct', 'avgTimeSec'];
    rows = qs.map((q) => { const s = map.get(String(q._id)) || {}; return [q.moduleId?.moduleNumber, q.title, s.attempts || 0, s.correct || 0, Math.round(s.avgTimeSec || 0)]; });
  } else if (type === 'practicals') {
    const practicals = await Practical.find({}).populate('moduleId', 'moduleNumber').lean();
    const attempts = await PracticalAttempt.find({}).lean();
    headers = ['module', 'practicalNumber', 'prompt', 'studentsAttempted', 'studentsApproved', 'approvedSubmissions', 'notApprovedSubmissions'];
    rows = practicals.map((p) => {
      const list = attempts.filter((a) => String(a.practicalId) === String(p._id));
      return [p.moduleId?.moduleNumber, p.number, p.prompt, new Set(list.map((a) => String(a.studentId))).size, new Set(list.filter((a) => a.completedAt).map((a) => String(a.studentId))).size, list.filter((a) => a.isCorrect === true).length, list.filter((a) => a.isCorrect === false).length];
    });
  } else if (type === 'activity') {
    const events = await ActivityLog.find({}).sort({ timestamp: -1 }).limit(50000).populate('studentId', 'name email studentId').populate('moduleId', 'moduleNumber').populate('topicId', 'title').lean();
    headers = ['timestamp', 'student', 'studentId', 'eventType', 'module', 'topic', 'sessionId'];
    rows = events.map((e) => [e.timestamp, e.studentId?.name, e.studentId?.studentId, e.eventType, e.moduleId?.moduleNumber, e.topicId?.title, e.sessionId]);
  } else if (type === 'progress') {
    const studentFilter = { role: 'student' };
    if (req.query.semester) {
      const semester = Number(req.query.semester);
      if (![3, 5].includes(semester)) throw new HttpError(400, 'Semester must be 3 or 5.');
      studentFilter.semester = semester;
    }
    if (req.query.classSection) {
      const classSection = String(req.query.classSection).toUpperCase();
      if (!['X1', 'X2', 'Y1', 'Y2'].includes(classSection)) throw new HttpError(400, 'Class must be X1, X2, Y1 or Y2.');
      studentFilter.classSection = classSection;
    }
    const studentsList = await User.find(studentFilter).select('studentId name email semester classSection totalPoints').lean();
    const studentIds = studentsList.map((student) => student._id);
    const [counts, moduleManualSync] = await Promise.all([
      TopicProgress.aggregate([
        { $match: { studentId: { $in: studentIds } } },
        { $group: { _id: '$studentId', opened: { $sum: '$openedCount' }, completed: { $sum: { $cond: [{ $ne: ['$completedAt', null] }, 1, 0] } } } },
      ]),
      syncModuleManualProgressForStudents(studentIds),
    ]);
    const map = new Map(counts.map((row) => [String(row._id), row]));
    const manualByStudent = indexModuleManualStatuses(moduleManualSync.rows);
    const manualHeaders = moduleManualSync.modules.map((module) => `module${module.moduleNumber}ManualStatus`);
    headers = ['studentId', 'name', 'email', 'semester', 'class', 'totalPoints', 'topicsOpened', 'topicsCompleted', ...manualHeaders];
    rows = studentsList.map((u) => {
      const c = map.get(String(u._id)) || {};
      return [
        u.studentId, u.name, u.email, u.semester, u.classSection,
        u.totalPoints || 0, c.opened || 0, c.completed || 0,
        ...moduleManualStatusValues(u._id, manualByStudent, moduleManualSync.modules),
      ];
    });
  } else {
    throw new HttpError(404, 'Unknown export type.');
  }
  const csv = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="dbms-${type}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`\uFEFF${csv}`);
}

async function systemStats(req, res) {
  const collections = await Promise.all([
    User.countDocuments(), Module.countDocuments({ courseCode: COURSE_CODE }), Topic.countDocuments(), Practical.countDocuments(), Question.countDocuments(), ActivityLog.countDocuments(), QuestionAttempt.countDocuments(), PracticalAttempt.countDocuments(), Session.countDocuments(),
  ]);
  res.json({ users: collections[0], modules: collections[1], topics: collections[2], practicals: collections[3], questions: collections[4], activityEvents: collections[5], questionAttempts: collections[6], practicalAttempts: collections[7], sessions: collections[8], courseCode: COURSE_CODE, moduleSourcePages: COURSE_CONTENT.modules.map((m) => m.sourcePages) });
}

module.exports = { dashboard, students, removeStudent, onlineStudents, studentDetail, emailStudentReport, topicAnalytics, questionAnalytics, practicalAnalytics, timeAnalytics, activity, exportCsv, systemStats };

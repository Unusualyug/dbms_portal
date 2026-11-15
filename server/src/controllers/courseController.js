const { COURSE_CATALOG, COURSE_CODE } = require("../config/constants");
const { getCoursePoints } = require("../services/pointsService");
const asyncHandler = require("../utils/asyncHandler");
const { courseFilter } = require("../services/courseScope");
const Module = require("../models/Module");
const ModuleManualProgress = require("../models/ModuleManualProgress");
const Topic = require("../models/Topic");
const TopicProgress = require("../models/TopicProgress");
const Question = require("../models/Question");
const QuestionAttempt = require("../models/QuestionAttempt");
const Practical = require("../models/Practical");
const PracticalAttempt = require("../models/PracticalAttempt");
const LearningTime = require("../models/LearningTime");
const ActivityLog = require("../models/ActivityLog");

async function listCourses(req, res) {
  const courses = await Promise.all(
    Object.values(COURSE_CATALOG).map(async (course) => {
      const moduleCount = await Module.countDocuments(
        courseFilter(course.code, { isActive: true }),
      );
      const points =
        req.user.role === "student"
          ? await getCoursePoints({
              studentId: req.user._id,
              courseCode: course.code,
            })
          : null;
      return {
        code: course.code,
        shortName: course.shortName,
        subjectName: course.subjectName,
        portalLabel: course.portalLabel,
        title: course.course.title,
        semester: course.course.semester,
        credits: course.course.credits,
        moduleCount,
        points,
        selected: course.code === req.courseCode,
      };
    }),
  );
  res.json({ courses, selectedCourseCode: req.courseCode || COURSE_CODE });
}

async function progressSummary(req, res) {
  const courseCode = req.courseCode || COURSE_CODE;
  const modules = await Module.find(
    courseFilter(courseCode, { isActive: true }),
  )
    .sort({ moduleNumber: 1 })
    .lean();
  const moduleIds = modules.map((module) => module._id);
  const [
    topics,
    topicProgress,
    manualProgress,
    questions,
    questionAttempts,
    practicals,
    practicalAttempts,
    timeRows,
    recentActivity,
    points,
  ] = await Promise.all([
    Topic.find(
      courseFilter(courseCode, {
        moduleId: { $in: moduleIds },
        isActive: true,
      }),
    )
      .select("_id moduleId")
      .lean(),
    TopicProgress.find(
      courseFilter(courseCode, { studentId: req.user._id }),
    ).lean(),
    ModuleManualProgress.find(
      courseFilter(courseCode, {
        studentId: req.user._id,
        moduleId: { $in: moduleIds },
      }),
    ).lean(),
    Question.find(
      courseFilter(courseCode, {
        moduleId: { $in: moduleIds },
        isActive: true,
      }),
    )
      .select("_id moduleId")
      .lean(),
    QuestionAttempt.find(
      courseFilter(courseCode, {
        studentId: req.user._id,
        status: "submitted",
      }),
    ).lean(),
    Practical.find(
      courseFilter(courseCode, {
        moduleId: { $in: moduleIds },
        isActive: true,
      }),
    )
      .select("_id moduleId")
      .lean(),
    PracticalAttempt.find(
      courseFilter(courseCode, {
        studentId: req.user._id,
        moduleId: { $in: moduleIds },
      }),
    ).lean(),
    LearningTime.find(
      courseFilter(courseCode, { studentId: req.user._id }),
    ).lean(),
    ActivityLog.find(courseFilter(courseCode, { studentId: req.user._id }))
      .sort({ timestamp: -1 })
      .limit(12)
      .lean(),
    getCoursePoints({ studentId: req.user._id, courseCode }),
  ]);
  const byId = (rows, key) =>
    new Map(rows.map((row) => [String(row[key]), row]));
  const topicById = byId(topics, "_id");
  const topicProgressById = byId(topicProgress, "topicId");
  const moduleProgressById = byId(manualProgress, "moduleId");
  const questionById = byId(questions, "_id");
  const practicalById = byId(practicals, "_id");
  const submittedQuestionIds = new Set(
    questionAttempts.map((attempt) => String(attempt.questionId)),
  );
  const attemptedPracticalIds = new Set(
    practicalAttempts.map((attempt) => String(attempt.practicalId)),
  );
  const questionCountByModule = new Map();
  const practicalCountByModule = new Map();
  const completedQuestionsByModule = new Map();
  const attemptedPracticalsByModule = new Map();
  for (const question of questions) {
    const key = String(question.moduleId);
    questionCountByModule.set(key, (questionCountByModule.get(key) || 0) + 1);
    if (submittedQuestionIds.has(String(question._id)))
      completedQuestionsByModule.set(
        key,
        (completedQuestionsByModule.get(key) || 0) + 1,
      );
  }
  for (const practical of practicals) {
    const key = String(practical.moduleId);
    practicalCountByModule.set(key, (practicalCountByModule.get(key) || 0) + 1);
    if (attemptedPracticalIds.has(String(practical._id)))
      attemptedPracticalsByModule.set(
        key,
        (attemptedPracticalsByModule.get(key) || 0) + 1,
      );
  }
  const timeByModule = new Map();
  for (const row of timeRows) {
    if (!row.moduleId) continue;
    const key = String(row.moduleId);
    timeByModule.set(
      key,
      (timeByModule.get(key) || 0) + (Number(row.activeSeconds) || 0),
    );
  }
  const moduleSummaries = modules.map((module) => {
    const key = String(module._id);
    const moduleTopics = topics.filter(
      (topic) => String(topic.moduleId) === key,
    );
    const completedTopics = moduleTopics.filter(
      (topic) => topicProgressById.get(String(topic._id))?.completedAt,
    ).length;
    const manual = moduleProgressById.get(key);
    const totalQuestions = questionCountByModule.get(key) || 0;
    const totalPracticals = practicalCountByModule.get(key) || 0;
    return {
      moduleId: module._id,
      moduleNumber: module.moduleNumber,
      title: module.title,
      topics: { total: moduleTopics.length, completed: completedTopics },
      questions: {
        total: totalQuestions,
        submitted: completedQuestionsByModule.get(key) || 0,
      },
      practicals: {
        total: totalPracticals,
        attempted: attemptedPracticalsByModule.get(key) || 0,
      },
      manualPracticalReview: manual
        ? {
            status: manual.moduleManualStatus,
            completed: manual.completedPracticals,
            total: manual.totalPracticals,
          }
        : null,
      activeSeconds: timeByModule.get(key) || 0,
    };
  });
  const activeSeconds = timeRows.reduce(
    (sum, item) => sum + (Number(item.activeSeconds) || 0),
    0,
  );
  res.json({
    courseCode,
    course: COURSE_CATALOG[courseCode]?.course || null,
    points,
    totals: {
      modules: modules.length,
      topics: topics.length,
      topicsCompleted: topicProgress.filter(
        (item) => item.completedAt && topicById.has(String(item.topicId)),
      ).length,
      questions: questions.length,
      questionsSubmitted: new Set(
        questionAttempts
          .filter((item) => questionById.has(String(item.questionId)))
          .map((item) => String(item.questionId)),
      ).size,
      practicals: practicals.length,
      practicalsAttempted: new Set(
        practicalAttempts
          .filter((item) => practicalById.has(String(item.practicalId)))
          .map((item) => String(item.practicalId)),
      ).size,
      activeSeconds,
    },
    modules: moduleSummaries,
    recentActivity: recentActivity.map((item) => ({
      eventType: item.eventType,
      occurredAt: item.timestamp,
      moduleId: item.moduleId || null,
      topicId: item.topicId || null,
      questionId: item.questionId || null,
      practicalId: item.practicalId || null,
      metadata: item.metadata || {},
    })),
  });
}

module.exports = {
  listCourses: asyncHandler(listCourses),
  progressSummary: asyncHandler(progressSummary),
};

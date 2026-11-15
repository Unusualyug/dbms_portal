const mongoose = require("mongoose");
const Module = require("../models/Module");
const Topic = require("../models/Topic");
const Practical = require("../models/Practical");
const Question = require("../models/Question");
const QuestionAttempt = require("../models/QuestionAttempt");
const PracticalAttempt = require("../models/PracticalAttempt");
const TopicProgress = require("../models/TopicProgress");
const LearningTime = require("../models/LearningTime");
const ActivityLog = require("../models/ActivityLog");
const { COURSE_CODE } = require("../config/constants");
const { courseFilter } = require("../services/courseScope");
const { listHallOfFame } = require("../services/hallOfFameService");
const {
  recordActivity,
  incrementTopicOpened,
} = require("../services/activityService");
const { getCoursePoints } = require("../services/pointsService");
const HttpError = require("../utils/httpError");

async function getHallOfFame(req, res) {
  res.json(await listHallOfFame(req.query, undefined, req.courseCode));
}

async function findModule(id, courseCode = COURSE_CODE) {
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id };
  const module = await Module.findOne(
    courseFilter(courseCode, { ...query, isActive: true }),
  );
  if (!module) throw new HttpError(404, "Module not found.");
  return module;
}

async function findTopic(id, courseCode = COURSE_CODE) {
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { key: id };
  const topic = await Topic.findOne(
    courseFilter(courseCode, { ...query, isActive: true }),
  );
  if (!topic) throw new HttpError(404, "Topic not found.");
  return topic;
}

async function getModules(req, res) {
  const modules = await Module.find(
    courseFilter(req.courseCode, { isActive: true }),
  )
    .sort({ moduleNumber: 1 })
    .lean();
  const moduleIds = modules.map((module) => module._id);
  const [topics, practicals, topicProgress, completedPracticals] =
    await Promise.all([
      Topic.find(
        courseFilter(req.courseCode, {
          moduleId: { $in: moduleIds },
          isActive: true,
        }),
      )
        .sort({ order: 1 })
        .lean(),
      Practical.find(
        courseFilter(req.courseCode, {
          moduleId: { $in: moduleIds },
          isActive: true,
        }),
      )
        .sort({ moduleId: 1, number: 1 })
        .lean(),
      TopicProgress.find(
        courseFilter(req.courseCode, {
          studentId: req.user._id,
          moduleId: { $in: moduleIds },
        }),
      ).lean(),
      PracticalAttempt.find(
        courseFilter(req.courseCode, {
          studentId: req.user._id,
          moduleId: { $in: moduleIds },
          completedAt: { $ne: null },
        }),
      )
        .select("practicalId")
        .lean(),
    ]);
  const progressByTopic = new Map(
    topicProgress.map((progress) => [String(progress.topicId), progress]),
  );
  const completedPracticalIds = new Set(
    completedPracticals.map((attempt) => String(attempt.practicalId)),
  );
  const byModuleTopics = new Map();
  const byModulePracticals = new Map();
  for (const topic of topics) {
    const key = String(topic.moduleId);
    if (!byModuleTopics.has(key)) byModuleTopics.set(key, []);
    byModuleTopics
      .get(key)
      .push({
        ...topic,
        progress: progressByTopic.get(String(topic._id)) || null,
      });
  }
  for (const practical of practicals) {
    const key = String(practical.moduleId);
    if (!byModulePracticals.has(key)) byModulePracticals.set(key, []);
    byModulePracticals
      .get(key)
      .push({
        ...practical,
        completed: completedPracticalIds.has(String(practical._id)),
      });
  }
  res.json({
    modules: modules.map((module) => {
      const moduleTopics = byModuleTopics.get(String(module._id)) || [];
      const completedTopics = moduleTopics.filter(
        (topic) => topic.progress?.completedAt,
      ).length;
      const modulePracticals = byModulePracticals.get(String(module._id)) || [];
      return {
        ...module,
        topics: moduleTopics,
        practicals: modulePracticals,
        topicCount: moduleTopics.length,
        completedTopics,
        progressPercent: moduleTopics.length
          ? Math.round((completedTopics / moduleTopics.length) * 100)
          : 0,
        practicalCount: modulePracticals.length,
        completedPracticals: modulePracticals.filter(
          (practical) => practical.completed,
        ).length,
      };
    }),
  });
}

async function getModule(req, res) {
  const module = await findModule(req.params.moduleId, req.courseCode);
  await recordActivity({
    req,
    eventType: "MODULE_OPENED",
    moduleId: module._id,
  });
  const [topics, practicals, progress, completedPracticals] = await Promise.all(
    [
      Topic.find(
        courseFilter(req.courseCode, { moduleId: module._id, isActive: true }),
      )
        .sort({ order: 1 })
        .lean(),
      Practical.find(
        courseFilter(req.courseCode, { moduleId: module._id, isActive: true }),
      )
        .sort({ number: 1 })
        .lean(),
      TopicProgress.find(
        courseFilter(req.courseCode, {
          studentId: req.user._id,
          moduleId: module._id,
        }),
      ).lean(),
      PracticalAttempt.find(
        courseFilter(req.courseCode, {
          studentId: req.user._id,
          moduleId: module._id,
          completedAt: { $ne: null },
        }),
      )
        .select("practicalId")
        .lean(),
    ],
  );
  const progressMap = new Map(
    progress.map((row) => [String(row.topicId), row]),
  );
  const completedSet = new Set(
    completedPracticals.map((row) => String(row.practicalId)),
  );
  const completedTopicCount = progress.filter((row) => row.completedAt).length;
  res.json({
    module: {
      ...module.toObject(),
      topics: topics.map((topic) => ({
        ...topic,
        progress: progressMap.get(String(topic._id)) || null,
      })),
      practicals: practicals.map((practical) => ({
        ...practical,
        completed: completedSet.has(String(practical._id)),
      })),
      completedTopicCount,
      completedPracticals: completedSet.size,
      progressPercent: topics.length
        ? Math.round((completedTopicCount / topics.length) * 100)
        : 0,
    },
  });
}

async function getTopic(req, res) {
  const topic = await findTopic(req.params.topicId, req.courseCode);
  const module = await Module.findOne(
    courseFilter(req.courseCode, { _id: topic.moduleId }),
  ).lean();
  if (!module) throw new HttpError(404, "Topic not found.");
  await incrementTopicOpened(req.user._id, topic, req.courseCode);
  await recordActivity({
    req,
    eventType: "TOPIC_OPENED",
    moduleId: topic.moduleId,
    topicId: topic._id,
  });
  const [progress, relatedQuestions, moduleTopics] = await Promise.all([
    TopicProgress.findOne(
      courseFilter(req.courseCode, {
        studentId: req.user._id,
        topicId: topic._id,
      }),
    ).lean(),
    Question.find(
      courseFilter(req.courseCode, { topicId: topic._id, isActive: true }),
    )
      .select("title prompt type options sourceType")
      .lean(),
    Topic.find(
      courseFilter(req.courseCode, {
        moduleId: topic.moduleId,
        isActive: true,
      }),
    )
      .select("_id key title order")
      .sort({ order: 1 })
      .lean(),
  ]);
  const index = moduleTopics.findIndex(
    (item) => String(item._id) === String(topic._id),
  );
  res.json({
    topic,
    module,
    progress,
    relatedQuestions,
    navigation: {
      previous: moduleTopics[index - 1] || null,
      next: moduleTopics[index + 1] || null,
    },
  });
}

async function completeTopic(req, res) {
  const topic = await findTopic(req.params.topicId, req.courseCode);
  const progress = await TopicProgress.findOne(
    courseFilter(req.courseCode, {
      studentId: req.user._id,
      topicId: topic._id,
    }),
  );
  if (!progress || progress.timeSpentSec < 20) {
    throw new HttpError(
      422,
      "Spend at least 20 seconds of active learning time on this topic before completing it. Hidden/background tabs are not counted.",
    );
  }
  if (!progress.completedAt) {
    progress.courseCode = req.courseCode;
    progress.completedAt = new Date();
    await progress.save();
    await recordActivity({
      req,
      eventType: "TOPIC_COMPLETED",
      moduleId: topic.moduleId,
      topicId: topic._id,
      metadata: { durationSec: progress.timeSpentSec },
    });
  }
  res.json({
    completed: true,
    completedAt: progress.completedAt,
    timeSpentSec: progress.timeSpentSec,
  });
}

async function getDashboard(req, res) {
  const modules = await Module.find(
    courseFilter(req.courseCode, { isActive: true }),
  )
    .sort({ moduleNumber: 1 })
    .lean();
  const moduleIds = modules.map((module) => module._id);
  const completedTopicIds = await TopicProgress.find(
    courseFilter(req.courseCode, {
      studentId: req.user._id,
      completedAt: { $ne: null },
    }),
  ).distinct("topicId");
  const [
    topicCountRows,
    totalTopics,
    totalPracticals,
    totalQuestions,
    topicProgress,
    questionAttempts,
    practicalAttempts,
    timeAgg,
    recentTopics,
    recentQuestions,
    nextTopic,
    totalPoints,
  ] = await Promise.all([
    Topic.aggregate([
      {
        $match: courseFilter(req.courseCode, {
          moduleId: { $in: moduleIds },
          isActive: true,
        }),
      },
      { $group: { _id: "$moduleId", count: { $sum: 1 } } },
    ]),
    Topic.countDocuments(
      courseFilter(req.courseCode, {
        moduleId: { $in: moduleIds },
        isActive: true,
      }),
    ),
    Practical.countDocuments(
      courseFilter(req.courseCode, {
        moduleId: { $in: moduleIds },
        isActive: true,
      }),
    ),
    Question.countDocuments(
      courseFilter(req.courseCode, {
        moduleId: { $in: moduleIds },
        isActive: true,
      }),
    ),
    TopicProgress.find(
      courseFilter(req.courseCode, {
        studentId: req.user._id,
        moduleId: { $in: moduleIds },
      }),
    ).lean(),
    QuestionAttempt.find(
      courseFilter(req.courseCode, {
        studentId: req.user._id,
        status: "submitted",
        moduleId: { $in: moduleIds },
      }),
    )
      .select("isCorrect questionId moduleId submittedAt timeSpentSec")
      .sort({ submittedAt: -1 })
      .lean(),
    PracticalAttempt.find(
      courseFilter(req.courseCode, {
        studentId: req.user._id,
        moduleId: { $in: moduleIds },
      }),
    )
      .select(
        "practicalId moduleId isCorrect completedAt submittedAt timeSpentSec",
      )
      .sort({ submittedAt: -1 })
      .lean(),
    LearningTime.aggregate([
      { $match: courseFilter(req.courseCode, { studentId: req.user._id }) },
      { $group: { _id: null, seconds: { $sum: "$activeSeconds" } } },
    ]),
    ActivityLog.find(
      courseFilter(req.courseCode, {
        studentId: req.user._id,
        eventType: "TOPIC_OPENED",
        topicId: { $exists: true },
      }),
    )
      .sort({ timestamp: -1 })
      .limit(5)
      .populate("topicId", "title key")
      .populate("moduleId", "title moduleNumber")
      .lean(),
    QuestionAttempt.find(
      courseFilter(req.courseCode, {
        studentId: req.user._id,
        status: "submitted",
        moduleId: { $in: moduleIds },
      }),
    )
      .sort({ submittedAt: -1 })
      .limit(5)
      .populate("questionId", "title prompt")
      .populate("moduleId", "moduleNumber title")
      .lean(),
    Topic.findOne(
      courseFilter(req.courseCode, {
        moduleId: { $in: moduleIds },
        isActive: true,
        _id: { $nin: completedTopicIds },
      }),
    )
      .sort({ moduleId: 1, order: 1 })
      .populate("moduleId", "moduleNumber title")
      .lean(),
    getCoursePoints({ studentId: req.user._id, courseCode: req.courseCode }),
  ]);
  const completedTopics = topicProgress.filter(
    (progress) => progress.completedAt,
  ).length;
  const topicCountByModule = new Map(
    topicCountRows.map((row) => [String(row._id), row.count]),
  );
  const modulesCompleted = modules.filter((module) => {
    const count = topicProgress.filter(
      (progress) =>
        String(progress.moduleId) === String(module._id) &&
        progress.completedAt,
    ).length;
    return (
      topicCountByModule.get(String(module._id)) > 0 &&
      count === topicCountByModule.get(String(module._id))
    );
  }).length;
  const uniqueCompletedPracticals = new Set(
    practicalAttempts
      .filter((attempt) => attempt.completedAt)
      .map((attempt) => String(attempt.practicalId)),
  ).size;
  const currentModule = nextTopic?.moduleId || modules[0] || null;
  res.json({
    courseCode: req.courseCode,
    stats: {
      overallProgress: totalTopics
        ? Math.round((completedTopics / totalTopics) * 100)
        : 0,
      modulesCompleted,
      moduleCount: modules.length,
      topicsCompleted: completedTopics,
      topicsTotal: totalTopics,
      questionsAttempted: questionAttempts.length,
      correctAnswers: questionAttempts.filter((attempt) => attempt.isCorrect)
        .length,
      incorrectAnswers: questionAttempts.filter(
        (attempt) => attempt.isCorrect === false,
      ).length,
      questionsTotal: totalQuestions,
      practicalsAttempted: new Set(
        practicalAttempts.map((attempt) => String(attempt.practicalId)),
      ).size,
      practicalsCompleted: uniqueCompletedPracticals,
      practicalsTotal: totalPracticals,
      learningTimeSec: timeAgg[0]?.seconds || 0,
      totalPoints,
      currentModule,
    },
    modules: modules.map((module) => {
      const complete = topicProgress.filter(
        (progress) =>
          String(progress.moduleId) === String(module._id) &&
          progress.completedAt,
      ).length;
      const count = topicCountByModule.get(String(module._id)) || 0;
      return {
        moduleNumber: module.moduleNumber,
        title: module.title,
        moduleId: module._id,
        completedTopics: complete,
        topicCount: count,
        progressPercent: count ? Math.round((complete / count) * 100) : 0,
      };
    }),
    recentTopics: recentTopics.map((event) => ({
      title: event.topicId?.title || "Topic",
      topicKey: event.topicId?.key,
      moduleTitle: event.moduleId?.title,
      timestamp: event.timestamp,
    })),
    recentQuestions: recentQuestions.map((attempt) => ({
      title: attempt.questionId?.title || "Question",
      moduleNumber: attempt.moduleId?.moduleNumber,
      isCorrect: attempt.isCorrect,
      submittedAt: attempt.submittedAt,
      timeSpentSec: attempt.timeSpentSec,
    })),
    recommendedNextTopic: nextTopic
      ? {
          id: nextTopic._id,
          key: nextTopic.key,
          title: nextTopic.title,
          module: nextTopic.moduleId,
        }
      : null,
  });
}

async function getProgress(req, res) {
  const modules = await Module.find(
    courseFilter(req.courseCode, { isActive: true }),
  )
    .sort({ moduleNumber: 1 })
    .lean();
  const moduleIds = modules.map((module) => module._id);
  const [
    topics,
    progress,
    questionAttempts,
    practicalAttempts,
    times,
    topicCounts,
  ] = await Promise.all([
    Topic.find(
      courseFilter(req.courseCode, {
        moduleId: { $in: moduleIds },
        isActive: true,
      }),
    )
      .select("_id moduleId title order key")
      .sort({ moduleId: 1, order: 1 })
      .lean(),
    TopicProgress.find(
      courseFilter(req.courseCode, {
        studentId: req.user._id,
        moduleId: { $in: moduleIds },
      }),
    ).lean(),
    QuestionAttempt.find(
      courseFilter(req.courseCode, {
        studentId: req.user._id,
        status: "submitted",
        moduleId: { $in: moduleIds },
      }),
    )
      .select("moduleId questionId isCorrect timeSpentSec submittedAt")
      .populate("questionId", "title")
      .lean(),
    PracticalAttempt.find(
      courseFilter(req.courseCode, {
        studentId: req.user._id,
        moduleId: { $in: moduleIds },
      }),
    )
      .select(
        "moduleId practicalId isCorrect completedAt submittedAt timeSpentSec executionTimeMs",
      )
      .populate("practicalId", "number prompt")
      .lean(),
    LearningTime.find(
      courseFilter(req.courseCode, { studentId: req.user._id }),
    ).lean(),
    Topic.aggregate([
      {
        $match: courseFilter(req.courseCode, {
          moduleId: { $in: moduleIds },
          isActive: true,
        }),
      },
      { $group: { _id: "$moduleId", count: { $sum: 1 } } },
    ]),
  ]);
  const progressMap = new Map(
    progress.map((row) => [String(row.topicId), row]),
  );
  const topicRows = topics.map((topic) => ({
    ...topic,
    progress: progressMap.get(String(topic._id)) || null,
  }));
  const topicCountMap = new Map(
    topicCounts.map((row) => [String(row._id), row.count]),
  );
  const moduleRows = modules.map((module) => {
    const items = topicRows.filter(
      (topic) => String(topic.moduleId) === String(module._id),
    );
    const completed = items.filter(
      (topic) => topic.progress?.completedAt,
    ).length;
    const moduleTime = times
      .filter((time) => String(time.moduleId) === String(module._id))
      .reduce((sum, time) => sum + time.activeSeconds, 0);
    const total = topicCountMap.get(String(module._id)) || 0;
    return {
      moduleNumber: module.moduleNumber,
      title: module.title,
      totalTopics: total,
      completedTopics: completed,
      percent: total ? Math.round((completed / total) * 100) : 0,
      activeSeconds: moduleTime,
      topics: items,
    };
  });
  res.json({
    courseCode: req.courseCode,
    modules: moduleRows,
    topicRows,
    questionAttempts,
    practicalAttempts,
    times,
  });
}

module.exports = {
  getModules,
  getModule,
  getTopic,
  completeTopic,
  getDashboard,
  getProgress,
  getHallOfFame,
  findModule,
  findTopic,
};

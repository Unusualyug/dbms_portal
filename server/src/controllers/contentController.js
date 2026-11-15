const mongoose = require("mongoose");
const {
  COURSE_CODE,
  getCourse,
  getCourseContent,
} = require("../config/constants");
const Module = require("../models/Module");
const Topic = require("../models/Topic");
const Practical = require("../models/Practical");
const Question = require("../models/Question");
const { courseFilter } = require("../services/courseScope");
const {
  incrementTopicOpened,
  recordActivity,
} = require("../services/activityService");
const HttpError = require("../utils/httpError");

function publicSyllabus(req, res) {
  const course = getCourse(req.courseCode);
  const syllabus = getCourseContent(req.courseCode);
  if (!course || !syllabus) throw new HttpError(404, "Curriculum not found.");
  res.json({ ...syllabus, selectedCourse: course });
}

async function validationSummary(req, res) {
  const courseCode = req.courseCode || COURSE_CODE;
  const course = getCourse(courseCode);
  const syllabus = getCourseContent(courseCode);
  if (!course || !syllabus) throw new HttpError(404, "Curriculum not found.");
  const modules = await Module.find(
    courseFilter(courseCode, { isActive: true }),
  )
    .select("_id moduleNumber title")
    .sort({ moduleNumber: 1 })
    .lean();
  const moduleIds = modules.map((module) => module._id);
  const [topicRows, practicalRows, questions] = await Promise.all([
    Topic.find(
      courseFilter(courseCode, {
        moduleId: { $in: moduleIds },
        isActive: true,
      }),
    )
      .select("moduleId")
      .lean(),
    Practical.find(
      courseFilter(courseCode, {
        moduleId: { $in: moduleIds },
        isActive: true,
      }),
    )
      .select("moduleId")
      .lean(),
    Question.countDocuments(
      courseFilter(courseCode, {
        moduleId: { $in: moduleIds },
        isActive: true,
      }),
    ),
  ]);
  const topicCountByModule = new Map();
  const practicalCountByModule = new Map();
  for (const row of topicRows)
    topicCountByModule.set(
      String(row.moduleId),
      (topicCountByModule.get(String(row.moduleId)) || 0) + 1,
    );
  for (const row of practicalRows)
    practicalCountByModule.set(
      String(row.moduleId),
      (practicalCountByModule.get(String(row.moduleId)) || 0) + 1,
    );
  const expected = {
    modules: syllabus.modules.length,
    topics: syllabus.modules.reduce(
      (sum, module) => sum + module.topics.length,
      0,
    ),
    practicals: syllabus.modules.reduce(
      (sum, module) => sum + module.practicals.length,
      0,
    ),
  };
  const actual = {
    modules: modules.length,
    topics: topicRows.length,
    practicals: practicalRows.length,
    questions,
  };
  const modulesByNumber = new Map(
    syllabus.modules.map((module) => [module.moduleNumber, module]),
  );
  const moduleDetails = modules.map((module) => {
    const manifest = modulesByNumber.get(module.moduleNumber);
    const actualTopics = topicCountByModule.get(String(module._id)) || 0;
    const actualPracticals =
      practicalCountByModule.get(String(module._id)) || 0;
    return {
      id: String(module._id),
      moduleNumber: module.moduleNumber,
      title: module.title,
      expectedTopics: manifest?.topics.length || 0,
      actualTopics,
      expectedPracticals: manifest?.practicals.length || 0,
      actualPracticals,
      sourcePages: manifest?.sourcePages || [],
      valid: Boolean(
        manifest &&
        module.title === manifest.title &&
        actualTopics === manifest.topics.length &&
        actualPracticals === manifest.practicals.length,
      ),
    };
  });
  const checks = {
    modules: actual.modules === expected.modules,
    topics: actual.topics === expected.topics,
    practicals: actual.practicals === expected.practicals,
    moduleOrder: modules.every(
      (module, index) => module.moduleNumber === index + 1,
    ),
    moduleCounts:
      moduleDetails.length === expected.modules &&
      moduleDetails.every((module) => module.valid),
  };
  res.json({
    courseCode,
    course: {
      shortName: course.shortName,
      subjectName: course.subjectName,
      title: course.course.title,
    },
    sourceDescription:
      course.course.sourceFile ||
      (courseCode === COURSE_CODE
        ? "Course_File_DBMS.pdf"
        : "Official course file received by email"),
    expected,
    actual,
    totals: {
      modules: actual.modules,
      topicsImported: actual.topics,
      topicsExpected: expected.topics,
      practicalsImported: actual.practicals,
      practicalsExpected: expected.practicals,
    },
    checks,
    valid: Object.values(checks).every(Boolean),
    modules: moduleDetails,
  });
}

async function publicModules(req, res) {
  const modules = await Module.find(
    courseFilter(req.courseCode, { isActive: true }),
  )
    .sort({ moduleNumber: 1 })
    .lean();
  const moduleIds = modules.map((module) => module._id);
  const [topics, practicals] = await Promise.all([
    Topic.find(
      courseFilter(req.courseCode, {
        moduleId: { $in: moduleIds },
        isActive: true,
      }),
    )
      .sort({ moduleId: 1, order: 1 })
      .lean(),
    Practical.find(
      courseFilter(req.courseCode, {
        moduleId: { $in: moduleIds },
        isActive: true,
      }),
    )
      .sort({ moduleId: 1, number: 1 })
      .lean(),
  ]);
  const topicGroups = new Map();
  const practicalGroups = new Map();
  for (const topic of topics) {
    const id = String(topic.moduleId);
    if (!topicGroups.has(id)) topicGroups.set(id, []);
    topicGroups.get(id).push(topic);
  }
  for (const practical of practicals) {
    const id = String(practical.moduleId);
    if (!practicalGroups.has(id)) practicalGroups.set(id, []);
    practicalGroups.get(id).push(practical);
  }
  res.json({
    courseCode: req.courseCode,
    modules: modules.map((module) => ({
      ...module,
      topics: topicGroups.get(String(module._id)) || [],
      practicals: practicalGroups.get(String(module._id)) || [],
    })),
  });
}

async function moduleDetail(req, res) {
  const query = mongoose.isValidObjectId(req.params.moduleId)
    ? { _id: req.params.moduleId }
    : { slug: req.params.moduleId };
  const module = await Module.findOne(
    courseFilter(req.courseCode, { ...query, isActive: true }),
  ).lean();
  if (!module) throw new HttpError(404, "Module not found.");
  const [topics, practicals, questions] = await Promise.all([
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
    Question.find(
      courseFilter(req.courseCode, { moduleId: module._id, isActive: true }),
    )
      .select("-correctAnswer")
      .sort({ createdAt: 1 })
      .lean(),
  ]);
  res.json({
    courseCode: req.courseCode,
    module: { ...module, topics, practicals, questions },
  });
}

async function topicContent(req, res) {
  const query = mongoose.isValidObjectId(req.params.topicId)
    ? { _id: req.params.topicId }
    : { key: req.params.topicId };
  const topic = await Topic.findOne(
    courseFilter(req.courseCode, { ...query, isActive: true }),
  ).lean();
  if (!topic) throw new HttpError(404, "Topic not found.");
  const module = await Module.findOne(
    courseFilter(req.courseCode, { _id: topic.moduleId, isActive: true }),
  ).lean();
  if (!module) throw new HttpError(404, "Topic not found.");
  await incrementTopicOpened(req.user._id, topic, req.courseCode);
  await recordActivity({
    req,
    eventType: "TOPIC_OPENED",
    moduleId: topic.moduleId,
    topicId: topic._id,
  });
  res.json({ courseCode: req.courseCode, module, topic });
}

module.exports = {
  publicSyllabus,
  validationSummary,
  publicModules,
  moduleDetail,
  topicContent,
};

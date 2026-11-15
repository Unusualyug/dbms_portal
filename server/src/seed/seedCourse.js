require("dotenv").config({
  path: require("path").resolve(__dirname, "../../../.env"),
});
const mongoose = require("mongoose");
const { connectDatabase } = require("../config/database");
const {
  COURSE_CODE,
  COURSE_CODES,
  normalizeCourseCode,
  getCourseContent,
} = require("../config/constants");
const Module = require("../models/Module");
const Topic = require("../models/Topic");
const Practical = require("../models/Practical");
const Question = require("../models/Question");
const { courseFilter } = require("../services/courseScope");
const { buildLesson } = require("./lessonLibrary");

function getQuestionSeed(courseCode) {
  if (courseCode === COURSE_CODE) return require("./practiceQuestions");
  return require("./osPracticeQuestions");
}

async function seedCourse(requestedCourseCode = COURSE_CODE) {
  const courseContent = getCourseContent(requestedCourseCode);
  if (!courseContent)
    throw new Error(`Unsupported course code: ${requestedCourseCode}`);
  const courseCode = courseContent.course.courseCode;
  const questionSeed = getQuestionSeed(courseCode);
  const moduleByNumber = new Map();
  const moduleIds = [];
  const topicKeys = [];
  const practicalKeys = [];

  for (const moduleData of courseContent.modules) {
    const module = await Module.findOneAndUpdate(
      courseFilter(courseCode, { moduleNumber: moduleData.moduleNumber }),
      {
        $set: {
          courseCode,
          slug: moduleData.id,
          title: moduleData.title,
          hours: moduleData.hours,
          weightagePercent: moduleData.weightagePercent,
          sourcePages: moduleData.sourcePages,
          assessments: moduleData.assessments,
          isActive: true,
        },
        $setOnInsert: { moduleNumber: moduleData.moduleNumber },
      },
      { upsert: true, new: true, runValidators: true },
    );
    moduleByNumber.set(moduleData.moduleNumber, module);
    moduleIds.push(module._id);

    for (const [index, topic] of moduleData.topics.entries()) {
      const learning = buildLesson(topic);
      topicKeys.push(topic.id);
      await Topic.findOneAndUpdate(
        courseFilter(courseCode, { key: topic.id }),
        {
          $set: {
            courseCode,
            moduleId: module._id,
            order: index + 1,
            title: topic.title,
            group: topic.group,
            explanation: learning.explanation,
            importantPoints: learning.importantPoints,
            example: learning.example,
            analogy: learning.analogy,
            animationKey: learning.animationKey,
            sourcePages: moduleData.sourcePages,
            isActive: true,
          },
        },
        { upsert: true, new: true, runValidators: true },
      );
    }

    for (const practicalData of moduleData.practicals) {
      const numberWidth = courseCode === COURSE_CODE ? 2 : 3;
      const key = `${moduleData.id}-p${String(practicalData.number).padStart(numberWidth, "0")}`;
      practicalKeys.push(key);
      await Practical.findOneAndUpdate(
        courseFilter(courseCode, { key }),
        {
          $set: {
            courseCode,
            moduleId: module._id,
            number: practicalData.number,
            prompt: practicalData.prompt,
            sourcePage: practicalData.sourcePage,
            sourceWordingUnclear: Boolean(practicalData.sourceWordingUnclear),
            dialect:
              practicalData.dialect ||
              (courseCode === COURSE_CODE ? "oracle" : "bash"),
            validationPolicy:
              courseCode === COURSE_CODE ? "sandbox-required" : "manual-review",
            isActive: true,
          },
        },
        { upsert: true, new: true, runValidators: true },
      );
    }
  }

  // Remove stale syllabus rows only inside this course; do not touch activity or attempts.
  await Module.deleteMany(
    courseFilter(courseCode, {
      moduleNumber: {
        $nin: courseContent.modules.map((module) => module.moduleNumber),
      },
    }),
  );
  await Topic.deleteMany({
    moduleId: { $in: moduleIds },
    key: { $nin: topicKeys },
  });
  await Practical.deleteMany({
    moduleId: { $in: moduleIds },
    key: { $nin: practicalKeys },
  });

  const topicRows = await Topic.find(
    courseFilter(courseCode, { key: { $in: topicKeys } }),
  );
  const topicByKey = new Map(topicRows.map((topic) => [topic.key, topic]));
  const questionKeys = [];
  for (const questionData of questionSeed) {
    const module = moduleByNumber.get(questionData.moduleNumber);
    const topic = topicByKey.get(questionData.topicKey);
    questionKeys.push(questionData.key);
    await Question.findOneAndUpdate(
      courseFilter(courseCode, { key: questionData.key }),
      {
        $set: {
          courseCode,
          moduleId: module._id,
          topicId: topic?._id,
          title: questionData.title,
          prompt: questionData.prompt,
          type: questionData.type,
          options: questionData.options,
          correctAnswer: questionData.correctAnswer,
          explanation: questionData.explanation,
          sourceType: "derived_practice",
          isActive: true,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        select: "+correctAnswer",
      },
    );
  }
  await Question.deleteMany({
    sourceType: "derived_practice",
    moduleId: { $in: moduleIds },
    key: { $nin: questionKeys },
  });

  const result = {
    courseCode,
    modules: courseContent.modules.length,
    topics: topicKeys.length,
    practicals: practicalKeys.length,
    questions: questionKeys.length,
  };
  console.log(
    `Seeded ${result.modules} modules, ${result.topics} topics, ${result.practicals} official practicals, and ${result.questions} labeled derived practice questions for ${courseCode}.`,
  );
  return result;
}

function parseRequestedCourses(argv = process.argv.slice(2)) {
  if (argv.includes("--all")) return [...COURSE_CODES];
  const option = argv.find((value) => value.startsWith("--course="));
  const requested = option?.slice("--course=".length) || COURSE_CODE;
  const normalized = normalizeCourseCode(requested);
  if (!normalized)
    throw new Error(
      `Unknown course "${requested}". Use DBMS, OS, or a supported course code.`,
    );
  return [normalized];
}

if (require.main === module) {
  (async () => {
    try {
      await connectDatabase();
      const results = [];
      for (const courseCode of parseRequestedCourses())
        results.push(await seedCourse(courseCode));
      console.log(results);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect().catch(() => {});
    }
  })();
}

module.exports = { seedCourse, parseRequestedCourses, getQuestionSeed };

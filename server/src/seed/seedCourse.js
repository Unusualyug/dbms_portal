require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const { COURSE_CONTENT, COURSE_CODE } = require('../config/constants');
const Module = require('../models/Module');
const Topic = require('../models/Topic');
const Practical = require('../models/Practical');
const Question = require('../models/Question');
const { buildLesson } = require('./lessonLibrary');
const questionSeed = require('./practiceQuestions');

async function seedCourse() {
  await connectDatabase();
  const moduleByNumber = new Map();
  const moduleIds = [];
  const topicKeys = [];
  const practicalKeys = [];

  for (const moduleData of COURSE_CONTENT.modules) {
    const module = await Module.findOneAndUpdate(
      { courseCode: COURSE_CODE, moduleNumber: moduleData.moduleNumber },
      {
        $set: {
          slug: moduleData.id,
          title: moduleData.title,
          hours: moduleData.hours,
          weightagePercent: moduleData.weightagePercent,
          sourcePages: moduleData.sourcePages,
          assessments: moduleData.assessments,
          isActive: true,
        },
        $setOnInsert: { courseCode: COURSE_CODE, moduleNumber: moduleData.moduleNumber },
      },
      { upsert: true, new: true, runValidators: true },
    );
    moduleByNumber.set(moduleData.moduleNumber, module);
    moduleIds.push(module._id);

    for (const [index, topic] of moduleData.topics.entries()) {
      const learning = buildLesson(topic);
      topicKeys.push(topic.id);
      await Topic.findOneAndUpdate(
        { key: topic.id },
        { $set: {
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
        } },
        { upsert: true, new: true, runValidators: true },
      );
    }

    for (const practicalData of moduleData.practicals) {
      const key = `${moduleData.id}-p${String(practicalData.number).padStart(2, '0')}`;
      practicalKeys.push(key);
      await Practical.findOneAndUpdate(
        { key },
        { $set: {
          moduleId: module._id,
          number: practicalData.number,
          prompt: practicalData.prompt,
          sourcePage: practicalData.sourcePage,
          sourceWordingUnclear: Boolean(practicalData.sourceWordingUnclear),
          dialect: 'oracle',
          validationPolicy: 'sandbox-required',
          isActive: true,
        } },
        { upsert: true, new: true, runValidators: true },
      );
    }
  }

  // Remove stale syllabus rows only inside this course; do not touch activity or attempts.
  await Module.deleteMany({ courseCode: COURSE_CODE, moduleNumber: { $nin: COURSE_CONTENT.modules.map((m) => m.moduleNumber) } });
  await Topic.deleteMany({ moduleId: { $in: moduleIds }, key: { $nin: topicKeys } });
  await Practical.deleteMany({ moduleId: { $in: moduleIds }, key: { $nin: practicalKeys } });

  const topicByKey = new Map((await Topic.find({ key: { $in: topicKeys } })).map((topic) => [topic.key, topic]));
  const questionKeys = [];
  for (const q of questionSeed) {
    const module = moduleByNumber.get(q.moduleNumber);
    const topic = topicByKey.get(q.topicKey);
    questionKeys.push(q.key);
    await Question.findOneAndUpdate(
      { key: q.key },
      { $set: {
        moduleId: module._id,
        topicId: topic?._id,
        title: q.title,
        prompt: q.prompt,
        type: q.type,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        sourceType: 'derived_practice',
        isActive: true,
      } },
      { upsert: true, new: true, runValidators: true, select: '+correctAnswer' },
    );
  }
  await Question.deleteMany({ sourceType: 'derived_practice', key: { $nin: questionKeys } });

  console.log(`Seeded ${COURSE_CONTENT.modules.length} modules, ${topicKeys.length} topics, ${practicalKeys.length} official practicals, and ${questionKeys.length} labeled derived practice questions.`);
  return { modules: COURSE_CONTENT.modules.length, topics: topicKeys.length, practicals: practicalKeys.length, questions: questionKeys.length };
}

if (require.main === module) {
  seedCourse().then((result) => {
    console.log(result);
    return mongoose.disconnect();
  }).catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { seedCourse };

const { COURSE_CONTENT, COURSE_CODE } = require('../config/constants');
const Module = require('../models/Module');
const Topic = require('../models/Topic');
const Practical = require('../models/Practical');
const Question = require('../models/Question');

async function publicSyllabus(req, res) {
  res.json({ course: COURSE_CONTENT.course, modules: COURSE_CONTENT.modules.map((module) => ({
    moduleNumber: module.moduleNumber,
    id: module.id,
    title: module.title,
    hours: module.hours,
    weightagePercent: module.weightagePercent,
    topics: module.topics,
    practicals: module.practicals,
    assessments: module.assessments,
  })) });
}

async function validationSummary(req, res) {
  const manifest = COURSE_CONTENT.modules;
  const modules = await Module.find({ courseCode: COURSE_CODE }).sort({ moduleNumber: 1 }).lean();
  const report = [];
  for (const expected of manifest) {
    const actualModule = modules.find((item) => item.moduleNumber === expected.moduleNumber);
    const [topicCount, practicalCount, questionCount] = actualModule
      ? await Promise.all([
          Topic.countDocuments({ moduleId: actualModule._id, isActive: true }),
          Practical.countDocuments({ moduleId: actualModule._id, isActive: true }),
          Question.countDocuments({ moduleId: actualModule._id, isActive: true }),
        ])
      : [0, 0, 0];
    report.push({
      moduleNumber: expected.moduleNumber,
      title: expected.title,
      expectedTopics: expected.topics.length,
      actualTopics: topicCount,
      expectedPracticals: expected.practicals.length,
      actualPracticals: practicalCount,
      practiceQuestionCount: questionCount,
      sourcePages: expected.sourcePages,
      valid: Boolean(actualModule && topicCount === expected.topics.length && practicalCount === expected.practicals.length),
    });
  }
  res.json({
    courseCode: COURSE_CODE,
    sourceFile: 'Course_File_DBMS.pdf',
    modules: report,
    totals: {
      modules: report.length,
      topicsExpected: report.reduce((sum, row) => sum + row.expectedTopics, 0),
      topicsImported: report.reduce((sum, row) => sum + row.actualTopics, 0),
      practicalsExpected: report.reduce((sum, row) => sum + row.expectedPracticals, 0),
      practicalsImported: report.reduce((sum, row) => sum + row.actualPracticals, 0),
    },
    valid: report.every((row) => row.valid),
    sourceWordingNote: 'Module 1 Practical 12 is flagged because the scan wording is internally inconsistent; see the validation report.',
  });
}

module.exports = { publicSyllabus, validationSummary };

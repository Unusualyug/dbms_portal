require("dotenv").config({
  path: require("path").resolve(__dirname, "../../../.env"),
});
const mongoose = require("mongoose");
const { connectDatabase } = require("../config/database");
const Module = require("../models/Module");
const Topic = require("../models/Topic");
const Practical = require("../models/Practical");
const Question = require("../models/Question");
const TopicProgress = require("../models/TopicProgress");
const QuestionAttempt = require("../models/QuestionAttempt");
const PracticalAttempt = require("../models/PracticalAttempt");
const PracticeArenaAttempt = require("../models/PracticeArenaAttempt");
const ActivityLog = require("../models/ActivityLog");
const LearningTime = require("../models/LearningTime");
const LearningTimer = require("../models/LearningTimer");
const ModuleManualProgress = require("../models/ModuleManualProgress");
const ExamAssessment = require("../models/ExamAssessment");
const ExamResult = require("../models/ExamResult");
const SupportMessage = require("../models/SupportMessage");
const { COURSE_CODE } = require("../config/constants");

const MODELS = [
  Module,
  Topic,
  Practical,
  Question,
  TopicProgress,
  QuestionAttempt,
  PracticalAttempt,
  PracticeArenaAttempt,
  ActivityLog,
  LearningTime,
  LearningTimer,
  ModuleManualProgress,
  ExamAssessment,
  ExamResult,
  SupportMessage,
];
const LEGACY_COURSE_CODE_FILTER = {
  $or: [{ courseCode: { $exists: false } }, { courseCode: null }],
};

// These exact old unique keys prevent same-numbered modules/assessments in a second course.
// Other existing indexes are preserved. Untagged legacy rows are backfilled as DBMS only.
const OBSOLETE_UNIQUE_KEYS = new Map([
  [Module, [{ moduleNumber: 1 }]],
  [TopicProgress, [{ studentId: 1, topicId: 1 }]],
  [QuestionAttempt, [{ studentId: 1, questionId: 1, attemptNumber: 1 }]],
  [PracticalAttempt, [{ studentId: 1, practicalId: 1, attemptNumber: 1 }]],
  [PracticeArenaAttempt, [{ studentId: 1, challengeId: 1, attemptNumber: 1 }]],
  [
    ExamAssessment,
    [
      {
        assessmentType: 1,
        title: 1,
        academicYear: 1,
        semester: 1,
        classSection: 1,
      },
    ],
  ],
  [ExamResult, [{ assessmentId: 1, studentId: 1 }]],
]);

function sameIndexKey(actual, expected) {
  const actualEntries = Object.entries(actual || {}).filter(
    ([key]) => key !== "_id",
  );
  const expectedEntries = Object.entries(expected);
  return (
    actualEntries.length === expectedEntries.length &&
    expectedEntries.every(([key, direction]) => actual[key] === direction)
  );
}

async function migrationPlan() {
  const indexesToDrop = [];
  const indexesToEnsure = [];
  const legacyCourseCodeCounts = [];
  for (const model of MODELS) {
    const existing = await model.collection.indexes().catch((error) => {
      if (error.code === 26 || error.codeName === "NamespaceNotFound")
        return [];
      throw error;
    });
    const legacyCount = await model.collection
      .countDocuments(LEGACY_COURSE_CODE_FILTER)
      .catch((error) => {
        if (error.code === 26 || error.codeName === "NamespaceNotFound")
          return 0;
        throw error;
      });
    legacyCourseCodeCounts.push({ model, count: legacyCount });
    const obsoleteKeys = OBSOLETE_UNIQUE_KEYS.get(model) || [];
    for (const index of existing) {
      if (
        index.unique &&
        obsoleteKeys.some((key) => sameIndexKey(index.key, key))
      ) {
        indexesToDrop.push({ model, name: index.name, key: index.key });
      }
    }
    for (const [key, options] of model.schema.indexes()) {
      indexesToEnsure.push({ model, key, options });
    }
  }
  return { indexesToDrop, indexesToEnsure, legacyCourseCodeCounts };
}

async function run({ apply = false } = {}) {
  if (apply && process.env.COURSE_MIGRATION_ACK !== "backup-tested") {
    throw new Error(
      "Refusing to apply migration. First back up production and test the restore/migration on staging, then set COURSE_MIGRATION_ACK=backup-tested.",
    );
  }
  await connectDatabase();
  try {
    const { indexesToDrop, indexesToEnsure, legacyCourseCodeCounts } =
      await migrationPlan();
    console.log(`Course-index migration plan (${apply ? "APPLY" : "DRY RUN"})`);
    console.log(
      `Target collections: ${MODELS.map((model) => model.collection.collectionName).join(", ")}`,
    );
    console.log(
      "Legacy records to tag as DBMS:",
      legacyCourseCodeCounts
        .filter(({ count }) => count > 0)
        .map(({ model, count }) => ({
          collection: model.collection.collectionName,
          count,
        })),
    );
    console.log(
      "Obsolete unique indexes to drop:",
      indexesToDrop.map(({ model, name, key }) => ({
        collection: model.collection.collectionName,
        name,
        key,
      })),
    );
    console.log(
      `Indexes to ensure from current schemas: ${indexesToEnsure.length}`,
    );
    if (!apply) {
      console.log(
        "Dry run only. No index or document was changed. Re-run with --apply and COURSE_MIGRATION_ACK=backup-tested only after a verified backup and staging test.",
      );
      return {
        applied: false,
        indexesToDrop: indexesToDrop.length,
        indexesToEnsure: indexesToEnsure.length,
        legacyRowsToTag: legacyCourseCodeCounts.reduce(
          (sum, row) => sum + row.count,
          0,
        ),
      };
    }
    let legacyRowsTagged = 0;
    for (const { model, count } of legacyCourseCodeCounts) {
      if (!count) continue;
      const result = await model.collection.updateMany(
        LEGACY_COURSE_CODE_FILTER,
        { $set: { courseCode: COURSE_CODE } },
      );
      legacyRowsTagged += Number(result.modifiedCount) || 0;
    }
    for (const { model, name } of indexesToDrop)
      await model.collection.dropIndex(name);
    for (const model of MODELS) await model.createIndexes();
    console.log(
      `Course indexes applied; tagged ${legacyRowsTagged} legacy DBMS records. No progress values, attempts, scores, marks, points, support content, or account records were deleted or reset.`,
    );
    return {
      applied: true,
      indexesToDrop: indexesToDrop.length,
      indexesToEnsure: indexesToEnsure.length,
      legacyRowsTagged,
    };
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

if (require.main === module) {
  run({ apply: process.argv.includes("--apply") }).catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
    mongoose.disconnect().catch(() => {});
  });
}

module.exports = {
  MODELS,
  OBSOLETE_UNIQUE_KEYS,
  LEGACY_COURSE_CODE_FILTER,
  sameIndexKey,
  migrationPlan,
  run,
};

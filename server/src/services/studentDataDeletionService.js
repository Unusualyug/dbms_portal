const LearningTimer = require("../models/LearningTimer");
const Session = require("../models/Session");
const TopicProgress = require("../models/TopicProgress");
const QuestionAttempt = require("../models/QuestionAttempt");
const PracticalAttempt = require("../models/PracticalAttempt");
const PracticeArenaAttempt = require("../models/PracticeArenaAttempt");
const ModuleManualProgress = require("../models/ModuleManualProgress");
const LearningTime = require("../models/LearningTime");
const ActivityLog = require("../models/ActivityLog");
const ExamResult = require("../models/ExamResult");
const SupportMessage = require("../models/SupportMessage");

// Timer.js is an alias of LearningTimer.js, so there is only one timer collection.
const STUDENT_DATA_COLLECTIONS = Object.freeze([
  Object.freeze({ name: "learningTimers", model: LearningTimer }),
  Object.freeze({ name: "sessions", model: Session }),
  Object.freeze({ name: "topicProgress", model: TopicProgress }),
  Object.freeze({ name: "questionAttempts", model: QuestionAttempt }),
  Object.freeze({ name: "officialPracticalAttempts", model: PracticalAttempt }),
  Object.freeze({ name: "practiceArenaAttempts", model: PracticeArenaAttempt }),
  Object.freeze({ name: "moduleManualProgress", model: ModuleManualProgress }),
  Object.freeze({ name: "learningTime", model: LearningTime }),
  Object.freeze({ name: "activityLogs", model: ActivityLog }),
  Object.freeze({ name: "examResults", model: ExamResult }),
  Object.freeze({ name: "supportMessages", model: SupportMessage }),
]);

/** Delete every persisted student-owned record. Running it again is safe if a previous
 * attempt stopped partway through: deleteMany is idempotent for the same student ID. */
async function deleteStudentData(
  studentId,
  collections = STUDENT_DATA_COLLECTIONS,
) {
  const deletedCounts = {};
  for (const { name, model } of collections) {
    const result = await model.deleteMany({ studentId });
    deletedCounts[name] = Number(result.deletedCount) || 0;
  }
  return deletedCounts;
}

module.exports = { STUDENT_DATA_COLLECTIONS, deleteStudentData };

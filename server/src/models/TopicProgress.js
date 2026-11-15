const mongoose = require("mongoose");

const topicProgressSchema = new mongoose.Schema(
  {
    courseCode: { type: String, required: true, trim: true, index: true },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
      required: true,
      index: true,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
      required: true,
      index: true,
    },
    openedCount: { type: Number, default: 0 },
    firstOpenedAt: { type: Date, default: null },
    lastOpenedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    timeSpentSec: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);
topicProgressSchema.index(
  { studentId: 1, courseCode: 1, topicId: 1 },
  { unique: true, name: "unique_topic_progress_per_student_course_topic" },
);
topicProgressSchema.index({ moduleId: 1, completedAt: 1 });

module.exports = mongoose.model("TopicProgress", topicProgressSchema);

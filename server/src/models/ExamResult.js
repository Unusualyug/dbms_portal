const mongoose = require("mongoose");

const subjectMarkSchema = new mongoose.Schema(
  {
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
    marksObtained: { type: Number, required: true, min: 0, max: 10000 },
  },
  { _id: false },
);

const examResultSchema = new mongoose.Schema(
  {
    courseCode: { type: String, required: true, trim: true, index: true },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamAssessment",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    marks: { type: [subjectMarkSchema], default: [] },
    publishedAt: { type: Date, default: null, index: true },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

examResultSchema.index(
  { courseCode: 1, assessmentId: 1, studentId: 1 },
  { unique: true, name: "one_exam_result_per_course_assessment_student" },
);
examResultSchema.index({ studentId: 1, courseCode: 1, updatedAt: -1 });

module.exports = mongoose.model("ExamResult", examResultSchema);

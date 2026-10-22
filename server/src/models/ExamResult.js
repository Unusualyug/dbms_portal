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
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

examResultSchema.index(
  { assessmentId: 1, studentId: 1 },
  { unique: true, name: "one_exam_result_per_student_assessment" },
);
examResultSchema.index({ studentId: 1, updatedAt: -1 });

module.exports = mongoose.model("ExamResult", examResultSchema);

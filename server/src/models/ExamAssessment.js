const mongoose = require("mongoose");

const assessmentSubjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    maxMarks: { type: Number, required: true, min: 0.01, max: 10000 },
  },
  { _id: true },
);

const examAssessmentSchema = new mongoose.Schema(
  {
    assessmentType: {
      type: String,
      enum: ["session1", "session2", "ala"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    academicYear: { type: String, required: true, trim: true, maxlength: 9 },
    semester: { type: Number, enum: [3, 5], required: true, index: true },
    classSection: {
      type: String,
      enum: ["X1", "X2", "Y1", "Y2"],
      required: true,
      index: true,
    },
    subjects: {
      type: [assessmentSubjectSchema],
      required: true,
      validate: [
        (rows) => rows.length > 0,
        "At least one subject is required.",
      ],
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      required: true,
      index: true,
    },
    publishedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

examAssessmentSchema.index(
  {
    assessmentType: 1,
    title: 1,
    academicYear: 1,
    semester: 1,
    classSection: 1,
  },
  { unique: true, name: "unique_exam_assessment_per_cohort" },
);
examAssessmentSchema.index({
  semester: 1,
  classSection: 1,
  status: 1,
  academicYear: -1,
});

module.exports = mongoose.model("ExamAssessment", examAssessmentSchema);

const mongoose = require("mongoose");

const moduleManualProgressSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
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
    moduleManualStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
      required: true,
    },
    completedPracticals: { type: Number, default: 0, min: 0 },
    totalPracticals: { type: Number, default: 0, min: 0 },
    completedAt: { type: Date, default: null },
    completionEmailStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: null,
    },
    completionEmailQueuedAt: { type: Date, default: null },
    completionEmailAttempts: { type: Number, min: 0, default: 0 },
    completionEmailLastAttemptAt: { type: Date, default: null },
    completionEmailNextAttemptAt: { type: Date, default: null },
    completionEmailSentAt: { type: Date, default: null },
    completionEmailLastError: {
      type: String,
      maxlength: 120,
      default: null,
      select: false,
    },
  },
  { timestamps: true, versionKey: false },
);

moduleManualProgressSchema.index(
  { studentId: 1, moduleId: 1 },
  { unique: true },
);
moduleManualProgressSchema.index({ moduleId: 1, moduleManualStatus: 1 });
moduleManualProgressSchema.index({
  moduleManualStatus: 1,
  completionEmailStatus: 1,
  completionEmailNextAttemptAt: 1,
});

module.exports = mongoose.model(
  "ModuleManualProgress",
  moduleManualProgressSchema,
);

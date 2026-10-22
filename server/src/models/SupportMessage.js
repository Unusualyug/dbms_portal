const mongoose = require("mongoose");

const supportMessageSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["question", "suggestion"],
      required: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    status: {
      type: String,
      enum: ["open", "replied"],
      default: "open",
      required: true,
      index: true,
    },
    reply: { type: String, trim: true, maxlength: 4000, default: "" },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    repliedAt: { type: Date, default: null },
    replyEmailStatus: {
      type: String,
      enum: ["not-applicable", "pending", "sending", "sent", "failed"],
      default: "not-applicable",
      index: true,
    },
    replyEmailAttempts: { type: Number, min: 0, default: 0 },
    replyEmailLastAttemptAt: { type: Date, default: null },
    replyEmailNextAttemptAt: { type: Date, default: null },
    replyEmailSentAt: { type: Date, default: null },
    replyEmailLastError: {
      type: String,
      maxlength: 120,
      default: null,
      select: false,
    },
  },
  { timestamps: true, versionKey: false },
);

supportMessageSchema.index({ studentId: 1, createdAt: -1 });
supportMessageSchema.index({ status: 1, createdAt: 1 });
supportMessageSchema.index({ replyEmailStatus: 1, replyEmailNextAttemptAt: 1 });

module.exports = mongoose.model("SupportMessage", supportMessageSchema);

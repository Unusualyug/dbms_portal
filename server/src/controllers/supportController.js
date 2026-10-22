const mongoose = require("mongoose");
const SupportMessage = require("../models/SupportMessage");
const HttpError = require("../utils/httpError");
const {
  normalizeSupportSubmission,
  normalizeSupportReply,
} = require("../services/supportMessageValidation");
const {
  triggerSupportReplyEmail,
} = require("../services/supportReplyEmailService");

const ADMIN_INBOX_LIMIT = 100;
const STUDENT_THREAD_LIMIT = 50;
const EMAIL_STATUSES = [
  "not-applicable",
  "pending",
  "sending",
  "sent",
  "failed",
];

function assertObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new HttpError(400, "Invalid support request ID.");
}

function toId(value) {
  if (!value) return null;
  return String(value._id || value);
}

function mapStudentMessage(row) {
  return {
    id: toId(row._id),
    category: row.category,
    subject: row.subject,
    message: row.message,
    status: row.status,
    reply: row.reply || "",
    repliedAt: row.repliedAt || null,
    replyEmailStatus: EMAIL_STATUSES.includes(row.replyEmailStatus)
      ? row.replyEmailStatus
      : "pending",
    replyEmailSentAt: row.replyEmailSentAt || null,
    createdAt: row.createdAt,
  };
}

function buildSupportMessageDeleteFilter(id) {
  return {
    _id: id,
    $or: [{ status: "open" }, { status: "replied", replyEmailStatus: "sent" }],
  };
}

function mapAdminMessage(row) {
  const studentRecord =
    row.studentId && typeof row.studentId === "object" ? row.studentId : null;
  return {
    ...mapStudentMessage(row),
    replyEmailAttempts: Number(row.replyEmailAttempts) || 0,
    student: studentRecord
      ? {
          id: toId(studentRecord._id),
          name: studentRecord.name || "Student",
          email: studentRecord.email || "",
          studentId: studentRecord.studentId || "",
          semester: studentRecord.semester || null,
          classSection: studentRecord.classSection || "",
        }
      : null,
  };
}

async function listStudentSupportMessages(req, res) {
  const rows = await SupportMessage.find({ studentId: req.user._id })
    .select(
      "category subject message status reply repliedAt replyEmailStatus replyEmailSentAt createdAt",
    )
    .sort({ createdAt: -1 })
    .limit(STUDENT_THREAD_LIMIT)
    .lean();
  res.json({ messages: rows.map(mapStudentMessage) });
}

async function createStudentSupportMessage(req, res) {
  const input = normalizeSupportSubmission(req.body);
  const message = await SupportMessage.create({
    studentId: req.user._id,
    ...input,
  });
  res.status(201).json({ message: mapStudentMessage(message.toObject()) });
}

async function listAdminSupportMessages(req, res) {
  const requestedStatus = String(req.query.status || "all").toLowerCase();
  if (!["all", "open", "replied"].includes(requestedStatus)) {
    throw new HttpError(400, "Unsupported support inbox filter.");
  }
  const filter = requestedStatus === "all" ? {} : { status: requestedStatus };
  const [rows, openCount, repliedCount, total] = await Promise.all([
    SupportMessage.find(filter)
      .select(
        "studentId category subject message status reply repliedAt replyEmailStatus replyEmailSentAt replyEmailAttempts createdAt updatedAt",
      )
      .populate("studentId", "name email studentId semester classSection")
      .sort({ createdAt: -1 })
      .limit(ADMIN_INBOX_LIMIT)
      .lean(),
    SupportMessage.countDocuments({ status: "open" }),
    SupportMessage.countDocuments({ status: "replied" }),
    SupportMessage.countDocuments(filter),
  ]);
  res.json({
    messages: rows.map(mapAdminMessage),
    counts: { open: openCount, replied: repliedCount, total },
    limit: ADMIN_INBOX_LIMIT,
  });
}

async function replyToSupportMessage(req, res) {
  assertObjectId(req.params.id);
  const reply = normalizeSupportReply(req.body);
  const message = await SupportMessage.findOneAndUpdate(
    { _id: req.params.id, status: "open" },
    {
      $set: {
        status: "replied",
        reply,
        repliedBy: req.user._id,
        repliedAt: new Date(),
        replyEmailStatus: "pending",
        replyEmailAttempts: 0,
        replyEmailLastAttemptAt: null,
        replyEmailNextAttemptAt: null,
        replyEmailSentAt: null,
        replyEmailLastError: null,
      },
    },
    { new: true, runValidators: true },
  )
    .populate("studentId", "name email studentId semester classSection")
    .lean();

  if (!message) {
    const exists = await SupportMessage.exists({ _id: req.params.id });
    if (!exists) throw new HttpError(404, "Support request not found.");
    throw new HttpError(409, "This request has already been replied to.");
  }

  res.json({ message: mapAdminMessage(message) });
  triggerSupportReplyEmail(message._id);
}

async function retrySupportReplyEmail(req, res) {
  assertObjectId(req.params.id);
  const message = await SupportMessage.findOneAndUpdate(
    { _id: req.params.id, status: "replied", replyEmailStatus: "failed" },
    {
      $set: {
        replyEmailStatus: "pending",
        replyEmailAttempts: 0,
        replyEmailLastAttemptAt: null,
        replyEmailNextAttemptAt: null,
        replyEmailLastError: null,
      },
    },
    { new: true, runValidators: true },
  )
    .populate("studentId", "name email studentId semester classSection")
    .lean();
  if (!message) {
    const existing = await SupportMessage.findById(req.params.id)
      .select("status replyEmailStatus")
      .lean();
    if (!existing) throw new HttpError(404, "Support request not found.");
    throw new HttpError(409, "Only a failed reply email can be retried.");
  }
  res.json({ message: mapAdminMessage(message) });
  triggerSupportReplyEmail(message._id);
}

async function deleteSupportMessage(req, res) {
  assertObjectId(req.params.id);
  const deleted = await SupportMessage.findOneAndDelete(
    buildSupportMessageDeleteFilter(req.params.id),
  )
    .select("_id")
    .lean();
  if (!deleted) {
    const exists = await SupportMessage.exists({ _id: req.params.id });
    if (!exists) throw new HttpError(404, "Support request not found.");
    throw new HttpError(
      409,
      "Resend has not accepted the reply email yet. Keep this request and retry or wait before deleting it.",
    );
  }
  res.json({ deleted: true, id: req.params.id });
}

module.exports = {
  listStudentSupportMessages,
  createStudentSupportMessage,
  listAdminSupportMessages,
  replyToSupportMessage,
  retrySupportReplyEmail,
  deleteSupportMessage,
  mapStudentMessage,
  mapAdminMessage,
  buildSupportMessageDeleteFilter,
};

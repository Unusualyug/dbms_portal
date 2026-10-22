const SupportMessage = require("../models/SupportMessage");
const User = require("../models/User");

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
const STALE_SENDING_MS = 5 * 60_000;
const QUEUE_BATCH_SIZE = 20;
let workerTimer = null;
let workerRunning = false;

function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

function escapeHtml(value) {
  return String(value || "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function buildSupportReplyEmail({ student, supportMessage }) {
  if (!student?.email || !supportMessage?.subject || !supportMessage?.reply) {
    throw new Error("support_reply_email_data_missing");
  }
  const displayName = String(student.name || "Student");
  const subject = `Reply to your support request: ${String(supportMessage.subject).slice(0, 120)}`;
  const text = [
    `Hello ${displayName},`,
    "",
    `The GMIU DBMS Learning Portal admin replied to your ${supportMessage.category || "support"} request:`,
    `Subject: ${supportMessage.subject}`,
    "",
    String(supportMessage.reply),
    "",
    "You can also view this reply in the Contact & Support section of your portal.",
    "",
    "GMIU DBMS Learning Portal",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f6fa;font-family:Arial,sans-serif;color:#1c2634"><div style="max-width:600px;margin:0 auto;padding:28px;background:#fff;border:1px solid #e4eaf0;border-radius:16px"><p style="margin:0 0 12px;color:#08796f;font-size:12px;font-weight:700;letter-spacing:.12em">GMIU · DBMS LEARNING PORTAL</p><h1 style="margin:0 0 12px;font-size:22px">A reply to your support request</h1><p style="line-height:1.6">Hello ${escapeHtml(displayName)},</p><p style="line-height:1.6">Our admin replied to your <b>${escapeHtml(supportMessage.category || "support")}</b> request, <b>${escapeHtml(supportMessage.subject)}</b>:</p><div style="margin:20px 0;padding:16px;background:#f5f8fb;border-left:3px solid #08796f;border-radius:8px;line-height:1.65;white-space:pre-wrap">${escapeHtml(supportMessage.reply)}</div><p style="color:#657487;font-size:13px;line-height:1.6">You can also view this reply in the Contact &amp; Support section of your portal.</p></div></body></html>`;
  return {
    from: process.env.RESEND_FROM_EMAIL,
    to: [student.email],
    subject,
    text,
    html,
  };
}

async function sendSupportReplyEmail({ student, supportMessage }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !process.env.RESEND_FROM_EMAIL)
    throw new Error("resend_not_configured");
  const email = buildSupportReplyEmail({ student, supportMessage });
  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `support-reply/${String(supportMessage._id)}`,
    },
    body: JSON.stringify(email),
  });
  if (!response.ok) {
    const error = new Error(`resend_http_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json().catch(() => ({}));
}

function nextRetryAt(attempts, now = new Date()) {
  if (attempts >= MAX_ATTEMPTS) return null;
  const delay =
    RETRY_DELAYS_MS[
      Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MS.length - 1)
    ];
  return new Date(now.getTime() + delay);
}

async function markPermanentFailure(messageId, errorCode) {
  await SupportMessage.updateOne(
    { _id: messageId, replyEmailStatus: "sending" },
    {
      $set: {
        replyEmailStatus: "failed",
        replyEmailAttempts: MAX_ATTEMPTS,
        replyEmailNextAttemptAt: null,
        replyEmailLastError: String(
          errorCode || "support_email_data_unavailable",
        ).slice(0, 120),
      },
    },
  );
  return "failed";
}

async function processSupportReplyEmail(messageId) {
  if (!isResendConfigured()) return "unconfigured";
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_SENDING_MS);
  const claimed = await SupportMessage.findOneAndUpdate(
    {
      _id: String(messageId),
      status: "replied",
      $or: [
        { replyEmailStatus: "pending" },
        {
          replyEmailStatus: "failed",
          replyEmailAttempts: { $lt: MAX_ATTEMPTS },
          replyEmailNextAttemptAt: { $lte: now },
        },
        {
          replyEmailStatus: "sending",
          replyEmailAttempts: { $lt: MAX_ATTEMPTS },
          replyEmailLastAttemptAt: { $lte: staleCutoff },
        },
      ],
    },
    {
      $set: {
        replyEmailStatus: "sending",
        replyEmailLastAttemptAt: now,
        replyEmailNextAttemptAt: null,
        replyEmailLastError: null,
      },
      $inc: { replyEmailAttempts: 1 },
    },
    { new: true },
  );
  if (!claimed) return "not-queued";

  const attempts = claimed.replyEmailAttempts || 1;
  try {
    const student = await User.findById(claimed.studentId)
      .select("name email role isActive")
      .lean();
    if (
      !student ||
      student.role !== "student" ||
      !student.isActive ||
      !student.email
    ) {
      return await markPermanentFailure(
        claimed._id,
        "student_or_saved_email_unavailable",
      );
    }
    await sendSupportReplyEmail({ student, supportMessage: claimed });
    await SupportMessage.updateOne(
      { _id: claimed._id, replyEmailStatus: "sending" },
      {
        $set: {
          replyEmailStatus: "sent",
          replyEmailSentAt: new Date(),
          replyEmailNextAttemptAt: null,
          replyEmailLastError: null,
        },
      },
    );
    return "sent";
  } catch (error) {
    const retryAt = nextRetryAt(attempts);
    const errorCode = String(error.message || "email_send_failed").slice(
      0,
      120,
    );
    await SupportMessage.updateOne(
      { _id: claimed._id, replyEmailStatus: "sending" },
      {
        $set: {
          replyEmailStatus: "failed",
          replyEmailNextAttemptAt: retryAt,
          replyEmailLastError: errorCode,
        },
      },
    );
    console.error(
      `Support reply email failed for message ${claimed._id} (attempt ${attempts}/${MAX_ATTEMPTS}): ${errorCode}`,
    );
    return "failed";
  }
}

async function processDueSupportReplyEmails() {
  if (workerRunning || !isResendConfigured()) return 0;
  workerRunning = true;
  try {
    const now = new Date();
    const staleCutoff = new Date(now.getTime() - STALE_SENDING_MS);
    const dueRows = await SupportMessage.find({
      status: "replied",
      $or: [
        { replyEmailStatus: "pending" },
        {
          replyEmailStatus: "failed",
          replyEmailAttempts: { $lt: MAX_ATTEMPTS },
          replyEmailNextAttemptAt: { $lte: now },
        },
        {
          replyEmailStatus: "sending",
          replyEmailAttempts: { $lt: MAX_ATTEMPTS },
          replyEmailLastAttemptAt: { $lte: staleCutoff },
        },
      ],
    })
      .select("_id")
      .sort({ updatedAt: 1 })
      .limit(QUEUE_BATCH_SIZE)
      .lean();
    let processed = 0;
    for (const row of dueRows) {
      await processSupportReplyEmail(row._id);
      processed += 1;
    }
    return processed;
  } finally {
    workerRunning = false;
  }
}

function triggerSupportReplyEmail(messageId) {
  setImmediate(() => {
    processSupportReplyEmail(messageId).catch((error) => {
      console.error(
        `Could not process support reply email for message ${messageId}:`,
        error.message,
      );
    });
  });
}

function startSupportReplyEmailWorker() {
  if (workerTimer) return workerTimer;
  const tick = () =>
    processDueSupportReplyEmails().catch((error) => {
      console.error("Support reply email queue worker failed:", error.message);
    });
  tick();
  workerTimer = setInterval(tick, 60_000);
  workerTimer.unref?.();
  return workerTimer;
}

module.exports = {
  buildSupportReplyEmail,
  sendSupportReplyEmail,
  processSupportReplyEmail,
  processDueSupportReplyEmails,
  triggerSupportReplyEmail,
  startSupportReplyEmailWorker,
};

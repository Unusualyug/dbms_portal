const ModuleManualProgress = require("../models/ModuleManualProgress");
const User = require("../models/User");
const Module = require("../models/Module");
const {
  buildStableMessageId,
  isEmailConfigured,
  getEmailFromAddress,
  sendEmail,
} = require("./gmailApiMailer");
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
const STALE_SENDING_MS = 5 * 60_000;
const QUEUE_BATCH_SIZE = 20;
let workerTimer = null;
let workerRunning = false;

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

function getPortalModuleUrl(slug) {
  const clientUrl = (process.env.CLIENT_URL || "").split(",")[0].trim();
  let base;
  try {
    base = new URL(clientUrl);
  } catch {
    throw new Error("portal_url_not_configured");
  }
  if (!["http:", "https:"].includes(base.protocol))
    throw new Error("portal_url_not_configured");
  return new URL(
    `/student/modules/${encodeURIComponent(String(slug || ""))}`,
    base,
  ).toString();
}

function buildModuleCompletionEmail({ student, module, progress }) {
  if (
    !student?.email ||
    !module?.moduleNumber ||
    !module?.title ||
    !module?.slug
  ) {
    throw new Error("module_completion_email_data_missing");
  }
  const moduleLabel = `Module ${module.moduleNumber} · ${module.title}`;
  const completedCount = Math.min(
    Number(progress?.completedPracticals) || 0,
    Number(progress?.totalPracticals) || 0,
  );
  const totalCount = Number(progress?.totalPracticals) || 0;
  if (!totalCount || completedCount < totalCount)
    throw new Error("module_practicals_not_all_approved");
  const displayName = String(student.name || "Student");
  const safeName = escapeHtml(displayName);
  const safeModuleLabel = escapeHtml(moduleLabel);
  const moduleUrl = getPortalModuleUrl(module.slug);
  const safeModuleUrl = escapeHtml(moduleUrl);
  const subject = `Congratulations! You completed ${moduleLabel}`;
  const text = [
    `Hello ${displayName},`,
    "",
    `Congratulations! All ${totalCount} official practicals for ${moduleLabel} have been reviewed and approved.`,
    "",
    `Continue learning: ${moduleUrl}`,
    "",
    "GMIU DBMS Learning Portal",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f6fa;font-family:Arial,sans-serif;color:#1c2634"><div style="max-width:600px;margin:0 auto;padding:28px;background:#fff;border:1px solid #e4eaf0;border-radius:16px"><p style="margin:0 0 12px;color:#08796f;font-size:12px;font-weight:700;letter-spacing:.12em">GMIU · DBMS LEARNING PORTAL</p><h1 style="margin:0 0 12px;font-size:24px">Module completed!</h1><p style="line-height:1.6">Hello ${safeName},</p><p style="line-height:1.6">Congratulations! All <b>${totalCount} of ${totalCount}</b> official practicals for <b>${safeModuleLabel}</b> have been reviewed and approved.</p><p style="margin:24px 0"><a href="${safeModuleUrl}" style="display:inline-block;padding:12px 18px;border-radius:9px;background:#15304a;color:#fff;text-decoration:none;font-weight:700">Continue learning</a></p><p style="color:#657487;font-size:13px;line-height:1.6">Keep up the great work!</p></div></body></html>`;
  return {
    from: getEmailFromAddress(),
    to: [student.email],
    messageId: buildStableMessageId(
      "module-completion",
      `${student._id}:${module._id}`,
    ),
    subject,
    text,
    html,
  };
}

async function sendModuleCompletionEmail({ student, module, progress }) {
  if (!isEmailConfigured()) throw new Error("gmail_api_not_configured");
  const email = buildModuleCompletionEmail({ student, module, progress });
  return sendEmail(email);
}

function nextRetryAt(attempts, now = new Date()) {
  if (attempts >= MAX_ATTEMPTS) return null;
  const delay =
    RETRY_DELAYS_MS[
      Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MS.length - 1)
    ];
  return new Date(now.getTime() + delay);
}

async function markPermanentFailure(progressId, errorCode) {
  await ModuleManualProgress.updateOne(
    { _id: progressId, completionEmailStatus: "sending" },
    {
      $set: {
        completionEmailStatus: "failed",
        completionEmailAttempts: MAX_ATTEMPTS,
        completionEmailNextAttemptAt: null,
        completionEmailLastError: String(
          errorCode || "email_data_unavailable",
        ).slice(0, 120),
      },
    },
  );
  return "failed";
}

async function processModuleCompletionEmail(progressId) {
  if (!isEmailConfigured()) return "unconfigured";
  // Only newly queued notifications carry this marker; pre-existing rows are intentionally not backfilled.
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_SENDING_MS);
  const claimed = await ModuleManualProgress.findOneAndUpdate(
    {
      _id: String(progressId),
      moduleManualStatus: "completed",
      completionEmailQueuedAt: { $exists: true, $ne: null },
      $or: [
        { completionEmailStatus: "pending" },
        {
          completionEmailStatus: "failed",
          completionEmailAttempts: { $lt: MAX_ATTEMPTS },
          completionEmailNextAttemptAt: { $lte: now },
        },
        {
          completionEmailStatus: "sending",
          completionEmailAttempts: { $lt: MAX_ATTEMPTS },
          completionEmailLastAttemptAt: { $lte: staleCutoff },
        },
      ],
    },
    {
      $set: {
        completionEmailStatus: "sending",
        completionEmailLastAttemptAt: now,
        completionEmailNextAttemptAt: null,
        completionEmailLastError: null,
      },
      $inc: { completionEmailAttempts: 1 },
    },
    { new: true },
  );
  if (!claimed) return "not-queued";

  const attempts = claimed.completionEmailAttempts || 1;
  try {
    if (
      !claimed.totalPracticals ||
      claimed.completedPracticals < claimed.totalPracticals
    ) {
      return await markPermanentFailure(
        claimed._id,
        "module_practicals_not_all_approved",
      );
    }
    const [student, module] = await Promise.all([
      User.findById(claimed.studentId)
        .select("name email role isActive")
        .lean(),
      Module.findById(claimed.moduleId)
        .select("moduleNumber title slug")
        .lean(),
    ]);
    if (
      !student ||
      student.role !== "student" ||
      !student.isActive ||
      !student.email ||
      !module
    ) {
      return await markPermanentFailure(
        claimed._id,
        "student_or_module_unavailable",
      );
    }
    await sendModuleCompletionEmail({ student, module, progress: claimed });
    await ModuleManualProgress.updateOne(
      { _id: claimed._id, completionEmailStatus: "sending" },
      {
        $set: {
          completionEmailStatus: "sent",
          completionEmailSentAt: new Date(),
          completionEmailNextAttemptAt: null,
          completionEmailLastError: null,
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
    await ModuleManualProgress.updateOne(
      { _id: claimed._id, completionEmailStatus: "sending" },
      {
        $set: {
          completionEmailStatus: "failed",
          completionEmailNextAttemptAt: retryAt,
          completionEmailLastError: errorCode,
        },
      },
    );
    console.error(
      `Module-completion email failed for progress ${claimed._id} (attempt ${attempts}/${MAX_ATTEMPTS}): ${errorCode}`,
    );
    return "failed";
  }
}

async function processDueModuleCompletionEmails() {
  if (workerRunning || !isEmailConfigured()) return 0;
  workerRunning = true;
  try {
    const now = new Date();
    const staleCutoff = new Date(now.getTime() - STALE_SENDING_MS);
    const dueRows = await ModuleManualProgress.find({
      moduleManualStatus: "completed",
      completionEmailQueuedAt: { $exists: true, $ne: null },
      $or: [
        { completionEmailStatus: "pending" },
        {
          completionEmailStatus: "failed",
          completionEmailAttempts: { $lt: MAX_ATTEMPTS },
          completionEmailNextAttemptAt: { $lte: now },
        },
        {
          completionEmailStatus: "sending",
          completionEmailAttempts: { $lt: MAX_ATTEMPTS },
          completionEmailLastAttemptAt: { $lte: staleCutoff },
        },
      ],
    })
      .select("_id")
      .sort({ updatedAt: 1 })
      .limit(QUEUE_BATCH_SIZE)
      .lean();
    let processed = 0;
    for (const row of dueRows) {
      await processModuleCompletionEmail(row._id);
      processed += 1;
    }
    return processed;
  } finally {
    workerRunning = false;
  }
}

function triggerModuleCompletionEmail(progressId) {
  setImmediate(() => {
    processModuleCompletionEmail(progressId).catch((error) => {
      console.error(
        `Could not process module-completion email for progress ${progressId}:`,
        error.message,
      );
    });
  });
}

function startModuleCompletionEmailWorker() {
  if (workerTimer) return workerTimer;
  const tick = () =>
    processDueModuleCompletionEmails().catch((error) => {
      console.error(
        "Module-completion email queue worker failed:",
        error.message,
      );
    });
  tick();
  workerTimer = setInterval(tick, 60_000);
  workerTimer.unref?.();
  return workerTimer;
}

module.exports = {
  buildModuleCompletionEmail,
  sendModuleCompletionEmail,
  processModuleCompletionEmail,
  processDueModuleCompletionEmails,
  triggerModuleCompletionEmail,
  startModuleCompletionEmailWorker,
};

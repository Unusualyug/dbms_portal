const HttpError = require("../utils/httpError");

function normalizeSupportSubmission(body = {}) {
  const category = String(body.category || "")
    .trim()
    .toLowerCase();
  const subject = String(body.subject || "")
    .trim()
    .replace(/\s+/g, " ");
  const message = String(body.message || "").trim();

  if (!["question", "suggestion"].includes(category)) {
    throw new HttpError(
      400,
      "Choose whether this is a question or suggestion.",
    );
  }
  if (subject.length < 3 || subject.length > 120) {
    throw new HttpError(400, "Subject must be between 3 and 120 characters.");
  }
  if (message.length < 5 || message.length > 4000) {
    throw new HttpError(400, "Message must be between 5 and 4,000 characters.");
  }

  return { category, subject, message };
}

function normalizeSupportReply(body = {}) {
  const reply = String(body.reply || "").trim();
  if (reply.length < 2 || reply.length > 4000) {
    throw new HttpError(400, "Reply must be between 2 and 4,000 characters.");
  }
  return reply;
}

module.exports = { normalizeSupportSubmission, normalizeSupportReply };

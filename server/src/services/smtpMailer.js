const crypto = require("node:crypto");
const nodemailer = require("nodemailer");

function buildStableMessageId(kind, key) {
  const safeKind = String(kind || "portal-email")
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-");
  const digest = crypto
    .createHash("sha256")
    .update(`${safeKind}:${String(key || "")}`)
    .digest("hex")
    .slice(0, 32);
  const senderDomain = String(process.env.SMTP_USER || "")
    .split("@")
    .pop()
    .toLowerCase();
  const safeDomain =
    senderDomain.replace(/[^a-z0-9.-]/g, "").replace(/^\.+|\.+$/g, "") ||
    "localhost";
  return `<${safeKind}.${digest}@${safeDomain}>`;
}

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD,
  );
}

function getSmtpFromAddress() {
  return process.env.REPORT_FROM_EMAIL || process.env.SMTP_USER || "";
}

function createSmtpTransport() {
  if (!isSmtpConfigured()) throw new Error("smtp_not_configured");
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

async function sendSmtpEmail(message) {
  const info = await createSmtpTransport().sendMail(message);
  if (!Array.isArray(info?.accepted) || info.accepted.length === 0) {
    throw new Error("smtp_recipient_not_accepted");
  }
  return info;
}

module.exports = {
  buildStableMessageId,
  isSmtpConfigured,
  getSmtpFromAddress,
  createSmtpTransport,
  sendSmtpEmail,
};

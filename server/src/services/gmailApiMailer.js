const crypto = require("node:crypto");
const nodemailer = require("nodemailer");

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const TOKEN_REFRESH_SKEW_MS = 60_000;
let cachedToken = null;
let tokenRequest = null;

function isEmailConfigured() {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN &&
    process.env.GMAIL_USER,
  );
}

function getEmailFromAddress() {
  return process.env.REPORT_FROM_EMAIL || process.env.GMAIL_USER || "";
}

function buildStableMessageId(kind, key) {
  const safeKind = String(kind || "portal-email")
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-");
  const digest = crypto
    .createHash("sha256")
    .update(`${safeKind}:${String(key || "")}`)
    .digest("hex")
    .slice(0, 32);
  const senderDomain = String(process.env.GMAIL_USER || "")
    .split("@")
    .pop()
    .toLowerCase();
  const safeDomain =
    senderDomain.replace(/[^a-z0-9.-]/g, "").replace(/^\.+|\.+$/g, "") ||
    "localhost";
  return `<${safeKind}.${digest}@${safeDomain}>`;
}

function clearTokenCache() {
  cachedToken = null;
  tokenRequest = null;
}

async function getAccessToken() {
  if (!isEmailConfigured()) throw new Error("gmail_api_not_configured");
  const cacheKey = `${process.env.GMAIL_CLIENT_ID}:${process.env.GMAIL_REFRESH_TOKEN}`;
  if (
    cachedToken?.key === cacheKey &&
    cachedToken.expiresAt > Date.now() + TOKEN_REFRESH_SKEW_MS
  ) {
    return cachedToken.value;
  }
  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    const body = new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    });
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`gmail_oauth_http_${response.status}`);
      error.status = response.status;
      throw error;
    }
    if (!result.access_token)
      throw new Error("gmail_oauth_access_token_missing");

    const expiresInMs = Math.max(60, Number(result.expires_in) || 3600) * 1000;
    cachedToken = {
      key: cacheKey,
      value: result.access_token,
      expiresAt: Date.now() + expiresInMs,
    };
    return result.access_token;
  })();

  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

async function buildRawMessage(message) {
  const mimeTransport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });
  const info = await mimeTransport.sendMail(message);
  if (!info?.message) throw new Error("gmail_mime_message_missing");
  const mimeBuffer = Buffer.isBuffer(info.message)
    ? info.message
    : Buffer.from(info.message);
  return mimeBuffer.toString("base64url");
}

async function sendEmail(message) {
  if (!isEmailConfigured()) throw new Error("gmail_api_not_configured");
  const outgoingMessage = {
    ...message,
    from: message.from || getEmailFromAddress(),
  };
  const raw = await buildRawMessage(outgoingMessage);
  const accessToken = await getAccessToken();
  const response = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`gmail_api_http_${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (!result.id) throw new Error("gmail_api_message_id_missing");
  return result;
}

module.exports = {
  GOOGLE_TOKEN_URL,
  GMAIL_SEND_URL,
  buildStableMessageId,
  buildRawMessage,
  clearTokenCache,
  getAccessToken,
  getEmailFromAddress,
  isEmailConfigured,
  sendEmail,
};

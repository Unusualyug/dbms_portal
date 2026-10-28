const {
  GOOGLE_TOKEN_URL,
  GMAIL_SEND_URL,
} = require("../../src/services/gmailApiMailer");

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function createGmailApiFetchStub({
  tokenStatus = 200,
  sendStatus = 200,
  sendResult,
} = {}) {
  const calls = [];
  const fetch = async (url, options = {}) => {
    const call = { url: String(url), options };
    calls.push(call);
    if (call.url === GOOGLE_TOKEN_URL) {
      return jsonResponse(
        tokenStatus === 200
          ? { access_token: "test-google-access-token", expires_in: 3600 }
          : { error: "invalid_grant" },
        tokenStatus,
      );
    }
    if (call.url === GMAIL_SEND_URL) {
      return jsonResponse(
        sendStatus === 200
          ? sendResult || { id: "gmail-sent-id", threadId: "gmail-thread-id" }
          : { error: { status: "PERMISSION_DENIED" } },
        sendStatus,
      );
    }
    throw new Error(`Unexpected test fetch URL: ${call.url}`);
  };
  return { fetch, calls };
}

function decodeRawMessage(call) {
  const payload = JSON.parse(call.options.body);
  return Buffer.from(payload.raw, "base64url")
    .toString("utf8")
    .replace(/=\r?\n/g, "")
    .replace(/=([a-f0-9]{2})/gi, (_match, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

module.exports = { createGmailApiFetchStub, decodeRawMessage, jsonResponse };

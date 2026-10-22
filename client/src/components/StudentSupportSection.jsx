import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleHelp,
  Clock3,
  Lightbulb,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import { api } from "../services/api.js";
import { formatDate } from "../utils/format.js";
import Notice from "./Notice.jsx";

function emailStatusCopy(status) {
  if (status === "sent")
    return "Resend accepted an email for your saved account address. Inbox delivery is not independently verified.";
  if (status === "failed")
    return "The reply is available here, but email delivery has not been confirmed.";
  if (status === "sending")
    return "The reply is available here. Email delivery is being attempted.";
  return "The reply is available here. Email delivery is pending.";
}

export default function StudentSupportSection() {
  const [category, setCategory] = useState("question");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadRequests = useCallback(async () => {
    if (!hasLoadedOnce.current) setLoading(true);
    setError("");
    try {
      const result = await api.get("/student/support");
      setRequests(result.messages || []);
    } catch (requestError) {
      setError(requestError.message || "Could not load your support requests.");
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests, refreshKey]);
  const shouldPollStatus = requests.some(
    (request) =>
      request.status === "replied" &&
      ["pending", "sending"].includes(request.replyEmailStatus),
  );
  useEffect(() => {
    if (!shouldPollStatus) return undefined;
    const timer = window.setInterval(
      () => setRefreshKey((value) => value + 1),
      12_000,
    );
    return () => window.clearInterval(timer);
  }, [shouldPollStatus]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSending(true);
    try {
      await api.post("/student/support", { category, subject, message });
      setSubject("");
      setMessage("");
      setSuccess(
        "Your request has been sent to the admin inbox. You can follow the reply here.",
      );
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError.message ||
          "Your request could not be sent. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="student-support-workspace">
      {error && <Notice type="error">{error}</Notice>}
      {success && <Notice type="success">{success}</Notice>}

      <div className="student-support-grid">
        <form className="surface-card student-support-form" onSubmit={submit}>
          <div className="card-heading">
            <div>
              <span className="eyebrow">SEND A MESSAGE</span>
              <h3>How can we help?</h3>
            </div>
            <MessageCircle size={19} className="muted-icon" />
          </div>
          <label className="support-field">
            <span>Type of request</span>
            <span className="support-select-wrap">
              {category === "suggestion" ? (
                <Lightbulb size={15} />
              ) : (
                <CircleHelp size={15} />
              )}
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="question">Question</option>
                <option value="suggestion">Suggestion</option>
              </select>
            </span>
          </label>
          <label className="support-field">
            <span>Subject</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={120}
              minLength={3}
              required
              placeholder="A short summary"
            />
          </label>
          <label className="support-field">
            <span>Your message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={4000}
              minLength={5}
              required
              rows={6}
              placeholder="Share your question or idea…"
            />
            <small>{message.length}/4,000 characters</small>
          </label>
          <button
            className="button button-dark student-support-submit"
            type="submit"
            disabled={sending}
          >
            <Send size={15} />
            {sending ? "Sending…" : "Send to admin"}
          </button>
        </form>

        <section
          className="surface-card student-support-thread"
          aria-labelledby="support-thread-title"
        >
          <div className="card-heading">
            <div>
              <span className="eyebrow">YOUR MESSAGES</span>
              <h3 id="support-thread-title">Support thread</h3>
            </div>
            <button
              className="button button-outline button-sm"
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={loading}
              aria-label="Refresh support requests"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
          {loading ? (
            <div className="support-thread-empty" role="status">
              Loading your requests…
            </div>
          ) : requests.length ? (
            <div className="student-support-request-list">
              {requests.map((request) => (
                <article className="student-support-request" key={request.id}>
                  <div className="support-request-topline">
                    <span
                      className={`support-category support-category-${request.category}`}
                    >
                      {request.category === "suggestion" ? (
                        <Lightbulb size={13} />
                      ) : (
                        <CircleHelp size={13} />
                      )}
                      {request.category === "suggestion"
                        ? "Suggestion"
                        : "Question"}
                    </span>
                    <span
                      className={`support-request-status ${request.status === "replied" ? "is-replied" : "is-open"}`}
                    >
                      {request.status === "replied" ? (
                        <CheckCircle2 size={13} />
                      ) : (
                        <Clock3 size={13} />
                      )}
                      {request.status === "replied"
                        ? "Admin replied"
                        : "Awaiting reply"}
                    </span>
                  </div>
                  <h4>{request.subject}</h4>
                  <p className="support-request-message">{request.message}</p>
                  <small className="support-request-date">
                    Sent {formatDate(request.createdAt)}
                  </small>
                  {request.reply && (
                    <div className="student-support-reply">
                      <div className="student-support-reply-heading">
                        <span>
                          <MessageCircle size={14} /> Admin reply
                        </span>
                        <small>
                          {request.repliedAt
                            ? formatDate(request.repliedAt)
                            : ""}
                        </small>
                      </div>
                      <p>{request.reply}</p>
                      <div
                        className={`support-email-copy support-email-${request.replyEmailStatus || "pending"}`}
                      >
                        <Mail size={13} />
                        {emailStatusCopy(request.replyEmailStatus)}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="support-thread-empty">
              <MessageCircle size={22} />
              <b>No support messages yet</b>
              <span>
                Your sent requests and admin replies will appear here.
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

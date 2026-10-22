import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  LifeBuoy,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { api } from "../services/api.js";
import { formatDate } from "../utils/format.js";
import SectionHeading from "../components/SectionHeading.jsx";
import Loading from "../components/Loading.jsx";
import Notice from "../components/Notice.jsx";

function emailStatusText(status) {
  if (status === "sent")
    return "Resend accepted the email for the student’s saved address. Inbox delivery is not independently verified.";
  if (status === "failed")
    return "Email attempt failed. The portal reply is saved; check Resend status/configuration and retry.";
  if (status === "sending")
    return "The portal reply is saved; email delivery is in progress.";
  if (status === "pending")
    return "The portal reply is saved; email delivery is pending.";
  return "No reply email has been queued.";
}

function canDelete(request) {
  return request.status !== "replied" || request.replyEmailStatus === "sent";
}

export default function AdminSupportPage() {
  const [filter, setFilter] = useState("open");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [replyDrafts, setReplyDrafts] = useState({});
  const [busyId, setBusyId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.get(`/admin/support?status=${filter}`);
      setData(result);
    } catch (requestError) {
      setError(requestError.message || "Could not load the support inbox.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox, refreshKey]);
  const shouldPollEmailStatus = (data?.messages || []).some(
    (request) =>
      request.status === "replied" &&
      (["pending", "sending"].includes(request.replyEmailStatus) ||
        (request.replyEmailStatus === "failed" &&
          request.replyEmailAttempts < 5)),
  );
  useEffect(() => {
    if (!shouldPollEmailStatus) return undefined;
    const timer = window.setInterval(
      () => setRefreshKey((value) => value + 1),
      12_000,
    );
    return () => window.clearInterval(timer);
  }, [shouldPollEmailStatus]);

  const sendReply = async (event, request) => {
    event.preventDefault();
    const reply = String(replyDrafts[request.id] || "").trim();
    if (reply.length < 2) {
      setError("Write a reply before sending.");
      return;
    }
    setBusyId(request.id);
    setError("");
    setNotice("");
    try {
      await api.post(`/admin/support/${request.id}/reply`, { reply });
      setReplyDrafts((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      setNotice(
        "Reply saved to the student’s portal thread. Email delivery is being processed and will be shown with the request status.",
      );
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not save this reply.");
    } finally {
      setBusyId("");
    }
  };

  const retryEmail = async (request) => {
    setBusyId(request.id);
    setError("");
    setNotice("");
    try {
      await api.post(`/admin/support/${request.id}/retry-email`, {});
      setNotice(
        "Email retry queued. The request will remain here until Resend accepts the email for sending.",
      );
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not queue the email retry.");
    } finally {
      setBusyId("");
    }
  };

  const readAndDelete = async (request) => {
    if (!canDelete(request)) return;
    const confirmed = window.confirm(
      "Read and permanently delete this request and its saved reply? The student portal thread will disappear. Any email already accepted by Resend is outside the portal and cannot be recalled; inbox delivery is not independently verified.",
    );
    if (!confirmed) return;
    setBusyId(request.id);
    setError("");
    setNotice("");
    try {
      await api.delete(`/admin/support/${request.id}`);
      setNotice("Request and saved reply permanently deleted.");
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not delete this request.");
      setRefreshKey((value) => value + 1);
    } finally {
      setBusyId("");
    }
  };

  if (!data && loading) return <Loading />;

  const counts = data?.counts || { open: 0, replied: 0, total: 0 };

  return (
    <div className="admin-support-page">
      <SectionHeading
        eyebrow="STUDENT MESSAGES"
        title="Contact & Support"
        description="Read student questions and suggestions, reply in the portal, and send the reply to their saved account email."
        action={
          <button
            className="button button-outline button-sm"
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />
      <Notice type="info">
        Admin replies appear in the student’s portal and trigger a Resend email
        attempt to their saved address. “Read &amp; delete” permanently removes
        the request and reply. A replied request stays here until Resend accepts
        the email for sending; this does not verify arrival in the student’s
        inbox.
      </Notice>
      {error && <Notice type="error">{error}</Notice>}
      {notice && <Notice type="success">{notice}</Notice>}

      <div className="submission-review-toolbar admin-support-toolbar">
        <div
          className="submission-review-filters"
          role="tablist"
          aria-label="Filter support requests"
        >
          <button
            type="button"
            className={filter === "open" ? "is-active" : ""}
            role="tab"
            aria-selected={filter === "open"}
            onClick={() => setFilter("open")}
          >
            Needs reply <span>{counts.open}</span>
          </button>
          <button
            type="button"
            className={filter === "replied" ? "is-active" : ""}
            role="tab"
            aria-selected={filter === "replied"}
            onClick={() => setFilter("replied")}
          >
            Replied <span>{counts.replied}</span>
          </button>
          <button
            type="button"
            className={filter === "all" ? "is-active" : ""}
            role="tab"
            aria-selected={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All <span>{counts.total}</span>
          </button>
        </div>
        <span className="submission-review-count">
          Showing up to {data?.limit || 100} requests
        </span>
      </div>

      {loading && (
        <div className="submission-refresh-state" role="status">
          <RefreshCw size={14} />
          Updating inbox…
        </div>
      )}
      <div className="admin-support-list">
        {data?.messages?.map((request) => (
          <article className="surface-card admin-support-card" key={request.id}>
            <div className="admin-support-card-heading">
              <div className="admin-support-title-wrap">
                <span
                  className={`support-category support-category-${request.category}`}
                >
                  {request.category === "suggestion" ? (
                    <LifeBuoy size={13} />
                  ) : (
                    <MessageCircle size={13} />
                  )}
                  {request.category === "suggestion"
                    ? "Suggestion"
                    : "Question"}
                </span>
                <h2>{request.subject}</h2>
                <div className="admin-support-student">
                  <b>
                    {request.student?.name || "Student account unavailable"}
                  </b>
                  {request.student?.studentId && (
                    <span>{request.student.studentId}</span>
                  )}
                  {request.student?.semester && (
                    <span>
                      Semester {request.student.semester}
                      {request.student.classSection
                        ? ` · ${request.student.classSection}`
                        : ""}
                    </span>
                  )}
                  {request.student?.email && (
                    <a href={`mailto:${request.student.email}`}>
                      {request.student.email}
                    </a>
                  )}
                </div>
                <small className="admin-support-date">
                  Received {formatDate(request.createdAt)}
                </small>
              </div>
              <span
                className={`review-status-chip ${request.status === "replied" ? "review-approved" : "review-pending"}`}
              >
                {request.status === "replied" ? (
                  <CheckCircle2 size={13} />
                ) : (
                  <Clock3 size={13} />
                )}
                {request.status === "replied" ? "Replied" : "Needs reply"}
              </span>
            </div>

            <div className="admin-support-original">
              <span>Student message</span>
              <p>{request.message}</p>
            </div>

            {request.status === "open" ? (
              <form
                className="admin-support-reply-form"
                onSubmit={(event) => sendReply(event, request)}
              >
                <label htmlFor={`reply-${request.id}`}>Reply to student</label>
                <textarea
                  id={`reply-${request.id}`}
                  value={replyDrafts[request.id] || ""}
                  maxLength={4000}
                  rows={4}
                  onChange={(event) =>
                    setReplyDrafts((current) => ({
                      ...current,
                      [request.id]: event.target.value,
                    }))
                  }
                  placeholder="Write a helpful reply…"
                  required
                />
                <div className="admin-support-actions">
                  <small>
                    Reply appears in the portal; Resend will attempt the email
                    to the saved account address.
                  </small>
                  <button
                    className="button button-dark button-sm"
                    type="submit"
                    disabled={busyId === request.id}
                  >
                    <Send size={14} />
                    {busyId === request.id ? "Saving…" : "Send reply"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="admin-support-saved-reply">
                <div className="admin-support-saved-heading">
                  <span>
                    <MessageCircle size={14} /> Saved reply
                  </span>
                  <small>
                    {request.repliedAt ? formatDate(request.repliedAt) : ""}
                  </small>
                </div>
                <p>{request.reply}</p>
                <div
                  className={`admin-support-email-status support-email-${request.replyEmailStatus || "pending"}`}
                >
                  {request.replyEmailStatus === "sent" ? (
                    <CheckCircle2 size={14} />
                  ) : request.replyEmailStatus === "failed" ? (
                    <CircleAlert size={14} />
                  ) : (
                    <Clock3 size={14} />
                  )}
                  <span>{emailStatusText(request.replyEmailStatus)}</span>
                </div>
                {request.replyEmailStatus === "failed" && (
                  <button
                    className="button button-outline button-sm admin-support-retry"
                    type="button"
                    onClick={() => retryEmail(request)}
                    disabled={busyId === request.id}
                  >
                    <Mail size={14} />
                    {busyId === request.id ? "Queuing…" : "Retry email"}
                  </button>
                )}
              </div>
            )}

            <div className="admin-support-card-footer">
              {!canDelete(request) && (
                <span className="admin-support-delete-hold">
                  <Clock3 size={13} />
                  Keep this request until Resend accepts the email for sending.
                </span>
              )}
              <button
                className="button button-outline button-sm admin-support-delete"
                type="button"
                onClick={() => readAndDelete(request)}
                disabled={!canDelete(request) || busyId === request.id}
                title={
                  !canDelete(request)
                    ? "Resend must accept the reply email before deleting."
                    : "Permanently delete request and reply"
                }
              >
                <Trash2 size={14} />
                {busyId === request.id ? "Working…" : "Read & delete"}
              </button>
            </div>
          </article>
        ))}
      </div>

      {!loading && !data?.messages?.length && (
        <section className="surface-card admin-support-empty">
          <LifeBuoy size={25} />
          <b>No requests in this view</b>
          <span>
            New questions and suggestions from students will appear here.
          </span>
        </section>
      )}
    </div>
  );
}

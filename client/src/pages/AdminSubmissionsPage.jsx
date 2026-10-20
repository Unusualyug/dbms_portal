import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Clock3, Code2, FileText, RefreshCw, Send, XCircle } from 'lucide-react';
import { api } from '../services/api.js';
import { formatDate } from '../utils/format.js';
import SectionHeading from '../components/SectionHeading.jsx';
import Loading from '../components/Loading.jsx';
import Notice from '../components/Notice.jsx';
import EmptyState from '../components/EmptyState.jsx';

const reviewFilters = [
  { id: 'pending', label: 'Needs review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Needs changes' },
  { id: 'all', label: 'All decisions' },
];

export default function AdminSubmissionsPage() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [feedbackById, setFeedbackById] = useState({});
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    api.get(`/admin/submissions?status=${status}&page=${page}&limit=30`)
      .then((result) => { if (mounted) setData(result); })
      .catch((requestError) => { if (mounted) setError(requestError.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [status, page, refreshKey]);

  const changeFilter = (nextStatus) => {
    setStatus(nextStatus);
    setPage(1);
    setNotice(null);
  };

  const review = async (submission, decision) => {
    const feedback = feedbackById[submission.id] || '';
    if (decision === 'reject' && !feedback.trim()) {
      setError('Add feedback explaining what the student should correct before requesting changes.');
      return;
    }
    setBusyId(submission.id);
    setError('');
    setNotice(null);
    try {
      const result = await api.post(`/admin/submissions/${submission.type}/${submission.id}/review`, { decision, feedback });
      if (decision === 'approve') {
        const moduleStatus = result.moduleManualProgress
          ? ` Module ${result.moduleManualProgress.moduleNumber} manual status: ${result.moduleManualProgress.moduleManualStatus}.`
          : '';
        const syncWarning = result.moduleManualProgressWarning
          ? ' Module status will be recalculated on the next progress CSV export.'
          : '';
        setNotice({ type: 'success', text: `${result.pointsAwarded
          ? `Approved. ${result.pointsAwarded} points awarded to the student.`
          : 'Approved. Points for this item had already been awarded.'}${moduleStatus}${syncWarning}` });
      } else {
        setNotice({ type: 'info', text: 'Changes requested. Your feedback is saved for the student.' });
      }
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

  if (loading && !data) return <Loading label="Loading student submissions…" />;
  const submissions = data?.submissions || [];
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };

  return (
    <div className="admin-submissions-page">
      <SectionHeading
        eyebrow="INSTRUCTOR WORKFLOW"
        title="Review submissions"
        description="Read each student's SQL/PLSQL and approve it or request changes. Submissions are stored for review; the portal does not execute them."
        action={<button type="button" className="button button-outline button-sm" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}><RefreshCw size={14} /> Refresh</button>}
      />
      <Notice type="info">
        Approving a practical or Arena challenge awards 20 points once and locks it for that student. After either decision, the submitted SQL/PLSQL is deleted from storage. Rejected submissions earn no points; include clear feedback so the student knows what to revise.
      </Notice>
      {error && <Notice type="error">{error}</Notice>}
      {notice && <Notice type={notice.type}>{notice.text}</Notice>}

      <div className="submission-review-toolbar">
        <div className="submission-review-filters" role="tablist" aria-label="Filter submissions by review status">
          {reviewFilters.map((filter) => (
            <button
              type="button"
              key={filter.id}
              role="tab"
              aria-selected={status === filter.id}
              className={status === filter.id ? 'is-active' : ''}
              onClick={() => changeFilter(filter.id)}
            >
              {filter.label}
              {filter.id === 'pending' && <span>{data?.pendingCount ?? '…'}</span>}
            </button>
          ))}
        </div>
        <span className="submission-review-count">{pagination.total} submission{pagination.total === 1 ? '' : 's'}</span>
      </div>

      {loading && data && <div className="submission-refresh-state"><span className="button-loader" /> Updating review queue…</div>}
      {!submissions.length ? (
        <EmptyState
          title={status === 'pending' ? 'No submissions awaiting review' : 'No submissions in this view'}
          text={status === 'pending' ? 'New student submissions will appear here.' : 'Try another review-status filter.'}
          icon={ClipboardCheck}
        />
      ) : (
        <div className="submission-review-list">
          {submissions.map((submission) => (
            <article className="surface-card review-submission-card" key={`${submission.type}:${submission.id}`}>
              <div className="review-submission-heading">
                <div>
                  <span className="eyebrow">{submission.type === 'practical' ? 'OFFICIAL COURSE PRACTICAL' : 'PRACTICE ARENA'}</span>
                  <h2>{submission.title}</h2>
                  <small>{submission.moduleTitle}</small>
                </div>
                <span className={`review-status-chip review-${submission.reviewStatus}`}>
                  {submission.reviewStatus === 'pending' ? <Clock3 size={14} /> : submission.reviewStatus === 'approved' || submission.reviewStatus === 'superseded' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {submission.reviewStatus === 'pending' ? 'Needs review' : submission.reviewStatus === 'approved' ? 'Approved' : submission.reviewStatus === 'superseded' ? 'Closed · another approved' : 'Needs changes'}
                </span>
              </div>

              <div className="review-submission-meta">
                <span><b>{submission.student.name}</b>{submission.student.studentId ? ` · ${submission.student.studentId}` : ''}</span>
                <span>{submission.student.semester ? `Semester ${submission.student.semester}` : 'Semester —'} · Class {submission.student.classSection || '—'}</span>
                <span>Attempt {submission.attemptNumber} · Submitted {formatDate(submission.submittedAt)}</span>
              </div>

              <div className="review-prompt-block">
                <span><FileText size={14} /> Prompt</span>
                <p>{submission.prompt}</p>
              </div>

              <div className="review-code-block">
                <div><span><Code2 size={14} /> Student submission</span><small>Not executed</small></div>
                <pre>{submission.submittedCode || 'This solution was deleted after review for privacy.'}</pre>
              </div>

              {submission.reviewStatus === 'pending' ? (
                <div className="review-decision-area">
                  <label htmlFor={`review-feedback-${submission.id}`}>Feedback for the student <span>required when requesting changes</span></label>
                  <textarea
                    id={`review-feedback-${submission.id}`}
                    value={feedbackById[submission.id] || ''}
                    maxLength={1000}
                    onChange={(event) => setFeedbackById((current) => ({ ...current, [submission.id]: event.target.value }))}
                    placeholder="Add a short note to explain your decision or suggest a correction."
                    rows={3}
                  />
                  <div className="review-decision-actions">
                    <button type="button" className="button button-outline button-sm review-reject-button" onClick={() => review(submission, 'reject')} disabled={busyId === submission.id}>
                      <XCircle size={15} /> Request changes
                    </button>
                    <button type="button" className="button button-dark button-sm" onClick={() => review(submission, 'approve')} disabled={busyId === submission.id}>
                      {busyId === submission.id ? <span className="button-loader" /> : <CheckCircle2 size={15} />}
                      Approve · award 20 points
                    </button>
                  </div>
                </div>
              ) : (
                <div className="review-decision-summary">
                  <b>{submission.reviewStatus === 'approved' ? 'Approved' : submission.reviewStatus === 'superseded' ? 'Closed because another submission was approved' : 'Changes requested'} · reviewed {formatDate(submission.reviewedAt)}</b>
                  {submission.reviewFeedback && <p>{submission.reviewFeedback}</p>}
                  {submission.reviewStatus === 'approved' && submission.pointsAwarded > 0 && <small>{submission.pointsAwarded} points awarded for this item.</small>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {pagination.pages > 1 && <div className="table-pagination submission-pagination"><span>Page {pagination.page} of {pagination.pages}</span><div><button type="button" className="button button-outline button-sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className="button button-outline button-sm" disabled={page >= pagination.pages || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>}
      <p className="submission-review-footnote"><Send size={14} /> Students see your feedback on their next visit to the practical or Arena task.</p>
    </div>
  );
}

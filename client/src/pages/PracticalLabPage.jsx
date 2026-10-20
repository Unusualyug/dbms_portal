import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { Play, RotateCcw, Clock3, TerminalSquare, CheckCircle2, CircleX, CircleHelp, AlertTriangle, Award } from 'lucide-react';
import { api } from '../services/api.js';
import { useActiveTimer } from '../hooks/useActiveTimer.js';
import { formatDuration } from '../utils/format.js';
import SectionHeading from '../components/SectionHeading.jsx';
import Loading from '../components/Loading.jsx';
import Notice from '../components/Notice.jsx';
import EmptyState from '../components/EmptyState.jsx';

function getReviewLabel(attempt) {
  if (attempt?.reviewStatus === 'pending') return 'Awaiting instructor review';
  if (attempt?.reviewStatus === 'approved') return 'Approved';
  if (attempt?.reviewStatus === 'rejected') return 'Changes requested';
  if (attempt?.reviewStatus === 'superseded') return 'Closed · another attempt approved';
  if (attempt?.isCorrect === true) return 'Previously verified correct';
  if (attempt?.isCorrect === false) return 'Previous checks not passed';
  return 'Submitted';
}

function getReviewTone(attempt) {
  if (attempt?.reviewStatus === 'approved' || attempt?.isCorrect === true) return 'status-good';
  if (attempt?.reviewStatus === 'rejected' || attempt?.isCorrect === false) return 'status-bad';
  return 'status-pending';
}

export default function PracticalLabPage() {
  const [practicals, setPracticals] = useState(null);
  const [modules, setModules] = useState([]);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('practical');
  const moduleFilter = searchParams.get('module') || 'all';
  const [selectedId, setSelectedId] = useState(requested || '');
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/student/practicals'), api.get('/student/modules')])
      .then(([practicalData, moduleData]) => { setPracticals(practicalData.practicals); setModules(moduleData.modules); })
      .catch((requestError) => setError(requestError.message));
  }, []);
  useEffect(() => { if (requested) setSelectedId(requested); }, [requested]);

  const visible = useMemo(() => (practicals || []).filter((practical) => (
    moduleFilter === 'all' || practical.moduleId?.slug === moduleFilter || String(practical.moduleId?._id) === moduleFilter
  )), [practicals, moduleFilter]);
  const selected = (practicals || []).find((practical) => String(practical._id) === String(selectedId) || practical.key === selectedId) || visible[0] || null;

  useEffect(() => {
    if (!selected?.completed) return;
    const next = visible.find((practical) => !practical.completed);
    if (next) {
      setSelectedId(String(next._id));
      setCode('');
      setResult(null);
    }
  }, [selected?._id, selected?.completed, visible]);

  useEffect(() => {
    if (!selected) return;
    setSelectedId(String(selected._id));
    setCode('');
    setResult(null);
    setHistory([]);
    api.get(`/student/practicals/${selected._id}`).catch(() => {});
    api.get(`/student/practicals/${selected._id}/history`)
      .then((data) => setHistory(data.attempts))
      .catch(() => setHistory([]));
  }, [selected?._id]);

  useEffect(() => {
    if (!selected?._id) return undefined;
    const handleReview = (event) => {
      const detail = event.detail || {};
      if (detail.type !== 'practical') return;
      api.get('/student/practicals').then((data) => setPracticals(data.practicals)).catch(() => {});
      if (detail.itemId === String(selected._id)) {
        setResult(null);
        if (detail.reviewStatus === 'approved') setCode('');
        api.get(`/student/practicals/${selected._id}/history`).then((data) => setHistory(data.attempts)).catch(() => {});
      }
    };
    window.addEventListener('portal:submission-reviewed', handleReview);
    return () => window.removeEventListener('portal:submission-reviewed', handleReview);
  }, [selected?._id]);

  const timer = useActiveTimer({ scopeType: 'practical', scopeId: selected?._id, enabled: Boolean(selected?._id) });
  if (!practicals && !error) return <Loading />;

  const submit = async () => {
    if (!code.trim()) return setError('Write SQL or PL/SQL code before submitting.');
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const data = await api.post(`/student/practicals/${selected._id}/submit`, { code });
      setResult(data);
      const historyData = await api.get(`/student/practicals/${selected._id}/history`);
      setHistory(historyData.attempts);
      api.get('/student/dashboard').catch(() => {});
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 409) {
        api.get('/student/practicals').then((data) => setPracticals(data.practicals)).catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  };

  const changePractical = (id) => {
    setSelectedId(id);
    setResult(null);
    setCode('');
    setSearchParams((current) => { current.set('practical', id); return current; }, { replace: true });
  };

  const latestAttempt = result?.attempt || history[0] || selected?.lastAttempt || null;
  const reviewLabel = getReviewLabel(latestAttempt);
  const reviewTone = getReviewTone(latestAttempt);
  const awaitingReview = latestAttempt?.reviewStatus === 'pending';

  return (
    <div className="lab-page">
      <SectionHeading
        eyebrow="OFFICIAL COURSE PRACTICALS"
        title="Practical submissions"
        description="Submit your SQL/PLSQL for instructor review. It is stored only until a decision, then deleted; approval awards 20 points once and locks the practical."
        action={<span className="dialect-badge"><span /> Oracle SQL / PL/SQL</span>}
      />
      {error && <Notice type="error">{error}</Notice>}

      <div className="lab-toolbar">
        <div className="lab-module-filters">
          <button className={moduleFilter === 'all' ? 'active' : ''} onClick={() => setSearchParams({}, { replace: true })}>All modules</button>
          {modules.map((module) => <button key={module._id} className={moduleFilter === module.slug ? 'active' : ''} onClick={() => setSearchParams({ module: module.slug }, { replace: true })}>Module {module.moduleNumber}</button>)}
        </div>
        <span className="official-count">{visible.length} official practical{visible.length === 1 ? '' : 's'}</span>
      </div>

      {!selected ? (
        <EmptyState title="No practicals in this view" text="Choose another module, or import the official course content first." icon={TerminalSquare} />
      ) : (
        <div className="lab-workspace-grid">
          <aside className="lab-queue surface-card">
            <div className="lab-queue-head"><span className="eyebrow">PRACTICAL QUEUE</span><b>{visible.length} tasks</b></div>
            <div className="lab-queue-list">
              {visible.map((practical) => (
                <button type="button" onClick={() => changePractical(String(practical._id))} key={practical._id} disabled={practical.completed} title={practical.completed ? 'Completed and locked — points already awarded' : undefined} aria-label={`Practical ${String(practical.number).padStart(2, '0')}${practical.completed ? ', completed and locked' : ''}`} className={`lab-queue-item ${String(selected._id) === String(practical._id) ? 'lab-queue-active' : ''} ${practical.completed ? 'lab-queue-locked' : ''}`}>
                  <span className={`lab-queue-number ${practical.completed ? 'queue-complete' : ''}`}>{practical.completed ? <CheckCircle2 size={15} /> : String(practical.number).padStart(2, '0')}</span>
                  <span><b>Practical {String(practical.number).padStart(2, '0')}</b><small>{practical.completed ? 'Approved · locked' : practical.moduleId?.title}</small></span>
                </button>
              ))}
            </div>
          </aside>

          <main className="lab-main">
            <div className="lab-task-card surface-card">
              <div className="lab-task-header">
                <div><span className="eyebrow">MODULE {selected.moduleId?.moduleNumber} · PRACTICAL {String(selected.number).padStart(2, '0')}</span><h2>Official task</h2></div>
                <span className="lab-time"><Clock3 size={15} />{formatDuration(timer.elapsedSeconds)}</span>
              </div>
              <p className="official-prompt">{selected.prompt}</p>
              {selected.sourceWordingUnclear && <Notice type="info">The scanned syllabus wording for this practical is unclear and has been preserved as transcribed. Please verify it with the instructor before grading.</Notice>}
              {selected.completed && <Notice type="success">You already earned points for this practical. It is locked and cannot be submitted again.</Notice>}
              <div className="editor-label"><span><TerminalSquare size={16} /> YOUR SQL / PL/SQL</span><span>{selected.completed ? 'Approved · locked' : 'Oracle dialect · saved for review'}</span></div>
              <div className="code-editor"><CodeMirror value={code} height="250px" editable={!selected.completed} extensions={[sql()]} onChange={setCode} basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true }} placeholder={selected.completed ? 'This practical is locked after points were awarded.' : '-- Write your solution here. Oracle SQL / PL/SQL is expected.'} /></div>
              <div className="editor-actions">
                <button className="button button-dark" onClick={submit} disabled={busy || selected.completed || awaitingReview || !code.trim()}>{busy ? <span className="button-loader" /> : selected.completed ? <CheckCircle2 size={15} /> : <Play size={15} fill="currentColor" />} {selected.completed ? 'Points earned · locked' : awaitingReview ? 'Awaiting review' : busy ? 'Submitting…' : 'Submit for review'}</button>
                <button className="button button-outline" onClick={() => { setCode(''); setResult(null); }} disabled={busy || selected.completed}><RotateCcw size={15} /> Reset</button>
                <span className="editor-active-time"><Clock3 size={14} /> active time {formatDuration(timer.elapsedSeconds)}</span>
              </div>
              <div className="lab-safety-note"><AlertTriangle size={15} /><span>A pending submission is stored temporarily so the instructor can review it. After approval or a request for changes, the submitted SQL is deleted from the database. Approved practicals are locked after points are awarded.</span></div>
            </div>

            <section className="execution-panel surface-card submission-status-panel">
              <div className="card-heading"><div><span className="eyebrow">SUBMISSION STATUS</span><h2>Instructor review</h2></div>{latestAttempt && <span className="attempt-pill">Attempt {latestAttempt.attemptNumber}</span>}</div>
              {!latestAttempt ? (
                <div className="output-empty"><TerminalSquare size={22} /><span>Submit a solution to add it to your review history.</span></div>
              ) : (
                <div className="execution-result">
                  <div className={`execution-status ${reviewTone}`}>
                    {reviewTone === 'status-good' ? <CheckCircle2 size={18} /> : reviewTone === 'status-bad' ? <CircleX size={18} /> : <CircleHelp size={18} />}
                    <div><b>{reviewLabel}</b><small>{latestAttempt.reviewStatus === 'pending' ? 'Your code has not been executed. Points wait until approval.' : latestAttempt.executionMode === 'submission-only' ? 'Reviewed by your instructor; no database output is provided.' : 'This attempt predates the current manual-review workflow.'}</small></div>
                  </div>
                  {latestAttempt.reviewStatus === 'pending' && <Notice type="info">Your submission is in the review queue. You can draft locally while you wait, but only one submission per practical can await review at a time.</Notice>}
                  {latestAttempt.reviewStatus === 'rejected' && latestAttempt.reviewFeedback && <div className="review-feedback-student"><b>Instructor feedback</b><p>{latestAttempt.reviewFeedback}</p></div>}
                  {latestAttempt.reviewStatus === 'approved' && <div className={`points-feedback ${latestAttempt.pointsAwarded ? 'points-awarded' : 'points-previously-awarded'}`}><Award size={17} /><span><b>{latestAttempt.pointsAwarded ? `+${latestAttempt.pointsAwarded} points awarded` : 'Approved · points for this practical were already awarded'}</b><small>Points are added to your profile total.</small></span></div>}
                  {result?.note && <Notice type="info">{result.note}</Notice>}
                </div>
              )}
            </section>

            <section className="surface-card submission-history">
              <div className="card-heading"><div><span className="eyebrow">YOUR WORK</span><h2>Submission history</h2></div><span className="subtle-count">{history.length} recorded</span></div>
              {history.length ? (
                <div className="history-list">
                  {history.map((item) => {
                    const label = getReviewLabel(item);
                    const statusClass = item.reviewStatus === 'approved' || item.isCorrect === true ? 'success' : item.reviewStatus === 'rejected' || item.isCorrect === false ? 'failed' : 'pending';
                    return (
                      <div className="history-row" key={item._id}>
                        <span className={`history-status ${statusClass}`}>{statusClass === 'success' ? '✓' : statusClass === 'failed' ? '×' : '·'}</span>
                        <div><b>Attempt {item.attemptNumber} · {label}</b><small>{new Date(item.submittedAt).toLocaleString()}</small>{item.reviewFeedback && <small className="history-feedback">Feedback: {item.reviewFeedback}</small>}</div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="mini-empty">Your submitted work and review decisions will appear here.</div>}
            </section>
          </main>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { Brain, Check, CheckCircle2, Circle, CircleHelp, Clipboard, Code2, LoaderCircle, Play, RotateCcw, Search } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import SectionHeading from '../components/SectionHeading.jsx';
import Notice from '../components/Notice.jsx';
import { practiceArenaCounts, practiceArenaRounds } from '../data/practiceArena.js';

const emptyWorkspace = { drafts: {} };

function readWorkspace(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '{}');
    return { drafts: parsed.drafts && typeof parsed.drafts === 'object' ? parsed.drafts : {} };
  } catch {
    return emptyWorkspace;
  }
}

function countChallenges(round) {
  return round.sections.reduce((sum, section) => sum + section.tasks.length, 0);
}

export default function PracticeArenaPage() {
  const { user } = useAuth();
  const studentKey = user?.id || user?.studentId || 'student';
  const storageKey = `gmiu-dbms-practice-arena-v1:${studentKey}`;
  const [workspace, setWorkspace] = useState(() => readWorkspace(storageKey));
  const [arenaProgress, setArenaProgress] = useState({});
  const [progressError, setProgressError] = useState('');
  const [progressLoading, setProgressLoading] = useState(true);
  const [roundId, setRoundId] = useState(practiceArenaRounds[0].id);
  const [selectedTaskId, setSelectedTaskId] = useState(practiceArenaRounds[0].sections[0].tasks[0].id);
  const [search, setSearch] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [runError, setRunError] = useState('');
  const [runNotice, setRunNotice] = useState('');
  const [runNoticeType, setRunNoticeType] = useState('info');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setWorkspace(readWorkspace(storageKey));
  }, [storageKey]);

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(workspace)); } catch { /* Browser storage may be disabled or full. */ }
  }, [storageKey, workspace]);

  useEffect(() => {
    const lockedIds = Object.entries(arenaProgress).filter(([, progress]) => progress.completed).map(([challengeId]) => challengeId);
    if (!lockedIds.length) return;
    setWorkspace((current) => {
      const drafts = { ...current.drafts };
      let changed = false;
      for (const challengeId of lockedIds) {
        if (challengeId in drafts) {
          delete drafts[challengeId];
          changed = true;
        }
      }
      return changed ? { ...current, drafts } : current;
    });
  }, [arenaProgress]);

  useEffect(() => {
    let mounted = true;
    api.get('/student/practice-arena')
      .then((data) => { if (mounted) setArenaProgress(data.progress || {}); })
      .catch((error) => { if (mounted) setProgressError(error.message); })
      .finally(() => { if (mounted) setProgressLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const handleReview = (event) => {
      if (event.detail?.type !== 'arena') return;
      api.get('/student/practice-arena').then((data) => setArenaProgress(data.progress || {})).catch(() => {});
    };
    window.addEventListener('portal:submission-reviewed', handleReview);
    return () => window.removeEventListener('portal:submission-reviewed', handleReview);
  }, []);

  const activeRound = practiceArenaRounds.find((round) => round.id === roundId) || practiceArenaRounds[0];
  const visibleSections = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return activeRound.sections.map((section) => ({
      ...section,
      tasks: section.tasks.filter((task) => !query || `${task.title}\n${task.prompt}`.toLocaleLowerCase().includes(query)),
    })).filter((section) => section.tasks.length > 0);
  }, [activeRound, search]);
  const visibleTasks = useMemo(() => visibleSections.flatMap((section) => section.tasks), [visibleSections]);
  const selectedSection = visibleSections.find((section) => section.tasks.some((task) => task.id === selectedTaskId));
  const selectedTask = selectedSection?.tasks.find((task) => task.id === selectedTaskId) || visibleTasks[0] || null;
  const solution = selectedTask ? workspace.drafts[selectedTask.id] || '' : '';
  const selectedProgress = selectedTask ? arenaProgress[selectedTask.id] : null;
  const latestAttempt = selectedProgress?.latest || null;
  const completedCount = Object.values(arenaProgress).filter((item) => item.completed).length;
  const savedDraftCount = Object.values(workspace.drafts).filter((draft) => typeof draft === 'string' && draft.trim()).length;

  useEffect(() => {
    if (!visibleTasks.length) return;
    const current = visibleTasks.find((task) => task.id === selectedTaskId);
    const currentIsLocked = Boolean(current && arenaProgress[current.id]?.completed);
    if (!current || currentIsLocked) {
      const next = visibleTasks.find((task) => !arenaProgress[task.id]?.completed);
      if (next) setSelectedTaskId(next.id);
    }
  }, [visibleTasks, selectedTaskId, arenaProgress]);

  const chooseRound = (round) => {
    setRoundId(round.id);
    setSearch('');
    setSelectedTaskId(round.sections[0].tasks[0].id);
    setCopyMessage('');
    setRunError('');
    setRunNotice('');
    setRunNoticeType('info');
  };

  const selectTask = (taskId) => {
    setSelectedTaskId(taskId);
    setCopyMessage('');
    setRunError('');
    setRunNotice('');
    setRunNoticeType('info');
  };

  const updateSolution = (value) => {
    if (!selectedTask) return;
    setWorkspace((current) => ({
      ...current,
      drafts: { ...current.drafts, [selectedTask.id]: value },
    }));
    setCopyMessage('');
    setRunError('');
    setRunNotice('');
  };

  const clearSolution = () => {
    if (!selectedTask) return;
    setWorkspace((current) => {
      const drafts = { ...current.drafts };
      delete drafts[selectedTask.id];
      return { ...current, drafts };
    });
    setCopyMessage('');
  };

  const copySolution = async () => {
    try {
      await window.navigator.clipboard.writeText(solution);
      setCopyMessage('Solution copied. Submit it for instructor review when ready.');
    } catch {
      setCopyMessage('Clipboard access is unavailable in this browser.');
    }
  };

  const runSolution = async () => {
    if (awaitingReview) {
      setRunError('A submission for this challenge is already awaiting instructor review.');
      return;
    }
    if (!selectedTask || !solution.trim()) {
      setRunError('Write a SQL or PL/SQL solution before submitting it.');
      return;
    }
    setRunning(true);
    setRunError('');
    setRunNotice('');
    setRunNoticeType('info');
    setCopyMessage('');
    try {
      const response = await api.post(`/student/practice-arena/${selectedTask.id}/submit`, { code: solution });
      const previous = arenaProgress[selectedTask.id];
      const nextProgress = {
        completed: Boolean(previous?.completed || response.attempt.completedAt),
        completedAt: response.attempt.completedAt || previous?.completedAt || null,
        latest: { ...response.attempt, pointsAwarded: response.pointsAwarded, pointsAlreadyEarned: response.pointsAlreadyEarned, note: response.note },
      };
      setArenaProgress((current) => ({ ...current, [selectedTask.id]: nextProgress }));
      setRunNoticeType('info');
      setRunNotice(response.note || 'Submitted for instructor review. No points are awarded until it is approved.');
    } catch (error) {
      setRunError(error.status >= 500
        ? 'Could not save this submission. Please try again.'
        : error.message);
      if (error.status === 409) api.get('/student/practice-arena').then((data) => setArenaProgress(data.progress || {})).catch(() => {});
    } finally {
      setRunning(false);
    }
  };

  const awaitingReview = latestAttempt?.reviewStatus === 'pending';
  const attemptApproved = Boolean(latestAttempt && (latestAttempt.reviewStatus === 'approved' || (latestAttempt.reviewStatus !== 'pending' && latestAttempt.isCorrect === true)));
  const attemptRejected = Boolean(latestAttempt && (latestAttempt.reviewStatus === 'rejected' || latestAttempt.isCorrect === false));
  return (
    <div className="practice-arena-page">
      <SectionHeading
        eyebrow="EXTRA SQL & PL/SQL PRACTICE"
        title="🧠 Practice Arena"
        description="Independent SQL/PLSQL challenges organized into rounds. Submit your code for instructor review; the portal does not execute it."
        action={<span className="soft-badge"><Brain size={15} /> Independent practice</span>}
      />

      <div className="practice-arena-summary" aria-label="Practice Arena progress summary">
        <div><strong>{practiceArenaCounts.rounds}</strong><span>rounds</span></div>
        <div><strong>{practiceArenaCounts.challenges}</strong><span>challenge cards</span></div>
        <div><strong>{progressLoading ? '…' : completedCount}</strong><span>approved · 20 points each</span></div>
        <div><strong>{savedDraftCount}</strong><span>saved drafts</span></div>
      </div>

      {progressError && <Notice type="error">Could not load saved Arena progress: {progressError}</Notice>}
      <Notice type="info">
        Drafts autosave in this browser. Submitted SQL/PLSQL is not executed or shown as output. It is stored only while awaiting review, then deleted; approval awards +20 points once and locks the challenge.
      </Notice>

      <nav className="practice-round-picker" aria-label="Choose a Practice Arena round">
        {practiceArenaRounds.map((round) => (
          <button
            type="button"
            key={round.id}
            className={`practice-round-tab ${round.id === activeRound.id ? 'is-active' : ''}`}
            onClick={() => chooseRound(round)}
            aria-pressed={round.id === activeRound.id}
          >
            <span className="practice-round-emoji" aria-hidden="true">{round.emoji}</span>
            <span><b>{round.title}</b><small>{countChallenges(round)} challenges</small></span>
          </button>
        ))}
      </nav>

      <div className="practice-arena-layout">
        <aside className="practice-queue surface-card" aria-label={`${activeRound.title} challenge list`}>
          <div className="practice-queue-header">
            <div><span className="eyebrow">{activeRound.title.toUpperCase()}</span><h2>{activeRound.focus}</h2></div>
            <span className="practice-queue-count">{visibleTasks.length}/{countChallenges(activeRound)}</span>
          </div>
          <label className="practice-search">
            <Search size={16} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a challenge" aria-label="Search challenges in this round" />
          </label>
          <div className="practice-queue-list">
            {!visibleTasks.length && <p className="practice-no-results">No challenges match this search.</p>}
            {visibleSections.map((section) => (
              <div className="practice-queue-section" key={section.id}>
                <h3>{section.title}</h3>
                {section.tasks.map((task) => {
                  const progress = arenaProgress[task.id];
                  const done = Boolean(progress?.completed);
                  const attempted = Boolean(progress?.latest);
                  return (
                    <button
                      type="button"
                      key={task.id}
                      className={`practice-queue-item ${selectedTask?.id === task.id ? 'is-active' : ''} ${done ? 'is-practiced practice-queue-locked' : ''}`}
                      onClick={() => selectTask(task.id)}
                      disabled={done}
                      title={done ? 'Approved and locked — points already awarded' : undefined}
                      aria-label={`${task.title}${done ? ', approved and locked' : ''}`}
                      aria-pressed={selectedTask?.id === task.id}
                    >
                      {done ? <CheckCircle2 size={16} aria-hidden="true" /> : attempted ? <CircleHelp size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
                      <span>{task.title}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        <main className="practice-workspace">
          {!selectedTask ? (
            <section className="practice-empty surface-card"><Brain size={26} /><h2>No challenge selected</h2><p>Clear the search or choose another round to see its challenges.</p></section>
          ) : (
            <>
              <section className="practice-question-card surface-card" aria-labelledby="practice-question-title">
                <div className="practice-question-topline">
                  <span className="eyebrow">{activeRound.title.toUpperCase()} · {selectedSection?.title}</span>
                  {selectedProgress?.completed && <span className="practice-completion-pill"><CheckCircle2 size={15} /> Approved · points earned</span>}
                </div>
                <h2 id="practice-question-title">{selectedTask.title}</h2>
                <div className="practice-question-prompt">{selectedTask.prompt}</div>
                {selectedProgress?.completed && <Notice type="success">You already earned points for this challenge. It is locked, and the saved draft has been removed from this browser.</Notice>}
                <div className="practice-editor-heading">
                  <span><Code2 size={16} /> YOUR SOLUTION</span>
                  <small>SQL / PL/SQL</small>
                </div>
                <div className="practice-code-editor">
                  <CodeMirror
                    value={solution}
                    height="min(48vh, 440px)"
                    extensions={[sql()]}
                    editable={!selectedProgress?.completed}
                    onChange={updateSolution}
                    basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true }}
                    placeholder={selectedProgress?.completed ? 'This challenge is locked after points were awarded.' : '-- Write your SQL or PL/SQL solution here. Your draft saves automatically.'}
                    aria-label={`Solution editor for ${selectedTask.title}`}
                  />
                </div>
                <div className="practice-editor-footer">
                  <span className="practice-save-status"><Check size={14} /> Draft autosaved on this device</span>
                  <div className="practice-editor-actions">
                    <button type="button" className="button button-outline button-sm" onClick={clearSolution} disabled={!solution || running || selectedProgress?.completed}>
                      <RotateCcw size={14} /> Clear draft
                    </button>
                    <button type="button" className="button button-outline button-sm" onClick={copySolution} disabled={!solution || running || selectedProgress?.completed}>
                      <Clipboard size={14} /> Copy solution
                    </button>
                    <button type="button" className="button button-dark button-sm" onClick={runSolution} disabled={running || selectedProgress?.completed || awaitingReview || !solution.trim()}>
                      {running ? <LoaderCircle size={15} className="practice-spin" /> : selectedProgress?.completed || awaitingReview ? <CheckCircle2 size={15} /> : <Play size={15} fill="currentColor" />}
                      {selectedProgress?.completed ? 'Points earned · locked' : awaitingReview ? 'Awaiting review' : running ? 'Submitting…' : 'Submit for review'}
                    </button>
                  </div>
                </div>
                {copyMessage && <p className="practice-copy-message" role="status">{copyMessage}</p>}
                {runError && <Notice type="error">{runError}</Notice>}
                {runNotice && <Notice type={runNoticeType}>{runNotice}</Notice>}

                {latestAttempt && (
                  <div className="practice-run-result">
                    <div className={`practice-result-heading ${attemptApproved ? 'is-correct' : attemptRejected ? 'is-incorrect' : 'is-pending'}`}>
                      {attemptApproved ? <CheckCircle2 size={19} /> : attemptRejected ? <CircleHelp size={19} /> : <Circle size={19} />}
                      <span>
                        <b>{latestAttempt.reviewStatus === 'pending' ? 'Awaiting instructor review' : latestAttempt.reviewStatus === 'rejected' ? 'Changes requested' : latestAttempt.reviewStatus === 'superseded' ? 'Closed · another attempt approved' : attemptApproved ? (latestAttempt.reviewStatus === 'approved' ? 'Approved' : 'Previously verified') : 'Submitted'}</b>
                        <small>Attempt {latestAttempt.attemptNumber} · {latestAttempt.executionMode === 'submission-only' ? 'Saved, not executed' : latestAttempt.validationEngine || 'Previous attempt'}</small>
                      </span>
                      {attemptApproved && <strong>{latestAttempt.pointsAwarded ? `+${latestAttempt.pointsAwarded} pts` : selectedProgress?.completed ? 'Points earned' : 'Approved'}</strong>}
                    </div>
                    {latestAttempt.reviewStatus === 'pending' && <p className="practice-validation-note">Your code is saved for review. No SQL was executed, and points will be awarded only if your instructor approves this challenge. You can draft locally, but only one submission can await review at a time.</p>}
                    {latestAttempt.reviewStatus === 'rejected' && latestAttempt.reviewFeedback && <p className="practice-validation-note"><b>Instructor feedback:</b> {latestAttempt.reviewFeedback}</p>}
                  </div>
                )}
              </section>
              <div className="practice-workspace-note"><Brain size={16} /><span>Each Arena challenge is reviewed independently. Approval awards 20 points once and locks that challenge; requesting changes awards no points. SQL/PLSQL is stored only until the review decision, then deleted.</span></div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

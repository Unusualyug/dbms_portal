import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Award, Check, CircleHelp, Clock3, RotateCcw } from 'lucide-react';
import { api } from '../services/api.js';
import { useQuestionHeartbeat } from '../hooks/useActiveTimer.js';
import { formatDuration } from '../utils/format.js';
import SectionHeading from '../components/SectionHeading.jsx';
import Loading from '../components/Loading.jsx';
import Notice from '../components/Notice.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function QuestionsPage() {
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const topicKey = searchParams.get('topic');
  useEffect(() => { api.get('/student/questions').then((data) => setQuestions(data.questions)).catch((e) => setError(e.message)); }, []);
  const moduleOptions = useMemo(() => [...new Map((questions || []).map((q) => [q.moduleId?._id, q.moduleId])).values()].filter(Boolean), [questions]);
  const filtered = useMemo(() => (questions || []).filter((q) => (moduleFilter === 'all' || q.moduleId?._id === moduleFilter) && (!topicKey || q.topicId?.key === topicKey) && `${q.title} ${q.prompt} ${q.topicId?.title || ''}`.toLowerCase().includes(search.toLowerCase())), [questions, moduleFilter, topicKey, search]);
  if (!questions && !error) return <Loading />;
  return <div><SectionHeading eyebrow="RETRIEVAL PRACTICE" title="Questions & quick checks" description="Earn 10 points the first time you answer each MCQ correctly. Repeated attempts do not add points." action={<span className="soft-badge"><CircleHelp size={15} /> {questions?.length || 0} practice questions</span>} />{error && <Notice type="error">{error}</Notice>}<div className="filter-toolbar"><label className="search-control"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions or topics" /></label><select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} aria-label="Filter by module"><option value="all">All modules</option>{moduleOptions.map((module) => <option value={module._id} key={module._id}>Module {module.moduleNumber}</option>)}</select></div>{topicKey && <div className="filter-note">Showing questions linked to this topic. <button onClick={() => window.history.replaceState({}, '', '/student/questions')}>Clear filter</button></div>}
    {filtered.length ? <div className="question-list">{filtered.map((question, index) => <QuestionItem question={question} index={index} key={question._id} />)}</div> : <EmptyState title="No question checks yet" text="The official PDF includes practical prompts and learning outcomes, but no per-topic quiz bank. More syllabus-derived checks can be added without changing the practical list." />}</div>;
}

function QuestionItem({ question, index }) {
  const [expanded, setExpanded] = useState(false);
  const [attemptId, setAttemptId] = useState(null);
  const [attemptNumber, setAttemptNumber] = useState(null);
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useQuestionHeartbeat(attemptId, expanded && !result);
  const start = async (retry = false) => {
    setBusy(true); setError(''); setResult(null); setSelected('');
    try { const data = await api.post(`/student/questions/${question._id}/start`); setAttemptId(data.attemptId); setAttemptNumber(data.attemptNumber); setExpanded(true); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (!selected) return setError('Choose an answer first.');
    setBusy(true); setError('');
    try { const data = await api.post(`/student/question-attempts/${attemptId}/submit`, { selectedAnswer: selected }); setResult(data); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const lastAttempt = question.lastAttempt;
  return <article className={`question-card ${expanded ? 'question-card-open' : ''}`}>
    <div className="question-card-head"><div className="question-number">{String(index + 1).padStart(2, '0')}</div><div className="question-card-title"><div className="question-meta"><span>MODULE {question.moduleId?.moduleNumber}</span><i>·</i><span>{question.topicId?.title || 'Course topic'}</span><span className="derived-tag">PORTAL PRACTICE</span></div><h3>{question.title}</h3><p>{question.prompt}</p></div><div className="question-card-state">{lastAttempt && <span className={`last-answer ${lastAttempt.isCorrect ? 'answer-correct' : 'answer-wrong'}`}>{lastAttempt.isCorrect ? 'Correct' : 'Review'}</span>}</div></div>
    {!expanded && <div className="question-card-footer"><span><Clock3 size={14} />{lastAttempt ? `${lastAttempt.attemptNumber} attempt${lastAttempt.attemptNumber > 1 ? 's' : ''} · latest ${formatDuration(lastAttempt.timeSpentSec)}` : 'Not attempted'}</span><button className="button button-outline button-sm" onClick={() => start()} disabled={busy}>{busy ? 'Opening…' : lastAttempt ? 'Try again' : 'Start question'} <ArrowRight size={14} /></button></div>}
    {expanded && <div className="question-workspace"><div className="question-attempt-banner"><span>ATTEMPT {attemptNumber}</span><span>Active time is tracked while the tab is visible.</span></div><div className="answer-options">{question.options?.map((option) => <label key={option.id} className={`answer-option ${selected === option.id ? 'answer-option-selected' : ''} ${result && option.id === result.correctAnswer ? 'answer-option-right' : ''}`}><input type="radio" name={`question-${question._id}`} value={option.id} checked={selected === option.id} onChange={() => setSelected(option.id)} disabled={Boolean(result)} /><span className="answer-option-letter">{option.id.toUpperCase()}</span><span>{option.text}</span>{result && option.id === result.correctAnswer && <Check size={16} className="answer-option-check" />}</label>)}</div>{error && <div className="inline-error">{error}</div>}{result && <div className={`question-result ${result.isCorrect ? 'question-result-good' : 'question-result-bad'}`}><b>{result.isCorrect ? 'Correct — well done.' : 'Not quite. Review the explanation below.'}</b><p>{result.explanation}</p><small>Attempt time: {formatDuration(result.timeSpentSec)}</small></div>}{result?.isCorrect && <div className={`points-feedback ${result.pointsAwarded ? 'points-awarded' : 'points-previously-awarded'}`}><Award size={17} /><span><b>{result.pointsAwarded ? `+${result.pointsAwarded} points earned!` : 'Points already earned for this MCQ'}</b><small>Total points: {(result.totalPoints || 0).toLocaleString()}</small></span></div>}<div className="question-actions">{!result ? <button className="button button-dark button-sm" onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit answer'} <Check size={15} /></button> : <button className="button button-outline button-sm" onClick={() => { setExpanded(false); setAttemptId(null); }}><RotateCcw size={15} /> Close check</button>}</div></div>}
  </article>;
}

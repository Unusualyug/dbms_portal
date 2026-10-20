import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, CircleHelp, Clock3, Sparkles } from 'lucide-react';
import { api } from '../services/api.js';
import { useActiveTimer } from '../hooks/useActiveTimer.js';
import { formatDuration } from '../utils/format.js';
import EducationalAnimation from '../components/EducationalAnimation.jsx';
import SqlCodeBlock from '../components/SqlCodeBlock.jsx';
import Loading from '../components/Loading.jsx';
import Notice from '../components/Notice.jsx';

export default function TopicDetailPage() {
  const { topicId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [completeMessage, setCompleteMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setData(null); setError(''); api.get(`/student/topics/${topicId}`).then(setData).catch((e) => setError(e.message)); }, [topicId]);
  const timer = useActiveTimer({ scopeType: 'topic', scopeId: data?.topic?._id, enabled: Boolean(data?.topic?._id && !data?.progress?.completedAt) });
  if (!data && !error) return <Loading />;
  if (error) return <Notice type="error">{error}</Notice>;
  const { topic, module, progress, navigation, relatedQuestions } = data;
  const learnedSeconds = progress?.completedAt ? (progress.timeSpentSec || 0) : (progress?.timeSpentSec || 0) + timer.elapsedSeconds;
  const canComplete = learnedSeconds >= 20 && !progress?.completedAt;
  const complete = async () => {
    setBusy(true); setCompleteMessage('');
    try { await timer.flush(); const result = await api.post(`/student/topics/${topic._id}/complete`); setData((value) => ({ ...value, progress: { ...value.progress, completedAt: result.completedAt, timeSpentSec: result.timeSpentSec } })); setCompleteMessage('Topic marked complete. Nice work.'); }
    catch (e) { setCompleteMessage(e.message); }
    finally { setBusy(false); }
  };
  return <div className="topic-page"><div className="topic-breadcrumb"><Link to={`/student/modules/${module.slug}`}><ArrowLeft size={15} /> Module {module.moduleNumber}</Link><span>/</span><span>{topic.group}</span></div><div className="topic-title-row"><div><span className="eyebrow">MODULE {String(module.moduleNumber).padStart(2, '0')} · TOPIC {String(topic.order).padStart(2, '0')}</span><h1>{topic.title}</h1><p>{module.title}</p></div><div className="topic-time-chip"><Clock3 size={15} /> Active learning <b>{formatDuration(learnedSeconds)}</b></div></div>
    <div className="topic-content-layout"><main className="topic-main-column"><EducationalAnimation animationKey={topic.animationKey} title={topic.title} /><section className="lesson-section"><span className="lesson-label"><Sparkles size={15} /> THE SIMPLE VERSION</span><h2>What is {topic.title}?</h2><p>{topic.explanation}</p></section><section className="lesson-section important-section"><div className="lesson-section-heading"><span className="lesson-bullet teal-bullet">✓</span><h2>Important points</h2></div><ul className="important-list">{topic.importantPoints?.map((item) => <li key={item}>{item}</li>)}</ul></section><section className="lesson-example-card"><div className="lesson-section-heading"><span className="lesson-bullet purple-bullet">↗</span><h2>Example</h2></div><p>{topic.example}</p>{/[;\n]|SELECT|CREATE|INSERT|UPDATE|DECLARE|GRANT|REVOKE/i.test(topic.example || '') && <SqlCodeBlock code={topic.example} />}</section><section className="analogy-card"><span className="analogy-icon">≈</span><div><span className="eyebrow">A REAL-WORLD WAY TO THINK ABOUT IT</span><p>{topic.analogy}</p></div></section>
    {relatedQuestions?.length > 0 ? <section className="quick-check-card"><div className="lesson-section-heading"><span className="lesson-bullet orange-bullet"><CircleHelp size={15} /></span><div><h2>Quick check</h2><p>{relatedQuestions.length} syllabus-derived practice question{relatedQuestions.length > 1 ? 's' : ''} linked to this topic.</p></div></div><Link to={`/student/questions?topic=${topic.key}`} className="text-link">Try a question <ArrowRight size={15} /></Link></section> : <section className="quick-check-card muted-quick-check"><div className="lesson-section-heading"><span className="lesson-bullet orange-bullet"><CircleHelp size={15} /></span><div><h2>Practice check</h2><p>Question bank items are added separately from the official practical list.</p></div></div><Link to="/student/questions" className="text-link">Browse available questions <ArrowRight size={15} /></Link></section>}
    </main><aside className="topic-side-column"><section className="surface-card topic-progress-card"><div className="side-title"><span className="side-title-icon teal"><BookOpenCheck size={17} /></span><div><span className="eyebrow">YOUR PROGRESS</span><h3>{progress?.completedAt ? 'Completed' : 'In progress'}</h3></div></div><div className="topic-progress-time"><Clock3 size={15} /><span>Active time tracked</span><b>{formatDuration(learnedSeconds)}</b></div><p>Time counts only while this page is visible and active. At least 20 seconds are needed to mark this lesson complete.</p>{progress?.completedAt ? <div className="complete-confirm"><Check size={16} /> Completed</div> : <button disabled={!canComplete || busy} onClick={complete} className="button button-dark button-full">{busy ? 'Saving…' : 'Mark as completed'} {!busy && <Check size={15} />}</button>}{completeMessage && <p className={completeMessage.includes('marked') ? 'success-message' : 'inline-error'}>{completeMessage}</p>}</section><section className="surface-card topic-next-card"><span className="eyebrow">KEEP GOING</span><h3>{navigation?.next ? 'Next topic' : 'End of module'}</h3>{navigation?.next ? <><p>{navigation.next.title}</p><Link className="text-link" to={`/student/topics/${navigation.next.key}`}>Continue <ArrowRight size={15} /></Link></> : <><p>You've reached the last topic in this module.</p><Link className="text-link" to={`/student/modules/${module.slug}`}>Back to module <ArrowRight size={15} /></Link></>}</section></aside></div>
    <div className="topic-pager"><div>{navigation?.previous && <Link to={`/student/topics/${navigation.previous.key}`} className="button button-outline"><ArrowLeft size={15} /> Previous topic</Link>}</div><div>{navigation?.next && <Link to={`/student/topics/${navigation.next.key}`} className="button button-dark">Next topic <ArrowRight size={15} /></Link>}</div></div></div>;
}

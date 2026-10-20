import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock3, Code2, Layers3 } from 'lucide-react';
import { api } from '../services/api.js';
import { formatDuration } from '../utils/format.js';
import ProgressBar from '../components/ProgressBar.jsx';
import SectionHeading from '../components/SectionHeading.jsx';
import Loading from '../components/Loading.jsx';
import Notice from '../components/Notice.jsx';

export default function ProgressPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/student/progress').then(setData).catch((e) => setError(e.message)); }, []);
  if (!data && !error) return <Loading />;
  const completed = data?.topicRows?.filter((topic) => topic.progress?.completedAt).length || 0;
  const total = data?.topicRows?.length || 0;
  const totalSeconds = data?.times?.reduce((sum, item) => sum + item.activeSeconds, 0) || 0;
  return <div><SectionHeading eyebrow="PERSONAL ANALYTICS" title="Your progress" description="See your topic, question and practical journey across every official course module." action={<span className="soft-badge"><Layers3 size={15} /> {Math.round(total ? completed / total * 100 : 0)}% overall</span>} />{error && <Notice type="error">{error}</Notice>}<div className="progress-overview-grid"><div className="progress-overview-main surface-card"><div className="progress-overview-numbers"><strong>{completed}<small>/{total}</small></strong><span>topics completed</span></div><ProgressBar value={total ? Math.round(completed / total * 100) : 0} label="Course syllabus progress" /><div className="progress-overview-bottom"><span><Clock3 size={15} /> {formatDuration(totalSeconds)} active time</span><span><BookOpen size={15} /> Topic completion is time-gated</span></div></div><div className="progress-mini surface-card"><span className="mini-icon blue"><Code2 size={18} /></span><span className="eyebrow">PRACTICAL PROGRESS</span><b>{new Set(data?.practicalAttempts?.filter((item) => item.completedAt).map((item) => String(item.practicalId))).size} approved</b><small>Only instructor-approved work counts.</small></div><div className="progress-mini surface-card"><span className="mini-icon violet"><Clock3 size={18} /></span><span className="eyebrow">ACTIVE LEARNING</span><b>{formatDuration(totalSeconds)}</b><small>Heartbeat-based, visible-tab time</small></div></div><div className="progress-module-list">{data?.modules?.map((module) => <section className="surface-card progress-module-card" key={module.moduleNumber}><div className="progress-module-header"><div className={`small-module-number module-tone-${module.moduleNumber}`}>0{module.moduleNumber}</div><div><h3>{module.title}</h3><span>{module.completedTopics} of {module.totalTopics} topics complete · {formatDuration(module.activeSeconds)} active</span></div><b>{module.percent}%</b></div><ProgressBar value={module.percent} compact /><div className="progress-topic-list">{module.topics.map((topic) => <div className="progress-topic-row" key={topic._id}><span className={`topic-status ${topic.progress?.completedAt ? 'topic-status-done' : ''}`}>{topic.progress?.completedAt ? '✓' : String(topic.order).padStart(2, '0')}</span><span>{topic.title}</span><small>{topic.progress?.completedAt ? 'Completed' : topic.progress?.openedCount ? 'Opened' : 'Not started'}</small><Link to={`/student/topics/${topic.key}`} aria-label={`Open ${topic.title}`}><ArrowRight size={14} /></Link></div>)}</div></section>)}</div></div>;
}

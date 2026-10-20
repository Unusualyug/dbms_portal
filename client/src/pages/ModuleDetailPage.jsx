import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, ChevronRight, Code2, ExternalLink, Target } from 'lucide-react';
import { api } from '../services/api.js';
import SectionHeading from '../components/SectionHeading.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import Loading from '../components/Loading.jsx';
import Notice from '../components/Notice.jsx';

export default function ModuleDetailPage() {
  const { moduleId } = useParams();
  const [module, setModule] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { setModule(null); api.get(`/student/modules/${moduleId}`).then((data) => setModule(data.module)).catch((e) => setError(e.message)); }, [moduleId]);
  const groups = useMemo(() => {
    const map = new Map();
    for (const topic of module?.topics || []) {
      if (!map.has(topic.group)) map.set(topic.group, []);
      map.get(topic.group).push(topic);
    }
    return [...map.entries()];
  }, [module]);
  if (!module && !error) return <Loading />;
  if (error) return <Notice type="error">{error}</Notice>;
  return <div className="module-detail-page"><Link className="back-link" to="/student/modules"><ArrowLeft size={15} /> All modules</Link><div className="module-detail-hero"><div className="module-detail-intro"><span className="eyebrow">MODULE {String(module.moduleNumber).padStart(2, '0')} · {module.hours} HOURS · {module.weightagePercent}%</span><h1>{module.title}</h1><p>Work through the topics in sequence, then use the official practical list to practise what you’ve learned.</p><div className="module-detail-actions"><Link className="button button-dark" to={`/student/lab?module=${module.slug}`}><Code2 size={16} /> Submit practicals</Link><Link className="button button-outline" to={`/student/questions?module=${module._id}`}><Target size={16} /> Questions</Link></div></div><div className="module-detail-progress"><div className="progress-ring progress-ring-small" style={{ '--progress': `${module.progressPercent}%` }}><div><strong>{module.progressPercent}<small>%</small></strong><span>complete</span></div></div><span>{module.completedTopicCount}/{module.topics.length} topics</span></div></div>
    <div className="module-content-grid"><section className="surface-card topic-list-card"><div className="card-heading"><div><span className="eyebrow">TOPIC SEQUENCE</span><h2>Learn the concepts</h2></div><span className="subtle-count">{module.topics.length} syllabus entries</span></div>{groups.map(([group, topics]) => <div className="topic-group" key={group}><h3>{group}</h3><div className="topic-list">{topics.map((topic) => <Link className="topic-list-row" to={`/student/topics/${topic.key}`} key={topic._id}><span className={`topic-status ${topic.progress?.completedAt ? 'topic-status-done' : ''}`}>{topic.progress?.completedAt ? <Check size={14} /> : String(topic.order).padStart(2, '0')}</span><span className="topic-list-name">{topic.title}<small>{topic.progress?.completedAt ? 'Completed' : topic.progress?.openedCount ? 'In progress' : 'Not started'}</small></span><ChevronRight size={17} /></Link>)}</div></div>)}</section>
      <aside className="module-side-column"><section className="surface-card practical-summary"><div className="side-title"><span className="side-title-icon orange"><Code2 size={17} /></span><div><span className="eyebrow">PRACTICAL SUBMISSIONS</span><h3>Official tasks</h3></div></div><p>Exactly {module.practicals.length} practical prompts are included for this module.</p><div className="practical-summary-stats"><span><b>{module.completedPracticals}</b><small>completed</small></span><span><b>{module.practicals.length}</b><small>official tasks</small></span></div><ProgressBar value={module.practicals.length ? Math.round(module.completedPracticals / module.practicals.length * 100) : 0} compact /><Link className="text-link" to={`/student/lab?module=${module.slug}`}>Submit practicals <ArrowRight size={15} /></Link></section>
      <section className="surface-card module-assessments"><div className="side-title"><span className="side-title-icon blue"><BookOpenCheck size={17} /></span><div><span className="eyebrow">COURSE FILE</span><h3>Assessment activities</h3></div></div>{(module.assessments || []).map((assessment) => <div className="assessment-item" key={assessment.title}><b>{assessment.title}</b><span>{assessment.marks} marks</span><p>{assessment.description}</p></div>)}<div className="official-source-note"><ExternalLink size={14} /> Imported from the official syllabus.</div></section></aside></div><div className="module-nav-footer">{module.topics?.[0] && <Link to={`/student/topics/${module.topics[0].key}`} className="button button-light">Start module <ArrowRight size={15} /></Link>}<span>Opening is tracked separately from completing.</span></div></div>;
}

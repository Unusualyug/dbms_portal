import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Award, BookOpen, Brain, CheckCircle2, CircleHelp, Clock3, Code2, Compass, Sparkles } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDuration, formatTimeAgo } from '../utils/format.js';
import { chartColors } from '../utils/analytics.js';
import StatCard from '../components/StatCard.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import Loading from '../components/Loading.jsx';
import Notice from '../components/Notice.jsx';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const load = () => api.get('/student/dashboard').then(setData).catch((requestError) => setError(requestError.message));
    load();
    window.addEventListener('portal:submission-reviewed', load);
    return () => window.removeEventListener('portal:submission-reviewed', load);
  }, []);
  if (!data && !error) return <Loading />;
  const stats = data?.stats || {};
  const attempted = stats.questionsAttempted || 0;
  const accuracy = attempted ? Math.round((stats.correctAnswers / attempted) * 100) : 0;
  const questionPie = [{ name: 'Correct', value: stats.correctAnswers || 0 }, { name: 'Incorrect', value: stats.incorrectAnswers || 0 }];
  const lastTopic = data?.recentTopics?.[0];
  const continueHref = data?.recommendedNextTopic?.key
    ? `/student/topics/${data.recommendedNextTopic.key}`
    : lastTopic?.topicKey ? `/student/topics/${lastTopic.topicKey}` : '/student/modules';
  const continueLabel = data?.recommendedNextTopic || lastTopic ? 'Continue learning' : 'Explore modules';
  const firstName = user?.name?.trim()?.split(/\s+/)[0] || 'learner';

  return (
    <div className="student-dashboard">
      <header className="student-dashboard-heading">
        <div>
          <span className="eyebrow">YOUR LEARNING OVERVIEW</span>
          <h1>Good to see you, <em>{firstName}.</em></h1>
          <p>Small, consistent study sessions add up. Here’s where your DBMS journey stands today.</p>
        </div>
        <Link to={continueHref} className="button button-dark">{continueLabel} <ArrowRight size={16} /></Link>
      </header>
      {error && <Notice type="error">{error}</Notice>}

      <div className="dashboard-top-grid student-dashboard-hero-grid">
        <section className="overall-card"><div className="overall-card-copy"><span className="eyebrow">COURSE PROGRESS</span><h2>Keep your<br />momentum.</h2><p>Complete a topic after spending focused, active time with the lesson.</p><Link to="/student/progress" className="text-link">View full progress <ArrowRight size={15} /></Link></div><div className="progress-ring" style={{ '--progress': `${stats.overallProgress || 0}%` }}><div><strong>{stats.overallProgress || 0}<small>%</small></strong><span>complete</span></div></div><div className="overall-foot"><span><CheckCircle2 size={15} /> {stats.topicsCompleted || 0} of {stats.topicsTotal || 0} topics completed</span><span>{stats.modulesCompleted || 0} / {stats.moduleCount || 5} modules</span></div></section>
        <section className="recommend-card"><div className="recommend-glow" /><div className="recommend-top"><span className="recommend-icon"><Compass size={19} /></span><span className="recommend-label">RECOMMENDED NEXT</span></div>{data?.recommendedNextTopic ? <><h3>{data.recommendedNextTopic.title}</h3><p>Module {data.recommendedNextTopic.module?.moduleNumber} · {data.recommendedNextTopic.module?.title}</p><Link className="button button-light" to={`/student/topics/${data.recommendedNextTopic.key}`}>Open lesson <ArrowRight size={15} /></Link></> : <><h3>Your syllabus path is clear.</h3><p>Open a module to review the official DBMS topics.</p><Link className="button button-light" to="/student/modules">Browse modules <ArrowRight size={15} /></Link></>}</section>
      </div>

      <div className="stat-grid student-overview-stats">
        <StatCard label="Topics completed" value={`${stats.topicsCompleted || 0}/${stats.topicsTotal || 0}`} detail="Opened ≠ completed" icon={BookOpen} tone="teal" />
        <StatCard label="Questions attempted" value={stats.questionsAttempted || 0} detail={`${accuracy}% accuracy so far`} icon={CircleHelp} tone="blue" />
        <StatCard label="Practical tasks" value={`${stats.practicalsCompleted || 0}/${stats.practicalsTotal || 0}`} detail={`${stats.practicalsAttempted || 0} official tasks attempted`} icon={Code2} tone="orange" />
        <StatCard label="Reward points" value={(stats.totalPoints || 0).toLocaleString()} detail="10 per MCQ · 20 per approved practical/challenge" icon={Sparkles} tone="violet" />
        <StatCard label="Active learning time" value={formatDuration(stats.learningTimeSec)} detail="Visible, active sessions only" icon={Clock3} tone="blue" />
      </div>

      <div className="student-dashboard-layout">
        <div className="student-dashboard-primary">
          <section className="surface-card dashboard-module-card"><div className="card-heading"><div><span className="eyebrow">THE COURSE MAP</span><h2>Module progress</h2></div><Link to="/student/modules" className="icon-link">All modules <ArrowRight size={15} /></Link></div><div className="module-progress-list">{data?.modules?.map((module) => <Link key={module.moduleNumber} to={`/student/modules/module-${module.moduleNumber}`} className="module-progress-item"><div className={`small-module-number module-tone-${module.moduleNumber}`}>0{module.moduleNumber}</div><div className="module-progress-main"><div className="module-progress-title"><b>{module.title}</b><span>{module.completedTopics}/{module.topicCount} topics</span></div><ProgressBar value={module.progressPercent} compact /></div></Link>)}</div></section>

          <section className="practice-arena-promo" aria-labelledby="dashboard-practice-arena-title">
            <div className="practice-arena-promo-icon"><Brain size={23} /></div>
            <div className="practice-arena-promo-copy">
              <span className="eyebrow">INDEPENDENT PRACTICE · 7 ROUNDS</span>
              <h2 id="dashboard-practice-arena-title">🧠 Practice Arena</h2>
              <p>Work through the extra SQL and PL/SQL practical questions, organized by round—not by course module.</p>
              <div className="practice-arena-tags"><span>DDL &amp; DML</span><span>Joins</span><span>Sequences</span><span>PL/SQL</span></div>
            </div>
            <Link to="/student/arena" className="button button-dark">Enter Practice Arena <ArrowRight size={16} /></Link>
          </section>

          <section className="surface-card dashboard-recent-topics"><div className="card-heading"><div><span className="eyebrow">RECENT STUDY</span><h2>Recently opened topics</h2></div><Activity size={18} className="muted-icon" /></div>{data?.recentTopics?.length ? <div className="activity-list">{data.recentTopics.map((event, i) => <Link to={`/student/topics/${event.topicKey}`} key={`${event.topicKey}-${i}`} className="recent-topic-row"><span className="recent-topic-mark"><BookOpen size={16} /></span><span><b>{event.title}</b><small>{event.moduleTitle}</small></span><time>{formatTimeAgo(event.timestamp)}</time></Link>)}</div> : <div className="mini-empty">Your opened topics will show here.</div>}</section>
        </div>

        <aside className="student-dashboard-rail" aria-label="Learning activity and performance">
          <section className="surface-card performance-card"><div className="card-heading"><div><span className="eyebrow">QUIZ PRACTICE</span><h2>Answer accuracy</h2></div><div className="metric-icon"><Award size={18} /></div></div><div className="accuracy-visual"><div className="accuracy-number"><strong>{accuracy}<small>%</small></strong><span>{attempted} questions</span></div><div className="accuracy-pie"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={questionPie} dataKey="value" innerRadius={34} outerRadius={52} paddingAngle={4} stroke="none">{questionPie.map((entry, index) => <Cell key={entry.name} fill={index === 0 ? chartColors.teal : 'var(--chart-empty)'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></div><div className="accuracy-legend"><span><i className="legend-dot legend-correct" />Correct <b>{stats.correctAnswers || 0}</b></span><span><i className="legend-dot legend-incorrect" />Incorrect <b>{stats.incorrectAnswers || 0}</b></span></div><Link className="text-link" to="/student/questions">Practice more questions <ArrowRight size={15} /></Link></section>

          <section className="surface-card dashboard-question-attempts"><div className="card-heading"><div><span className="eyebrow">RECENT CHECKS</span><h2>Question attempts</h2></div><Link to="/student/questions" className="icon-link">Practice <ArrowRight size={15} /></Link></div>{data?.recentQuestions?.length ? <div className="recent-question-list">{data.recentQuestions.map((item, i) => <div className="recent-question-row" key={`${item.title}-${i}`}><span className={`answer-mark ${item.isCorrect ? 'answer-correct' : 'answer-wrong'}`}>{item.isCorrect ? '✓' : '×'}</span><span><b>{item.title}</b><small>{formatDuration(item.timeSpentSec)} · Module {item.moduleNumber}</small></span></div>)}</div> : <div className="mini-empty">Your completed practice questions will appear here.</div>}</section>
        </aside>
      </div>

      <div className="dashboard-footer-note"><Sparkles size={16} /><span>Portal practice checks are clearly labeled and derived from the official course topics. The official practical list remains unchanged.</span></div>
    </div>
  );
}

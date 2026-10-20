import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, BookOpen, CheckCircle2, CirclePlay, Clock3, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../services/api.js';
import PortalLogo from '../components/PortalLogo.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import HeroAnimation from '../components/HeroAnimation.jsx';
import Loading from '../components/Loading.jsx';

export default function LandingPage() {
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/content/syllabus').then(setCourse).catch(() => setCourse(null)).finally(() => setLoading(false)); }, []);
  const modules = course?.modules || [];
  const practicalCount = modules.reduce((sum, module) => sum + (module.practicals?.length || 0), 0);
  return <div className="landing-page">
    <header className="landing-nav"><Link to="/" className="brand-link"><PortalLogo /></Link><nav><a href="#course-map">Course map</a><a href="#outcomes">Learning outcomes</a><Link to="/login">Sign in</Link><ThemeToggle /><Link to="/register" className="nav-cta">Create account <ArrowRight size={15} /></Link></nav></header>
    <section className="hero-section">
      <div className="hero-noise" />
      <div className="hero-copy"><div className="hero-kicker"><span className="kicker-dot" />GMIU · SEMESTER 3 · BETICE13305</div><motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>Make databases<br /><em>make sense.</em></motion.h1><p className="hero-description">A guided DBMS course space for learning Oracle SQL and PL/SQL, practising official lab tasks, and making steady progress—one concept at a time.</p><div className="hero-actions"><Link className="button button-light" to="/register">Start learning <ArrowRight size={17} /></Link><a className="button button-ghost" href="#course-map"><CirclePlay size={17} /> Explore course</a></div><div className="hero-trust"><span><ShieldCheck size={15} /> Syllabus aligned</span><span><Clock3 size={15} /> Active time tracking</span><span><Target size={15} /> Practical-first</span></div></div>
      <div className="hero-visual-wrap"><div className="hero-orbit-ring" /><HeroAnimation /><div className="hero-floating-card hero-float-top"><span className="float-icon"><BookOpen size={16} /></span><span><b>5 official modules</b><small>structured learning path</small></span></div><div className="hero-floating-card hero-float-bottom"><span className="float-check"><CheckCircle2 size={18} /></span><span><b>Oracle-first lab</b><small>no dialect substitutions</small></span></div><div className="hero-spark hero-spark-a">✳</div><div className="hero-spark hero-spark-b">✦</div></div>
      <a href="#course-map" className="hero-scroll">SCROLL TO EXPLORE <ArrowDownRight size={15} /></a>
    </section>
    <section className="landing-metrics"><div><strong>{modules.length || '5'}</strong><span>official modules</span></div><div><strong>{practicalCount || '52'}</strong><span>official practicals</span></div><div><strong>{course?.course?.courseHours || 90}</strong><span>course hours</span></div><div><strong>Oracle</strong><span>primary SQL dialect</span></div></section>
    <section className="landing-content" id="course-map"><div className="landing-section-head"><div><span className="eyebrow">THE LEARNING PATH</span><h2>One course. Five clear steps.</h2><p>Module titles, topic ordering and practical counts come directly from the uploaded university syllabus.</p></div><Link className="text-link" to="/login">Continue to portal <ArrowRight size={15} /></Link></div>
      {loading ? <Loading label="Reading the official course map…" /> : <div className="module-preview-grid">{modules.map((module) => <motion.article key={module.id} className="module-preview-card" whileHover={{ y: -4 }}><div className="module-preview-top"><span className={`module-index module-tone-${module.moduleNumber}`}>0{module.moduleNumber}</span><span className="module-weight">{module.weightagePercent}% weight</span></div><h3>{module.title}</h3><div className="module-preview-meta"><span><BookOpen size={14} /> {module.topics?.length || 0} topics</span><span><Target size={14} /> {module.practicals?.length || 0} practicals</span></div><div className="module-topic-preview">{module.topics?.slice(0, 3).map((topic) => <span key={topic.id}>{topic.title}</span>)}</div><div className="module-preview-bottom"><span>{module.hours} course hours</span><ArrowRight size={16} /></div></motion.article>)}</div>}
    </section>
    <section className="outcomes-section" id="outcomes"><div className="outcome-intro"><span className="eyebrow">WHAT YOU’LL BE ABLE TO DO</span><h2>Learn the ideas.<br /><em>Use them with confidence.</em></h2><p>Course outcomes are taken from the official syllabus. Progress and activity are kept separate, so opening a topic does not count as completing it.</p><Link to="/register" className="button button-dark">Join the course <ArrowRight size={16} /></Link></div><div className="outcome-list">{(course?.course?.courseOutcomes || []).map((outcome, i) => <div className="outcome-row" key={outcome.code}><span>0{i + 1}</span><div><b>{outcome.code}</b><p>{outcome.text}</p></div><CheckCircle2 size={18} /></div>)}</div></section>
    <section className="landing-bottom-cta"><div className="cta-icon"><Sparkles size={22} /></div><div><span className="eyebrow">YOUR DBMS WORKSPACE</span><h2>Start with the syllabus. Build real understanding.</h2><p>Practice questions are labeled as learning checks; official practicals remain exactly as listed in the course file.</p></div><Link to="/register" className="button button-light">Create student account <ArrowRight size={16} /></Link></section>
    <footer className="landing-footer"><PortalLogo /><span>Course BETICE13305 · Gyanmanjari Institute of Technology</span><span>Learning content is sourced from the official course file.</span></footer>
  </div>;
}

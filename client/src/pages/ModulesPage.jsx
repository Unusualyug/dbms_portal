import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Code2, LockKeyhole } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../services/api.js';
import SectionHeading from '../components/SectionHeading.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import Loading from '../components/Loading.jsx';
import Notice from '../components/Notice.jsx';

export default function ModulesPage() {
  const [modules, setModules] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/student/modules').then((data) => setModules(data.modules)).catch((e) => setError(e.message)); }, []);
  if (!modules && !error) return <Loading />;
  return <div><SectionHeading eyebrow="OFFICIAL COURSE CONTENT" title="Your DBMS modules" description="Every topic and practical follows the original course-file order. Your learning progress is saved as you go." action={<span className="verified-pill"><LockKeyhole size={14} /> 5-module syllabus</span>} />{error && <Notice type="error">{error}</Notice>}<div className="modules-grid">{modules?.map((module) => <motion.article key={module._id} className="module-card" whileHover={{ y: -3 }}><Link className="module-card-link" to={`/student/modules/${module.slug}`}><div className="module-card-top"><span className={`module-index module-tone-${module.moduleNumber}`}>0{module.moduleNumber}</span><span className="module-weight">{module.weightagePercent}% weight</span></div><h2>{module.title}</h2><div className="module-card-stats"><span><BookOpen size={15} /> {module.completedTopics}/{module.topicCount} topics</span><span><Code2 size={15} /> {module.completedPracticals}/{module.practicalCount} practicals</span></div><ProgressBar value={module.progressPercent} label="Module learning progress" /><div className="module-card-footer"><span>{module.hours} course hours</span><span className="arrow-circle"><ArrowRight size={17} /></span></div></Link></motion.article>)}</div><div className="syllabus-note"><LockKeyhole size={16} /><span>Topic names, order and official practical counts are imported from the course file. The portal does not add or remove practical questions.</span></div></div>;
}

import { motion } from 'framer-motion';

export default function ProgressBar({ value = 0, label, compact = false, tone = 'teal' }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className={`progress-wrap ${compact ? 'progress-compact' : ''}`}>
    {(label || !compact) && <div className="progress-label"><span>{label || 'Progress'}</span><b>{safe}%</b></div>}
    <div className="progress-track" role="progressbar" aria-label={label || 'Progress'} aria-valuetext={`${safe}% complete`} aria-valuenow={safe} aria-valuemin="0" aria-valuemax="100">
      <motion.span className={`progress-fill progress-${tone}`} initial={{ width: 0 }} animate={{ width: `${safe}%` }} transition={{ duration: 0.75, ease: 'easeOut' }} />
    </div>
  </div>;
}

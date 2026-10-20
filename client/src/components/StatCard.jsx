import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StatCard({ label, value, detail, icon: Icon, tone = 'teal', footer }) {
  return (
    <motion.article
      className={`stat-card stat-${tone}`}
      aria-label={`${label}: ${value}. ${detail}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
    >
      <div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={18} /></div></div>
      <strong className="stat-value">{value}</strong>
      <div className="stat-bottom"><span>{detail}</span>{footer || <ArrowUpRight size={15} />}</div>
    </motion.article>
  );
}

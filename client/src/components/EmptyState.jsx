import { BookOpenCheck } from 'lucide-react';
export default function EmptyState({ title = 'Nothing here yet', text = 'Your learning activity will appear here as you explore the course.', icon: Icon = BookOpenCheck }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><h3>{title}</h3><p>{text}</p></div>;
}

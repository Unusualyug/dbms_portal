import { Check, CircleHelp, Code2, FileText, LogIn, Play, ShieldCheck } from 'lucide-react';
import { formatTimeAgo, titleCaseEvent } from '../utils/format.js';
const iconMap = { LOGIN: LogIn, TOPIC_OPENED: BookIcon, TOPIC_COMPLETED: Check, QUESTION_SUBMITTED: CircleHelp, PRACTICAL_RUN: Code2, PRACTICAL_COMPLETED: ShieldCheck, MODULE_OPENED: FileText, PRACTICAL_SUBMITTED: Play };
function BookIcon(props) { return <FileText {...props} />; }
export default function ActivityRow({ event, admin = false }) {
  const Icon = iconMap[event.eventType] || FileText;
  const subject = event.topic || event.question || (event.practicalNumber ? `Practical ${String(event.practicalNumber).padStart(2, '0')}` : event.module?.title) || titleCaseEvent(event.eventType);
  return <div className="activity-row"><div className={`activity-icon event-${event.eventType?.toLowerCase()}`}><Icon size={16} /></div><div className="activity-copy"><b>{admin ? event.student?.name || 'Student' : subject}</b><span>{admin ? `${titleCaseEvent(event.eventType)}${subject ? ` · ${subject}` : ''}` : `${titleCaseEvent(event.eventType)}${event.moduleTitle ? ` · ${event.moduleTitle}` : ''}`}</span></div><time>{formatTimeAgo(event.timestamp)}</time></div>;
}

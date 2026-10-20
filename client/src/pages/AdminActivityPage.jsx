import { useEffect, useState } from 'react';
import { Download, Filter, RefreshCw, Search } from 'lucide-react';
import { api } from '../services/api.js';
import { formatDate, titleCaseEvent } from '../utils/format.js';
import { useDebounce } from '../hooks/useDebounce.js';
import SectionHeading from '../components/SectionHeading.jsx';
import Loading from '../components/Loading.jsx';
import Notice from '../components/Notice.jsx';

const eventTypes = ['', 'LOGIN', 'LOGOUT', 'MODULE_OPENED', 'TOPIC_OPENED', 'TOPIC_COMPLETED', 'QUESTION_STARTED', 'QUESTION_SUBMITTED', 'PRACTICAL_OPENED', 'PRACTICAL_RUN', 'PRACTICAL_SUBMITTED', 'PRACTICAL_COMPLETED'];
export default function AdminActivityPage() {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 350);
  const [eventType, setEventType] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const debouncedStudent = useDebounce(studentQuery, 350);
  const [modules, setModules] = useState([]);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  useEffect(() => { api.get('/content/syllabus').then((d) => setModules(d.modules)).catch(() => {}); }, []);
  useEffect(() => { const params = new URLSearchParams({ page: String(page), limit: '50' }); if (eventType) params.set('eventType', eventType); if (moduleId) params.set('moduleId', moduleId); if (debouncedStudent) params.set('student', debouncedStudent); if (debounced) params.set('q', debounced); api.get(`/admin/activity?${params}`).then(setData).catch((e) => setError(e.message)); }, [eventType, moduleId, debouncedStudent, debounced, page]);
  const exportCsv = async () => { setExporting(true); try { await api.download('/admin/export/activity', 'dbms-activity-report.csv'); } catch (e) { setError(e.message); } finally { setExporting(false); } };
  if (!data && !error) return <Loading />;
  return <div><SectionHeading eyebrow="LIVE ACTIVITY AUDIT" title="Student activity feed" description="Filter meaningful learning events, quiz answers and practical submissions by student, module, type and date." action={<button className="button button-outline button-sm" onClick={exportCsv} disabled={exporting}><Download size={15} />{exporting ? 'Preparing…' : 'Export CSV'}</button>} />{error && <Notice type="error">{error}</Notice>}<div className="activity-filter-grid"><label className="search-control"><Search size={16} /><input value={studentQuery} onChange={(e) => { setStudentQuery(e.target.value); setPage(1); }} placeholder="Student name, email or ID" /></label><label className="search-control"><Filter size={15} /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search event fields" /></label><select value={eventType} onChange={(e) => { setEventType(e.target.value); setPage(1); }} aria-label="Event type">{eventTypes.map((type) => <option value={type} key={type}>{type ? titleCaseEvent(type) : 'All event types'}</option>)}</select><select value={moduleId} onChange={(e) => { setModuleId(e.target.value); setPage(1); }} aria-label="Module"><option value="">All modules</option>{modules.map((module) => <option key={module.id} value={module.id}>Module {module.moduleNumber}</option>)}</select><button className="button button-outline button-sm" onClick={() => window.location.reload()}><RefreshCw size={14} />Refresh</button></div><section className="surface-card activity-table-card"><div className="card-heading"><div><span className="eyebrow">RECENT EVENT LOG</span><h2>{data?.pagination?.total || 0} matching events</h2></div><span className="live-status-label"><i className="live-dot" /> real-time enabled</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Time</th><th>Student</th><th>Event</th><th>Module / topic</th><th>Related item</th><th>Session</th></tr></thead><tbody>{data?.events?.map((event) => <tr key={event.id}><td>{formatDate(event.timestamp)}</td><td><b>{event.student?.name || '—'}</b><small className="table-sub">{event.student?.studentId}</small></td><td><span className="event-type-chip">{titleCaseEvent(event.eventType)}</span></td><td>{event.module?.number ? `Module ${event.module.number}` : '—'}<small className="table-sub">{event.topic || ''}</small></td><td>{event.question || (event.practicalNumber ? `Practical ${String(event.practicalNumber).padStart(2,'0')}` : '—')}</td><td className="session-id">{event.sessionId?.slice(0, 8) || '—'}</td></tr>)}</tbody></table></div>{!data?.events?.length && <div className="table-empty">No activity matches the selected filters.</div>}<div className="table-pagination"><span>Page {data?.pagination?.page || 1} of {Math.max(1, data?.pagination?.pages || 1)}</span><div><button className="button button-outline button-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><button className="button button-outline button-sm" disabled={page >= (data?.pagination?.pages || 1)} onClick={() => setPage((p) => p + 1)}>Next</button></div></div></section></div>;
}

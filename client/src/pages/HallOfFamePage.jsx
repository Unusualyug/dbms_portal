import { useEffect, useState } from 'react';
import { Award, Crown, Filter, Medal, Sparkles, Trophy } from 'lucide-react';
import { api } from '../services/api.js';
import SectionHeading from '../components/SectionHeading.jsx';
import Loading from '../components/Loading.jsx';
import Notice from '../components/Notice.jsx';

function initials(name) {
  return String(name || 'Student').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export default function HallOfFamePage() {
  const [semester, setSemester] = useState('all');
  const [classSection, setClassSection] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    const params = new URLSearchParams();
    if (semester !== 'all') params.set('semester', semester);
    if (classSection !== 'all') params.set('classSection', classSection);
    setLoading(true);
    setError('');
    const query = params.toString();
    api.get(`/student/hall-of-fame${query ? `?${query}` : ''}`)
      .then((result) => { if (current) setData(result); })
      .catch((requestError) => { if (current) setError(requestError.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [semester, classSection]);

  if (!data && loading) return <Loading />;

  const cohort = [semester !== 'all' ? `Semester ${semester}` : '', classSection !== 'all' ? `Class ${classSection}` : '']
    .filter(Boolean).join(' · ') || 'All students';

  return (
    <div className="hall-of-fame-page">
      <SectionHeading
        eyebrow="STUDENT LEADERBOARD · TOP 10"
        title="Hall of Fame"
        description="Celebrate the students leading the DBMS course by points earned."
        action={<span className="soft-badge"><Trophy size={15} /> Top 10</span>}
      />
      {error && <Notice type="error">{error}</Notice>}

      <section className="hall-controls surface-card" aria-label="Hall of Fame filters">
        <div className="hall-controls-intro">
          <span className="hall-controls-icon"><Award size={20} /></span>
          <div>
            <span className="eyebrow">CURRENT RANKING</span>
            <h2>{cohort}</h2>
            <p>All students are included by default. Filter by semester, class, or both.</p>
          </div>
        </div>
        <div className="hall-filter-controls">
          <Filter size={16} aria-hidden="true" />
          <label>
            <span>Semester</span>
            <select value={semester} onChange={(event) => setSemester(event.target.value)} aria-label="Filter Hall of Fame by semester">
              <option value="all">All semesters</option>
              <option value="3">Semester 3</option>
              <option value="5">Semester 5</option>
            </select>
          </label>
          <label>
            <span>Class</span>
            <select value={classSection} onChange={(event) => setClassSection(event.target.value)} aria-label="Filter Hall of Fame by class">
              <option value="all">All classes</option>
              <option value="X1">X1</option>
              <option value="X2">X2</option>
              <option value="Y1">Y1</option>
              <option value="Y2">Y2</option>
            </select>
          </label>
        </div>
      </section>

      <section className="surface-card hall-list-card" aria-labelledby="hall-list-title">
        <div className="hall-list-heading">
          <div>
            <span className="eyebrow">THE LEADERS</span>
            <h2 id="hall-list-title">Top 10 students</h2>
          </div>
          <span className="hall-points-heading"><Sparkles size={15} /> Total points</span>
        </div>
        {loading && <div className="hall-refresh-status" role="status">Updating ranking…</div>}
        {!data?.students?.length ? (
          <div className="hall-empty"><Trophy size={24} /><b>No students in this group yet</b><span>Try another semester or class filter.</span></div>
        ) : (
          <ol className="hall-list">
            {data.students.map((student) => (
              <li className={`hall-row ${student.rank <= 3 ? `hall-rank-top-${student.rank}` : ''}`} key={student.rank}>
                <span className="hall-rank" aria-label={`Rank ${student.rank}`}>
                  {student.rank === 1 ? <Crown size={18} /> : student.rank === 2 || student.rank === 3 ? <Medal size={18} /> : `#${student.rank}`}
                </span>
                <span className="hall-avatar" aria-hidden="true">{student.profilePhotoUrl ? <img src={student.profilePhotoUrl} alt="" loading="lazy" decoding="async" /> : initials(student.name)}</span>
                <span className="hall-student-info">
                  <b>{student.name}</b>
                  <small>{student.semester ? `Semester ${student.semester}` : 'Student'}{student.classSection ? ` · Class ${student.classSection}` : ''}</small>
                </span>
                <span className="hall-points"><b>{student.totalPoints.toLocaleString()}</b><small>points</small></span>
              </li>
            ))}
          </ol>
        )}
        <div className="hall-footnote"><Trophy size={15} /><span>Points are awarded for correct questions and instructor-approved practicals. Emails and student IDs are not shown.</span></div>
      </section>
    </div>
  );
}

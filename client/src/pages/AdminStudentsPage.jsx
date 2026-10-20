import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Download, LoaderCircle, Mail, Search, Trash2, Users, X } from 'lucide-react';
import { api } from '../services/api.js';
import { formatDuration, formatTimeAgo } from '../utils/format.js';
import { useDebounce } from '../hooks/useDebounce.js';
import SectionHeading from '../components/SectionHeading.jsx';
import Loading from '../components/Loading.jsx';
import Notice from '../components/Notice.jsx';

export default function AdminStudentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [sendingReportId, setSendingReportId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deletingStudentId, setDeletingStudentId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [exportScope, setExportScope] = useState('all');
  const [exportSemester, setExportSemester] = useState('all');
  const [exportClass, setExportClass] = useState('all');
  const exportDialogRef = useRef(null);
  const deleteDialogRef = useRef(null);
  const hasCohortFilter = exportSemester !== 'all' || exportClass !== 'all';

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (status !== 'all') params.set('status', status);
    setSearchParams(params, { replace: true });
    api.get(`/admin/students?${params}`).then(setData).catch((e) => setError(e.message));
  }, [debouncedSearch, status, page, reloadKey, setSearchParams]);

  useEffect(() => {
    const dialog = exportDialogRef.current;
    if (!dialog) return;
    if (exportDialogOpen && !dialog.open) dialog.showModal();
    else if (!exportDialogOpen && dialog.open) dialog.close();
  }, [exportDialogOpen]);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteTarget && !dialog.open) dialog.showModal();
    else if (!deleteTarget && dialog.open) dialog.close();
  }, [deleteTarget]);

  const openExportDialog = () => {
    setError('');
    setExportError('');
    setExportScope('all');
    setExportSemester('all');
    setExportClass('all');
    setExportDialogOpen(true);
  };

  const emailStudentReport = async (student) => {
    setSendingReportId(student._id);
    setError('');
    setSuccessMessage('');
    try {
      const result = await api.post(`/admin/students/${student._id}/report-email`, {});
      setSuccessMessage(`Report sent to ${result.recipient}.`);
    } catch (e) {
      const message = /email is not configured/i.test(e.message)
        ? e.message
        : e.status >= 500
          ? 'The report email could not be sent. Ask the portal administrator to check the server SMTP settings.'
          : e.message;
      setError(message);
    } finally {
      setSendingReportId('');
    }
  };

  const requestStudentRemoval = (student) => {
    setError('');
    setSuccessMessage('');
    setDeleteError('');
    setDeleteTarget(student);
  };

  const confirmStudentRemoval = async () => {
    if (!deleteTarget || deletingStudentId) return;
    const target = deleteTarget;
    setDeletingStudentId(target._id);
    setDeleteError('');
    try {
      const result = await api.delete(`/admin/students/${target._id}`);
      setSuccessMessage(`${result.student?.name || target.name} and all associated account data were permanently removed.`);
      setDeleteTarget(null);
      if (data?.students?.length === 1 && page > 1) setPage((value) => Math.max(1, value - 1));
      else setReloadKey((value) => value + 1);
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setDeletingStudentId('');
    }
  };

  const exportData = async () => {
    const params = new URLSearchParams();
    const filenameParts = [];
    if (exportScope === 'cohort') {
      if (exportSemester !== 'all') {
        params.set('semester', exportSemester);
        filenameParts.push(`semester-${exportSemester}`);
      }
      if (exportClass !== 'all') {
        params.set('classSection', exportClass);
        filenameParts.push(`class-${exportClass.toLowerCase()}`);
      }
    }
    const query = params.toString();
    const filenameSuffix = filenameParts.length ? filenameParts.join('-') : 'all-students';
    setExporting(true);
    try {
      await api.download(`/admin/export/progress${query ? `?${query}` : ''}`, `dbms-student-progress-${filenameSuffix}.csv`);
      setExportDialogOpen(false);
    } catch (e) {
      setExportError(e.message);
    } finally {
      setExporting(false);
    }
  };

  if (!data && !error) return <Loading />;

  return (
    <div>
      <SectionHeading
        eyebrow="STUDENT MANAGEMENT"
        title="Student directory"
        description="Search accounts, compare activity, email reports, and permanently remove student records."
        action={(
          <button className="button button-outline button-sm" onClick={openExportDialog} disabled={exporting}>
            <Download size={15} /> Export progress CSV
          </button>
        )}
      />
      {error && <Notice type="error">{error}</Notice>}
      {successMessage && <Notice type="success">{successMessage}</Notice>}

      <div className="student-filter-row">
        <label className="search-control">
          <Search size={16} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, student ID or email" />
        </label>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter students by online status">
          <option value="all">All students</option>
          <option value="online">Online now</option>
          <option value="offline">Offline</option>
        </select>
        <span className="result-count"><Users size={15} /> {data?.pagination?.total || 0} students</span>
      </div>

      <section className="surface-card table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Student</th><th>Status</th><th>Topics</th><th>Questions</th><th>Practicals</th><th>Points</th><th>Active time</th><th>Last active</th><th></th></tr>
            </thead>
            <tbody>
              {data?.students?.map((student) => (
                <tr key={student._id}>
                  <td>
                    <div className="table-person">
                      <span className="table-avatar">{student.profilePhotoUrl ? <img src={student.profilePhotoUrl} alt="" loading="lazy" decoding="async" /> : student.name?.slice(0, 1)?.toUpperCase()}</span>
                      <span>
                        <b>{student.name}</b>
                        <small>{student.email} · {student.studentId}</small>
                        <small className="table-sub">{student.semester ? `Semester ${student.semester}` : 'Semester —'} · Class {student.classSection || '—'}</small>
                      </span>
                    </div>
                  </td>
                  <td><span className={`status-tag ${student.online ? 'status-online' : 'status-offline'}`}><i />{student.online ? 'Online' : 'Offline'}</span></td>
                  <td><b>{student.topicsCompleted}</b><small className="table-sub">{student.topicsOpened} opened</small></td>
                  <td><b>{student.correctAnswers}/{student.questionsAttempted}</b><small className="table-sub">correct / attempted</small></td>
                  <td><b>{student.practicalsCompleted}/{student.practicalsAttempted}</b><small className="table-sub">approved / attempted</small></td>
                  <td><b>{(student.totalPoints || 0).toLocaleString()}</b><small className="table-sub">earned</small></td>
                  <td>{formatDuration(student.activeSeconds)}</td>
                  <td>{formatTimeAgo(student.lastActive)}</td>
                  <td><div className="student-row-actions">
                    <button className="row-action email-report-button" type="button" onClick={() => emailStudentReport(student)} disabled={Boolean(sendingReportId) || Boolean(deletingStudentId)} aria-label={`Email ${student.name}'s report to ${student.email}`} title={`Send report to ${student.email}`} aria-busy={sendingReportId === student._id}>
                      {sendingReportId === student._id ? <LoaderCircle size={15} className="icon-spin" /> : <Mail size={15} />}
                    </button>
                    <Link className="row-action" to={`/admin/students/${student._id}`} aria-label={`Open ${student.name}'s activity report`}><ArrowRight size={16} /></Link>
                    <button className="row-action delete-student-button" type="button" onClick={() => requestStudentRemoval(student)} disabled={Boolean(sendingReportId) || Boolean(deletingStudentId)} aria-label={`Remove ${student.name}`} title={`Remove ${student.name}`}>
                      {deletingStudentId === student._id ? <LoaderCircle size={15} className="icon-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data?.students?.length && <div className="table-empty">No students match this search.</div>}
        <div className="table-pagination">
          <span>Page {data?.pagination?.page || 1} of {Math.max(1, data?.pagination?.pages || 1)}</span>
          <div>
            <button className="button button-outline button-sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={14} />Previous</button>
            <button className="button button-outline button-sm" disabled={page >= (data?.pagination?.pages || 1)} onClick={() => setPage((value) => value + 1)}>Next<ArrowRight size={14} /></button>
          </div>
        </div>
      </section>
      <div className="admin-directory-note"><span>ⓘ</span> Account activity is stored separately from user profiles so the event history remains scalable and auditable.</div>

      <dialog
        ref={exportDialogRef}
        className="export-dialog"
        aria-labelledby="student-export-title"
        aria-describedby="student-export-description"
        onCancel={() => setExportDialogOpen(false)}
        onClose={() => setExportDialogOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) setExportDialogOpen(false); }}
      >
        <div className="export-dialog-content">
          <div className="export-dialog-heading">
            <div>
              <span className="eyebrow">STUDENT REPORT</span>
              <h2 id="student-export-title">Export progress CSV</h2>
            </div>
            <button className="export-dialog-close" type="button" onClick={() => setExportDialogOpen(false)} aria-label="Close export dialog"><X size={18} /></button>
          </div>
          <p id="student-export-description" className="export-dialog-description">Choose to export the whole student dataset or filter the CSV by semester and class.</p>

          <fieldset className="export-scope-options">
            <legend>Students to include</legend>
            <label className="export-scope-option">
              <input type="radio" name="exportScope" value="all" checked={exportScope === 'all'} onChange={() => setExportScope('all')} />
              <span><b>Whole dataset</b><small>Include students from every semester and class.</small></span>
            </label>
            <label className="export-scope-option">
              <input type="radio" name="exportScope" value="cohort" checked={exportScope === 'cohort'} onChange={() => setExportScope('cohort')} />
              <span><b>Filter by cohort</b><small>Choose a semester, class, or both.</small></span>
            </label>
          </fieldset>

          {exportScope === 'cohort' && (
            <div className="export-cohort-fields">
              <label>
                <span>Semester</span>
                <select value={exportSemester} onChange={(e) => setExportSemester(e.target.value)}>
                  <option value="all">Any semester</option>
                  <option value="3">Semester 3</option>
                  <option value="5">Semester 5</option>
                </select>
              </label>
              <label>
                <span>Class</span>
                <select value={exportClass} onChange={(e) => setExportClass(e.target.value)}>
                  <option value="all">Any class</option>
                  <option value="X1">X1</option>
                  <option value="X2">X2</option>
                  <option value="Y1">Y1</option>
                  <option value="Y2">Y2</option>
                </select>
              </label>
              {!hasCohortFilter && <p className="export-filter-hint">Choose a semester or class, or select “Whole dataset”.</p>}
            </div>
          )}

          {exportError && <p className="export-dialog-error" role="alert">{exportError}</p>}
          <div className="export-dialog-actions">
            <button className="button button-outline button-sm" type="button" onClick={() => setExportDialogOpen(false)} disabled={exporting}>Cancel</button>
            <button className="button button-dark button-sm" type="button" onClick={exportData} disabled={exporting || (exportScope === 'cohort' && !hasCohortFilter)}>
              <Download size={15} /> {exporting ? 'Preparing…' : 'Download CSV'}
            </button>
          </div>
        </div>
      </dialog>

      <dialog
        ref={deleteDialogRef}
        className="export-dialog delete-student-dialog"
        aria-labelledby="student-delete-title"
        aria-describedby="student-delete-description"
        onCancel={(event) => { event.preventDefault(); if (!deletingStudentId) { setDeleteTarget(null); setDeleteError(''); } }}
        onClose={() => { if (!deletingStudentId) { setDeleteTarget(null); setDeleteError(''); } }}
        onClick={(event) => { if (event.target === event.currentTarget && !deletingStudentId) setDeleteTarget(null); }}
      >
        <div className="export-dialog-content">
          <div className="export-dialog-heading">
            <div>
              <span className="eyebrow">PERMANENT ACTION</span>
              <h2 id="student-delete-title">Remove this student?</h2>
            </div>
            <button className="export-dialog-close" type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingStudentId)} aria-label="Cancel student removal"><X size={18} /></button>
          </div>
          <p className="delete-student-identity"><b>{deleteTarget?.name}</b><small>{deleteTarget?.email} · {deleteTarget?.studentId}</small><small>Semester {deleteTarget?.semester || '—'} · Class {deleteTarget?.classSection || '—'}</small></p>
          <div className="delete-student-warning">
            <AlertTriangle size={19} />
            <p id="student-delete-description">This permanently deletes the student account and all linked progress, quiz/practical attempts, submitted Practice Arena attempts, points, learning time, sessions and activity history. This action cannot be undone.</p>
          </div>
          <p className="delete-local-draft-note">Unsubmitted Practice Arena drafts are stored only in the student’s browser, so they cannot be erased remotely.</p>
          {deleteError && <p className="export-dialog-error" role="alert">{deleteError}</p>}
          <div className="export-dialog-actions">
            <button className="button button-outline button-sm" type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingStudentId)}>Cancel</button>
            <button className="button button-danger button-sm" type="button" onClick={confirmStudentRemoval} disabled={Boolean(deletingStudentId)}>
              {deletingStudentId ? <LoaderCircle size={15} className="icon-spin" /> : <Trash2 size={15} />}
              {deletingStudentId ? 'Removing…' : 'Delete permanently'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

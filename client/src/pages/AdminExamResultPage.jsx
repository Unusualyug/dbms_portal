import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CircleAlert,
  FileCheck2,
  GraduationCap,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  UnlockKeyhole,
} from "lucide-react";
import { api } from "../services/api.js";
import SectionHeading from "../components/SectionHeading.jsx";
import Loading from "../components/Loading.jsx";
import Notice from "../components/Notice.jsx";
import "../styles/exam-result.css";

const TYPE_LABELS = {
  session1: "Session 1",
  session2: "Session 2",
  ala: "ALA",
};
const DEFAULT_TITLES = {
  session1: "Session 1",
  session2: "Session 2",
  ala: "ALA 1",
};
const CLASS_SECTIONS = ["X1", "X2", "Y1", "Y2"];

function currentAcademicYear() {
  const year = new Date().getFullYear();
  return `${year}-${String(year + 1).slice(-2)}`;
}

function newSubject() {
  return { id: "", name: "", maxMarks: "100" };
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function countLocalMissing(detail) {
  if (!detail) return 0;
  return (detail.students || []).reduce(
    (count, student) =>
      count +
      (student.marks || []).filter(
        (mark) =>
          mark.marksObtained === "" ||
          mark.marksObtained === null ||
          mark.marksObtained === undefined,
      ).length,
    0,
  );
}

function SubjectEditor({ subjects, onChange, disabled = false }) {
  const update = (index, field, value) =>
    onChange((current) =>
      current.map((subject, row) =>
        row === index ? { ...subject, [field]: value } : subject,
      ),
    );
  const remove = (index) =>
    onChange((current) => current.filter((_, row) => row !== index));

  return (
    <div className="exam-subject-editor">
      <div className="exam-subject-editor-heading">
        <b>Subjects</b>
        <span>Add each subject and its maximum marks.</span>
      </div>
      <div className="exam-subject-list">
        {subjects.map((subject, index) => (
          <div
            className="exam-subject-row"
            key={subject.id || `subject-${index}`}
          >
            <label className="exam-field exam-subject-name">
              <span>Subject {index + 1}</span>
              <input
                value={subject.name}
                onChange={(event) => update(index, "name", event.target.value)}
                maxLength={100}
                minLength={2}
                required
                disabled={disabled}
                placeholder="e.g. Database Management Systems"
              />
            </label>
            <label className="exam-field exam-subject-max">
              <span>Max marks</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                max="10000"
                step="0.01"
                value={subject.maxMarks}
                onChange={(event) =>
                  update(index, "maxMarks", event.target.value)
                }
                required
                disabled={disabled}
              />
            </label>
            <button
              className="button button-outline button-sm exam-remove-subject"
              type="button"
              onClick={() => remove(index)}
              disabled={disabled || subjects.length <= 1}
              aria-label={`Remove subject ${index + 1}`}
              title="Remove subject"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ))}
      </div>
      {!disabled && (
        <button
          className="button button-outline button-sm exam-add-subject"
          type="button"
          onClick={() => onChange((current) => [...current, newSubject()])}
        >
          <Plus size={14} /> Add subject
        </button>
      )}
    </div>
  );
}

export default function AdminExamResultPage() {
  const [assessments, setAssessments] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [newForm, setNewForm] = useState({
    assessmentType: "session1",
    title: DEFAULT_TITLES.session1,
    academicYear: currentAcademicYear(),
    semester: "3",
    classSection: "X1",
  });
  const [newSubjects, setNewSubjects] = useState([newSubject()]);
  const [editTitle, setEditTitle] = useState("");
  const [editSubjects, setEditSubjects] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAssessments = useCallback(async () => {
    setLoadingList(true);
    try {
      const result = await api.get("/admin/exam-result");
      const rows = result.assessments || [];
      setAssessments(rows);
      setSelectedId((current) =>
        current && rows.some((row) => row.id === current)
          ? current
          : rows[0]?.id || "",
      );
    } catch (requestError) {
      setError(requestError.message || "Could not load assessments.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments, refreshKey]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setLoadingDetail(false);
      return undefined;
    }
    let active = true;
    setDetail(null);
    setLoadingDetail(true);
    setError("");
    api
      .get(`/admin/exam-result/${selectedId}`)
      .then((result) => {
        if (active) setDetail(result);
      })
      .catch((requestError) => {
        if (active)
          setError(requestError.message || "Could not load this assessment.");
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, refreshKey]);

  useEffect(() => {
    if (!detail?.assessment) return;
    setEditTitle(detail.assessment.title);
    setEditSubjects(
      detail.assessment.subjects.map((subject) => ({
        ...subject,
        maxMarks: String(subject.maxMarks),
      })),
    );
  }, [detail?.assessment?.id, detail?.assessment?.updatedAt]);

  const localMissing = useMemo(() => countLocalMissing(detail), [detail]);

  const createAssessment = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const result = await api.post("/admin/exam-result", {
        ...newForm,
        semester: Number(newForm.semester),
        subjects: newSubjects.map(({ name, maxMarks }) => ({ name, maxMarks })),
      });
      setNotice(
        "Assessment created as a draft. Enter every student’s marks before publishing.",
      );
      setSelectedId(result.assessment.id);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not create the assessment.");
    } finally {
      setCreating(false);
    }
  };

  const saveSetup = async (event) => {
    event.preventDefault();
    if (!detail?.assessment) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.patch(
        `/admin/exam-result/${detail.assessment.id}`,
        {
          title: editTitle,
          subjects: editSubjects.map(({ id, name, maxMarks }) => ({
            ...(id ? { id } : {}),
            name,
            maxMarks,
          })),
        },
      );
      setDetail(result);
      setNotice("Assessment setup saved.");
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not save the assessment setup.");
    } finally {
      setBusy(false);
    }
  };

  const updateMark = (studentId, subjectId, value) => {
    setDetail((current) =>
      current
        ? {
            ...current,
            students: current.students.map((student) =>
              student.id !== studentId
                ? student
                : {
                    ...student,
                    marks: student.marks.map((mark) =>
                      mark.subjectId === subjectId
                        ? { ...mark, marksObtained: value }
                        : mark,
                    ),
                  },
            ),
          }
        : current,
    );
  };

  const saveMarks = async () => {
    if (!detail?.assessment) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.patch(
        `/admin/exam-result/${detail.assessment.id}/marks`,
        {
          results: detail.students.map((student) => ({
            studentId: student.id,
            marks: student.marks,
          })),
        },
      );
      setDetail(result);
      setNotice("Student marks saved.");
    } catch (requestError) {
      setError(requestError.message || "Could not save marks.");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!detail?.assessment) return;
    if (detail.students.length === 0) {
      setError("There are no active students in this cohort.");
      return;
    }
    if (localMissing > 0) {
      setError(
        `Enter all marks first. ${localMissing} student subject mark${localMissing === 1 ? " is" : "s are"} still missing.`,
      );
      return;
    }
    if (
      !window.confirm(
        `Publish “${detail.assessment.title}” for Semester ${detail.assessment.semester} · ${detail.assessment.classSection}? Students in this cohort will be able to see their marks.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.patch(`/admin/exam-result/${detail.assessment.id}/marks`, {
        results: detail.students.map((student) => ({
          studentId: student.id,
          marks: student.marks,
        })),
      });
      await api.post(`/admin/exam-result/${detail.assessment.id}/publish`, {});
      setNotice(
        "Assessment published. Students in the selected cohort can now view their own marks.",
      );
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not publish the assessment.");
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    if (
      !detail?.assessment ||
      !window.confirm(
        "Unpublish this assessment? Students will no longer see it until it is published again.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.post(
        `/admin/exam-result/${detail.assessment.id}/unpublish`,
        {},
      );
      setNotice(
        "Assessment unpublished. You can now edit its setup and marks.",
      );
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not unpublish the assessment.");
    } finally {
      setBusy(false);
    }
  };

  const deleteDraft = async () => {
    if (!detail?.assessment || detail.assessment.status !== "draft") return;
    if (
      !window.confirm(
        `Delete the draft “${detail.assessment.title}” and its saved marks? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.delete(`/admin/exam-result/${detail.assessment.id}`);
      setDetail(null);
      setSelectedId("");
      setNotice("Draft assessment and its saved marks deleted.");
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not delete the draft.");
    } finally {
      setBusy(false);
    }
  };

  const changeNewType = (assessmentType) =>
    setNewForm((current) => ({
      ...current,
      assessmentType,
      title: DEFAULT_TITLES[assessmentType],
    }));

  if (loadingList && !assessments.length)
    return <Loading label="Loading Exam Result workspace…" />;

  return (
    <div className="exam-result-page">
      <SectionHeading
        eyebrow="ASSESSMENT WORKSPACE"
        title="Exam Result"
        description="Create Session 1, Session 2, and ALA assessments, enter student marks, and publish them by cohort."
        action={
          <button
            className="button button-outline button-sm"
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loadingList || loadingDetail}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />
      {error && <Notice type="error">{error}</Notice>}
      {notice && <Notice type="success">{notice}</Notice>}

      <div className="exam-admin-layout">
        <aside className="exam-admin-sidebar">
          <form
            className="surface-card exam-create-card"
            onSubmit={createAssessment}
          >
            <div className="exam-card-heading">
              <div>
                <span className="eyebrow">NEW ASSESSMENT</span>
                <h3>Create assessment</h3>
              </div>
              <GraduationCap size={19} />
            </div>
            <label className="exam-field">
              <span>Assessment type</span>
              <select
                value={newForm.assessmentType}
                onChange={(event) => changeNewType(event.target.value)}
              >
                <option value="session1">Session 1</option>
                <option value="session2">Session 2</option>
                <option value="ala">ALA</option>
              </select>
            </label>
            <label className="exam-field">
              <span>Assessment name</span>
              <input
                value={newForm.title}
                onChange={(event) =>
                  setNewForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                minLength={2}
                maxLength={100}
                required
              />
            </label>
            <div className="exam-form-grid">
              <label className="exam-field">
                <span>Academic year</span>
                <input
                  value={newForm.academicYear}
                  onChange={(event) =>
                    setNewForm((current) => ({
                      ...current,
                      academicYear: event.target.value,
                    }))
                  }
                  pattern="[0-9]{4}-([0-9]{2}|[0-9]{4})"
                  placeholder="2026-27"
                  required
                />
              </label>
              <label className="exam-field">
                <span>Semester</span>
                <select
                  value={newForm.semester}
                  onChange={(event) =>
                    setNewForm((current) => ({
                      ...current,
                      semester: event.target.value,
                    }))
                  }
                >
                  <option value="3">Semester 3</option>
                  <option value="5">Semester 5</option>
                </select>
              </label>
            </div>
            <label className="exam-field">
              <span>Class section</span>
              <select
                value={newForm.classSection}
                onChange={(event) =>
                  setNewForm((current) => ({
                    ...current,
                    classSection: event.target.value,
                  }))
                }
              >
                {CLASS_SECTIONS.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </label>
            <SubjectEditor subjects={newSubjects} onChange={setNewSubjects} />
            <button
              className="button button-dark exam-primary-button"
              type="submit"
              disabled={creating}
            >
              <Plus size={15} />
              {creating ? "Creating…" : "Create draft"}
            </button>
          </form>

          <section className="surface-card exam-assessment-nav">
            <div className="exam-card-heading">
              <div>
                <span className="eyebrow">ASSESSMENTS</span>
                <h3>Manage assessments</h3>
              </div>
              <span className="exam-count">{assessments.length}</span>
            </div>
            {loadingList && (
              <p className="exam-help">Refreshing assessment list…</p>
            )}
            {!assessments.length ? (
              <p className="exam-help">Created assessments will appear here.</p>
            ) : (
              <div className="exam-assessment-list">
                {assessments.map((assessment) => (
                  <button
                    type="button"
                    key={assessment.id}
                    onClick={() => {
                      setSelectedId(assessment.id);
                      setError("");
                      setNotice("");
                    }}
                    className={`exam-assessment-list-item ${selectedId === assessment.id ? "is-selected" : ""}`}
                  >
                    <span className="exam-list-item-top">
                      <b>{assessment.title}</b>
                      <span
                        className={`exam-status exam-status-${assessment.status}`}
                      >
                        {assessment.status === "published"
                          ? "Published"
                          : "Draft"}
                      </span>
                    </span>
                    <span className="exam-list-item-meta">
                      {TYPE_LABELS[assessment.assessmentType]} ·{" "}
                      {assessment.academicYear}
                    </span>
                    <span className="exam-list-item-meta">
                      Semester {assessment.semester} · {assessment.classSection}{" "}
                      · {assessment.subjects.length} subject
                      {assessment.subjects.length === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>

        <section className="surface-card exam-detail-card">
          {loadingDetail ? (
            <div className="exam-loading">
              <span className="loader" />
              Loading assessment…
            </div>
          ) : !detail ? (
            <div className="exam-empty-state">
              <div>
                <FileCheck2 size={22} />
              </div>
              <b>Select an assessment</b>
              <span>
                Create a new assessment or choose one from the list to manage
                its subjects and marks.
              </span>
            </div>
          ) : (
            <>
              <div className="exam-detail-heading">
                <div>
                  <span className="eyebrow">
                    {TYPE_LABELS[detail.assessment.assessmentType]} ·{" "}
                    {detail.assessment.academicYear}
                  </span>
                  <h3>{detail.assessment.title}</h3>
                  <p>
                    <CalendarDays size={14} /> Semester{" "}
                    {detail.assessment.semester} · Section{" "}
                    {detail.assessment.classSection} · {detail.studentCount}{" "}
                    active student{detail.studentCount === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className={`exam-status exam-status-${detail.assessment.status}`}
                >
                  {detail.assessment.status === "published"
                    ? "Published"
                    : "Draft"}
                </span>
              </div>

              <form className="exam-setup-form" onSubmit={saveSetup}>
                <label className="exam-field exam-title-edit">
                  <span>Assessment name</span>
                  <input
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    minLength={2}
                    maxLength={100}
                    required
                    disabled={detail.assessment.status === "published"}
                  />
                </label>
                <SubjectEditor
                  subjects={editSubjects}
                  onChange={setEditSubjects}
                  disabled={detail.assessment.status === "published"}
                />
                {detail.assessment.status === "draft" && (
                  <button
                    className="button button-outline button-sm"
                    type="submit"
                    disabled={busy}
                  >
                    <Save size={14} /> Save assessment setup
                  </button>
                )}
              </form>

              <div className="exam-marks-heading">
                <div>
                  <span className="eyebrow">STUDENT MARKS</span>
                  <h4>Enter marks</h4>
                  <p>
                    Blank cells must be completed before publishing. Enter 0 for
                    a zero mark.
                  </p>
                </div>
                <span
                  className={`exam-missing-count ${localMissing ? "has-missing" : "all-complete"}`}
                >
                  {detail.studentCount
                    ? `${localMissing} mark${localMissing === 1 ? "" : "s"} missing`
                    : "No students"}
                </span>
              </div>

              {detail.students.length ? (
                <div className="exam-marks-table-wrap">
                  <table className="exam-marks-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Student ID</th>
                        {detail.assessment.subjects.map((subject) => (
                          <th key={subject.id}>
                            {subject.name}
                            <small>Max {formatNumber(subject.maxMarks)}</small>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.students.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <b>{student.name}</b>
                          </td>
                          <td>{student.studentId || "—"}</td>
                          {detail.assessment.subjects.map((subject, index) => {
                            const mark = student.marks[index];
                            return (
                              <td key={subject.id}>
                                <input
                                  aria-label={`${subject.name} marks for ${student.name}`}
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  max={subject.maxMarks}
                                  step="0.01"
                                  value={mark?.marksObtained ?? ""}
                                  onChange={(event) =>
                                    updateMark(
                                      student.id,
                                      subject.id,
                                      event.target.value,
                                    )
                                  }
                                  disabled={
                                    busy ||
                                    detail.assessment.status === "published"
                                  }
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="exam-empty-inline">
                  <CircleAlert size={17} />
                  There are no active students in Semester{" "}
                  {detail.assessment.semester} ·{" "}
                  {detail.assessment.classSection}.
                </div>
              )}

              <div className="exam-detail-actions">
                <div className="exam-action-note">
                  <CircleAlert size={14} />
                  Publish saves the current marks and makes the assessment
                  visible to its matching cohort only.
                </div>
                <div className="exam-action-buttons">
                  {detail.assessment.status === "draft" ? (
                    <>
                      <button
                        className="button button-outline button-sm exam-delete-button"
                        type="button"
                        onClick={deleteDraft}
                        disabled={busy}
                      >
                        <Trash2 size={14} /> Delete draft
                      </button>
                      <button
                        className="button button-outline button-sm"
                        type="button"
                        onClick={saveMarks}
                        disabled={busy || detail.students.length === 0}
                      >
                        <Save size={14} /> Save marks
                      </button>
                      <button
                        className="button button-dark button-sm"
                        type="button"
                        onClick={publish}
                        disabled={
                          busy ||
                          detail.students.length === 0 ||
                          localMissing > 0
                        }
                      >
                        <Send size={14} /> {busy ? "Working…" : "Publish"}
                      </button>
                    </>
                  ) : (
                    <button
                      className="button button-outline button-sm"
                      type="button"
                      onClick={unpublish}
                      disabled={busy}
                    >
                      <UnlockKeyhole size={14} /> Unpublish to edit
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { CalendarDays, FileCheck2, GraduationCap } from "lucide-react";
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

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export default function StudentExamResultPage() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .get("/student/exam-result")
      .then((result) => {
        if (active) setAssessments(result.assessments || []);
      })
      .catch((requestError) => {
        if (active)
          setError(
            requestError.message || "Could not load your published marks.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (loading && !assessments.length)
    return <Loading label="Loading Exam Result…" />;

  return (
    <div className="exam-result-page student-exam-result-page">
      <SectionHeading
        eyebrow="ACADEMIC RECORDS"
        title="Exam Result"
        description="View your marks for assessments published by the administrator."
        action={
          <button
            className="button button-outline button-sm"
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
          >
            <span className={loading ? "exam-refresh-spin" : ""}>↻</span>{" "}
            Refresh
          </button>
        }
      />
      {error && <Notice type="error">{error}</Notice>}
      {loading && (
        <div className="exam-refresh-message">
          Updating your published marks…
        </div>
      )}

      {!assessments.length ? (
        <div className="surface-card exam-student-empty">
          <div className="exam-student-empty-icon">
            <FileCheck2 size={23} />
          </div>
          <h3>No published marks yet</h3>
          <p>
            When the administrator publishes an assessment for your cohort, it
            will appear here.
          </p>
        </div>
      ) : (
        <div className="student-exam-assessment-list">
          {assessments.map((assessment) => (
            <article
              className="surface-card student-exam-assessment"
              key={assessment.id}
            >
              <header className="student-exam-assessment-header">
                <div className="student-exam-title-lockup">
                  <span className="student-exam-icon">
                    <GraduationCap size={18} />
                  </span>
                  <div>
                    <span className="eyebrow">
                      {TYPE_LABELS[assessment.assessmentType]} ·{" "}
                      {assessment.academicYear}
                    </span>
                    <h3>{assessment.title}</h3>
                    <p>
                      <CalendarDays size={13} /> Semester {assessment.semester}{" "}
                      · Section {assessment.classSection}
                    </p>
                  </div>
                </div>
                <div className="student-exam-total">
                  <span>Total</span>
                  <b>
                    {formatNumber(assessment.totalObtained)}{" "}
                    <small>/ {formatNumber(assessment.totalMaximum)}</small>
                  </b>
                  <em>{formatNumber(assessment.percentage)}%</em>
                </div>
              </header>
              <div className="exam-student-table-wrap">
                <table className="exam-student-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Marks obtained</th>
                      <th>Maximum marks</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.subjects.map((subject) => {
                      const percent = Number(subject.maxMarks)
                        ? (Number(subject.marksObtained) /
                            Number(subject.maxMarks)) *
                          100
                        : 0;
                      return (
                        <tr key={subject.id}>
                          <td>
                            <b>{subject.name}</b>
                          </td>
                          <td>{formatNumber(subject.marksObtained)}</td>
                          <td>{formatNumber(subject.maxMarks)}</td>
                          <td>{formatNumber(percent)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Total</th>
                      <th>{formatNumber(assessment.totalObtained)}</th>
                      <th>{formatNumber(assessment.totalMaximum)}</th>
                      <th>{formatNumber(assessment.percentage)}%</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="student-exam-published-note">
                Published{" "}
                {assessment.publishedAt
                  ? new Date(assessment.publishedAt).toLocaleDateString()
                  : ""}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

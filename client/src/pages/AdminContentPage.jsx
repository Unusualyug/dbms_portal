import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { api } from "../services/api.js";
import { useCourse } from "../context/CourseContext.jsx";
import { DEFAULT_COURSE_CODE } from "../services/courseSelection.js";
import SectionHeading from "../components/SectionHeading.jsx";
import Loading from "../components/Loading.jsx";
import Notice from "../components/Notice.jsx";

export default function AdminContentPage() {
  const { courseCode, currentCourse } = useCourse();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    setData(null);
    setError("");
    api
      .get("/admin/content/validation")
      .then((result) => {
        if (current && result.courseCode === courseCode) setData(result);
      })
      .catch((requestError) => {
        if (current) setError(requestError.message);
      });
    return () => {
      current = false;
    };
  }, [courseCode]);
  if (!data && !error) return <Loading />;
  const totals = data?.totals || {};
  const expected = data?.expected || {};
  const actual = data?.actual || {};
  const syllabusModules = expected.modules || 0;
  return (
    <div>
      <SectionHeading
        eyebrow="SOURCE-OF-TRUTH CHECK"
        title="Course content verification"
        description={`Compare the imported ${currentCourse?.portalLabel || "course"} curriculum with its official course-file manifest.`}
        action={
          <span
            className={`validation-badge ${data?.valid ? "validation-good" : "validation-warn"}`}
          >
            {data?.valid ? (
              <CheckCircle2 size={15} />
            ) : (
              <CircleAlert size={15} />
            )}
            {data?.valid ? "All counts match" : "Review needed"}
          </span>
        }
      />
      {error && <Notice type="error">{error}</Notice>}
      {!error && (
        <Notice type={data?.valid ? "success" : "error"}>
          {data?.valid
            ? `All ${totals.modules} modules and their official practical counts match the ${currentCourse?.portalLabel || "course"} manifest. Derived learning checks remain separate from official practicals.`
            : "One or more imported counts or module titles do not match the course manifest. Review the details before release."}
        </Notice>
      )}
      {!error && (
        <>
          <div className="content-validation-summary">
            <div>
              <span>Modules</span>
              <b>
                {actual.modules || 0}/{syllabusModules}
              </b>
            </div>
            <div>
              <span>Theory topics</span>
              <b>
                {totals.topicsImported || 0}/{totals.topicsExpected || 0}
              </b>
            </div>
            <div>
              <span>Official practicals</span>
              <b>
                {totals.practicalsImported || 0}/
                {totals.practicalsExpected || 0}
              </b>
            </div>
            <div>
              <span>Derived questions</span>
              <b>{actual.questions || 0}</b>
            </div>
          </div>
          <section className="surface-card table-card">
            <div className="card-heading">
              <div>
                <span className="eyebrow">MODULE-BY-MODULE</span>
                <h2>Imported content counts</h2>
              </div>
              <FileCheck2 size={19} className="muted-icon" />
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Title</th>
                    <th>Topics expected / imported</th>
                    <th>Practicals expected / imported</th>
                    <th>Source pages</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.modules?.map((module) => (
                    <tr key={module.moduleNumber}>
                      <td>
                        <span
                          className={`small-module-number module-tone-${module.moduleNumber}`}
                        >
                          0{module.moduleNumber}
                        </span>
                      </td>
                      <td>
                        <b>{module.title}</b>
                      </td>
                      <td>
                        {module.expectedTopics} / {module.actualTopics}
                      </td>
                      <td>
                        <b>
                          {module.expectedPracticals} /{" "}
                          {module.actualPracticals}
                        </b>
                      </td>
                      <td>{module.sourcePages.join(", ") || "—"}</td>
                      <td>
                        {module.valid ? (
                          <span className="status-tag status-online">
                            <i /> Valid
                          </span>
                        ) : (
                          <span className="status-tag status-offline">
                            <i /> Mismatch
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {courseCode === DEFAULT_COURSE_CODE && (
            <section className="content-scan-warning">
              <CircleAlert size={18} />
              <div>
                <b>Instructor review: DBMS Module 1, Practical 12</b>
                <p>
                  The source scan appears internally inconsistent. The portal
                  preserves the official wording and flags it for review rather
                  than silently changing the task.
                </p>
              </div>
            </section>
          )}
          <div className="content-verification-note">
            <ShieldCheck size={16} />
            {data?.sourceDescription || "Official course file"} ·
            syllabus-derived practice questions are labeled separately and do
            not change official practical counts.
          </div>
        </>
      )}
    </div>
  );
}

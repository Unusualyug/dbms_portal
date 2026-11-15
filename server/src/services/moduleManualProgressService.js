const Module = require("../models/Module");
const Practical = require("../models/Practical");
const PracticalAttempt = require("../models/PracticalAttempt");
const ModuleManualProgress = require("../models/ModuleManualProgress");
const User = require("../models/User");
const { COURSE_CODE, normalizeCourseCode } = require("../config/constants");
const { courseFilter } = require("./courseScope");

function pairKey(studentId, moduleId) {
  return `${String(studentId)}:${String(moduleId)}`;
}

function deriveModuleManualStatus(totalPracticals, completedPracticals) {
  return totalPracticals > 0 && completedPracticals >= totalPracticals
    ? "completed"
    : "pending";
}

function mapValue(value, key) {
  if (value instanceof Map) return value.get(key);
  return value?.[key];
}

async function syncModuleManualProgressForStudents(
  studentIds,
  { moduleId, courseCode = COURSE_CODE, queueCompletionEmail = false } = {},
) {
  const normalizedCourseCode = normalizeCourseCode(courseCode) || COURSE_CODE;
  const studentsById = new Map(
    (studentIds || []).filter(Boolean).map((id) => [String(id), id]),
  );
  const uniqueStudentIds = [...studentsById.values()];
  const moduleFilter = { isActive: true };
  if (moduleId) moduleFilter._id = moduleId;
  const modules = await Module.find(
    courseFilter(normalizedCourseCode, moduleFilter),
  )
    .select("_id moduleNumber title slug courseCode")
    .sort({ moduleNumber: 1 })
    .lean();
  if (!uniqueStudentIds.length || !modules.length) return { modules, rows: [] };

  const moduleIds = modules.map((module) => module._id);
  const practicals = await Practical.find(
    courseFilter(normalizedCourseCode, {
      moduleId: { $in: moduleIds },
      isActive: true,
    }),
  )
    .select("_id moduleId")
    .lean();
  const practicalModuleById = new Map();
  const totalByModule = new Map(
    modules.map((module) => [String(module._id), 0]),
  );
  for (const practical of practicals) {
    const practicalId = String(practical._id);
    const parentModuleId = String(practical.moduleId);
    practicalModuleById.set(practicalId, parentModuleId);
    totalByModule.set(
      parentModuleId,
      (totalByModule.get(parentModuleId) || 0) + 1,
    );
  }

  const practicalIds = practicals.map((practical) => practical._id);
  const [approvedAttempts, existingRows, users] = await Promise.all([
    practicalIds.length
      ? PracticalAttempt.aggregate([
          {
            $match: courseFilter(normalizedCourseCode, {
              studentId: { $in: uniqueStudentIds },
              practicalId: { $in: practicalIds },
              reviewStatus: "approved",
            }),
          },
          {
            $group: {
              _id: { studentId: "$studentId", practicalId: "$practicalId" },
            },
          },
        ])
      : [],
    ModuleManualProgress.find(
      courseFilter(normalizedCourseCode, {
        studentId: { $in: uniqueStudentIds },
        moduleId: { $in: moduleIds },
      }),
    )
      .select(
        "studentId moduleId moduleManualStatus completedAt completionEmailStatus",
      )
      .lean(),
    User.find({ _id: { $in: uniqueStudentIds }, role: "student" })
      .select("+pointAwardKeys +pointAwardKeysByCourse")
      .lean(),
  ]);

  const completedByStudentModule = new Map();
  const adminApprovedByStudentModule = new Map();
  const addCompletedPractical = (
    studentId,
    practicalId,
    target = completedByStudentModule,
  ) => {
    const moduleIdForPractical = practicalModuleById.get(String(practicalId));
    if (!moduleIdForPractical) return;
    const key = pairKey(studentId, moduleIdForPractical);
    if (!target.has(key)) target.set(key, new Set());
    target.get(key).add(String(practicalId));
  };
  for (const row of approvedAttempts) {
    addCompletedPractical(row._id.studentId, row._id.practicalId);
    addCompletedPractical(
      row._id.studentId,
      row._id.practicalId,
      adminApprovedByStudentModule,
    );
  }
  // Keep legacy completion state visible in reports. The email worker separately
  // verifies current admin-approved rows before it sends any module notification.
  const awardKeysByStudent = new Map(
    users.map((user) => [
      String(user._id),
      normalizedCourseCode === COURSE_CODE
        ? Array.isArray(user.pointAwardKeys)
          ? user.pointAwardKeys
          : []
        : mapValue(user.pointAwardKeysByCourse, normalizedCourseCode) || [],
    ]),
  );
  for (const [studentKey, awardKeys] of awardKeysByStudent) {
    for (const awardKey of awardKeys) {
      if (typeof awardKey === "string" && awardKey.startsWith("practical:")) {
        addCompletedPractical(studentKey, awardKey.slice("practical:".length));
      }
    }
  }

  const existingByStudentModule = new Map(
    existingRows.map((row) => [pairKey(row.studentId, row.moduleId), row]),
  );
  const calculatedAt = new Date();
  const rows = [];
  const operations = [];
  for (const studentId of uniqueStudentIds) {
    for (const module of modules) {
      const studentModuleKey = pairKey(studentId, module._id);
      const existing = existingByStudentModule.get(studentModuleKey);
      const totalPracticals = totalByModule.get(String(module._id)) || 0;
      const completedSet =
        completedByStudentModule.get(studentModuleKey) || new Set();
      const completedPracticals = Math.min(totalPracticals, completedSet.size);
      const moduleManualStatus = deriveModuleManualStatus(
        totalPracticals,
        completedPracticals,
      );
      const completedAt =
        moduleManualStatus === "completed"
          ? existing?.completedAt || calculatedAt
          : null;
      const adminApprovedCount =
        adminApprovedByStudentModule.get(studentModuleKey)?.size || 0;
      const everyPracticalAdminApproved =
        totalPracticals > 0 && adminApprovedCount >= totalPracticals;
      const completionEmailQueued = Boolean(
        queueCompletionEmail &&
        everyPracticalAdminApproved &&
        existing?.moduleManualStatus !== "completed" &&
        !existing?.completionEmailQueuedAt &&
        !existing?.completionEmailStatus,
      );
      const setFields = {
        courseCode: normalizedCourseCode,
        moduleManualStatus,
        completedPracticals,
        totalPracticals,
        completedAt,
      };
      if (completionEmailQueued) {
        Object.assign(setFields, {
          completionEmailStatus: "pending",
          completionEmailQueuedAt: calculatedAt,
          completionEmailAttempts: 0,
          completionEmailLastAttemptAt: null,
          completionEmailNextAttemptAt: null,
          completionEmailSentAt: null,
          completionEmailLastError: null,
        });
      }
      rows.push({
        _id: studentModuleKey,
        courseCode: normalizedCourseCode,
        studentId,
        moduleId: module._id,
        moduleNumber: module.moduleNumber,
        title: module.title,
        slug: module.slug,
        moduleManualStatus,
        completedPracticals,
        totalPracticals,
        completedAt,
        completionEmailQueued,
      });
      operations.push({
        updateOne: {
          // Keep legacy DBMS _ids stable; the migration backfills courseCode before the new unique index is installed.
          filter: { _id: studentModuleKey },
          update: {
            $set: setFields,
            $setOnInsert: {
              _id: studentModuleKey,
              studentId,
              moduleId: module._id,
            },
          },
          upsert: true,
        },
      });
    }
  }
  if (operations.length)
    await ModuleManualProgress.bulkWrite(operations, { ordered: false });
  return { modules, rows };
}

async function syncStudentModuleManualProgress(
  studentId,
  moduleId,
  options = {},
) {
  const { rows } = await syncModuleManualProgressForStudents([studentId], {
    moduleId,
    ...options,
  });
  return rows[0] || null;
}

module.exports = {
  deriveModuleManualStatus,
  syncModuleManualProgressForStudents,
  syncStudentModuleManualProgress,
};

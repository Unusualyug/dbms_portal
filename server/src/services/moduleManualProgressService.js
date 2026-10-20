const User = require('../models/User');
const Module = require('../models/Module');
const Practical = require('../models/Practical');
const PracticalAttempt = require('../models/PracticalAttempt');
const ModuleManualProgress = require('../models/ModuleManualProgress');
const { COURSE_CODE } = require('../config/constants');

function pairKey(studentId, moduleId) {
  return `${String(studentId)}:${String(moduleId)}`;
}

function deriveModuleManualStatus(totalPracticals, completedPracticals) {
  return totalPracticals > 0 && completedPracticals >= totalPracticals ? 'completed' : 'pending';
}

/**
 * Reconcile each selected student's per-module manual status with approved official
 * practicals. A module is completed only when every active practical is approved.
 * The resulting per-student/per-module documents are persisted for reports and CSV.
 */
async function syncModuleManualProgressForStudents(studentIds, { moduleId } = {}) {
  const studentsById = new Map((studentIds || []).filter(Boolean).map((id) => [String(id), id]));
  const uniqueStudentIds = [...studentsById.values()];

  const moduleFilter = { courseCode: COURSE_CODE, isActive: true };
  if (moduleId) moduleFilter._id = moduleId;
  const modules = await Module.find(moduleFilter).select('_id moduleNumber title').sort({ moduleNumber: 1 }).lean();
  if (!uniqueStudentIds.length || !modules.length) return { modules, rows: [] };

  const moduleIds = modules.map((module) => module._id);
  const practicals = await Practical.find({ moduleId: { $in: moduleIds }, isActive: true })
    .select('_id moduleId').lean();
  const practicalModuleById = new Map();
  const totalByModule = new Map(modules.map((module) => [String(module._id), 0]));
  for (const practical of practicals) {
    const practicalId = String(practical._id);
    const parentModuleId = String(practical.moduleId);
    practicalModuleById.set(practicalId, parentModuleId);
    totalByModule.set(parentModuleId, (totalByModule.get(parentModuleId) || 0) + 1);
  }

  const practicalIds = practicals.map((practical) => practical._id);
  const [approvedAttempts, users, existingRows] = await Promise.all([
    practicalIds.length
      ? PracticalAttempt.aggregate([
        { $match: {
          studentId: { $in: uniqueStudentIds },
          practicalId: { $in: practicalIds },
          $or: [{ completedAt: { $ne: null } }, { reviewStatus: 'approved' }],
        } },
        { $group: { _id: { studentId: '$studentId', practicalId: '$practicalId' } } },
      ])
      : [],
    User.find({ _id: { $in: uniqueStudentIds }, role: 'student' }).select('+pointAwardKeys').lean(),
    ModuleManualProgress.find({ studentId: { $in: uniqueStudentIds }, moduleId: { $in: moduleIds } })
      .select('studentId moduleId completedAt').lean(),
  ]);

  const completedByStudentModule = new Map();
  const addCompletedPractical = (studentId, practicalId) => {
    const moduleIdForPractical = practicalModuleById.get(String(practicalId));
    if (!moduleIdForPractical) return;
    const key = pairKey(studentId, moduleIdForPractical);
    if (!completedByStudentModule.has(key)) completedByStudentModule.set(key, new Set());
    completedByStudentModule.get(key).add(String(practicalId));
  };
  for (const row of approvedAttempts) {
    addCompletedPractical(row._id.studentId, row._id.practicalId);
  }
  for (const user of users) {
    for (const awardKey of user.pointAwardKeys || []) {
      if (typeof awardKey === 'string' && awardKey.startsWith('practical:')) {
        addCompletedPractical(user._id, awardKey.slice('practical:'.length));
      }
    }
  }

  const existingCompletedAt = new Map(existingRows.map((row) => [
    pairKey(row.studentId, row.moduleId),
    row.completedAt,
  ]));
  const calculatedAt = new Date();
  const rows = [];
  const operations = [];
  for (const studentId of uniqueStudentIds) {
    for (const module of modules) {
      const studentModuleKey = pairKey(studentId, module._id);
      const totalPracticals = totalByModule.get(String(module._id)) || 0;
      const completedSet = completedByStudentModule.get(studentModuleKey) || new Set();
      const completedPracticals = Math.min(totalPracticals, completedSet.size);
      const moduleManualStatus = deriveModuleManualStatus(totalPracticals, completedPracticals);
      const completedAt = moduleManualStatus === 'completed'
        ? (existingCompletedAt.get(studentModuleKey) || calculatedAt)
        : null;
      rows.push({
        studentId,
        moduleId: module._id,
        moduleNumber: module.moduleNumber,
        title: module.title,
        moduleManualStatus,
        completedPracticals,
        totalPracticals,
        completedAt,
      });
      operations.push({
        updateOne: {
          filter: { _id: studentModuleKey },
          update: {
            $set: { moduleManualStatus, completedPracticals, totalPracticals, completedAt },
            $setOnInsert: { _id: studentModuleKey, studentId, moduleId: module._id },
          },
          upsert: true,
        },
      });
    }
  }

  if (operations.length) await ModuleManualProgress.bulkWrite(operations, { ordered: false });
  return { modules, rows };
}

async function syncStudentModuleManualProgress(studentId, moduleId) {
  const { rows } = await syncModuleManualProgressForStudents([studentId], { moduleId });
  return rows[0] || null;
}

module.exports = {
  deriveModuleManualStatus,
  syncModuleManualProgressForStudents,
  syncStudentModuleManualProgress,
};

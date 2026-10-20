const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/User');
const Module = require('../src/models/Module');
const Practical = require('../src/models/Practical');
const PracticalAttempt = require('../src/models/PracticalAttempt');
const ModuleManualProgress = require('../src/models/ModuleManualProgress');
const { COURSE_CODE } = require('../src/config/constants');
const { deriveModuleManualStatus, syncModuleManualProgressForStudents } = require('../src/services/moduleManualProgressService');

function replace(target, key, value) {
  const original = target[key];
  target[key] = value;
  return () => { target[key] = original; };
}

function fakeQuery(value) {
  return {
    select() { return this; },
    sort() { return this; },
    lean() { return Promise.resolve(value); },
  };
}

test('module manual progress model persists pending/completed status per student and module', () => {
  assert.deepEqual(ModuleManualProgress.schema.path('moduleManualStatus').enumValues, ['pending', 'completed']);
  assert.equal(ModuleManualProgress.schema.path('moduleManualStatus').defaultValue, 'pending');
  assert.ok(ModuleManualProgress.schema.indexes().some(([keys, options]) => keys.studentId === 1 && keys.moduleId === 1 && options.unique));
});

test('module manual status is completed only when every active practical is approved', () => {
  assert.equal(deriveModuleManualStatus(4, 0), 'pending');
  assert.equal(deriveModuleManualStatus(4, 3), 'pending');
  assert.equal(deriveModuleManualStatus(4, 4), 'completed');
  assert.equal(deriveModuleManualStatus(0, 0), 'pending');
});

test('module manual reconciliation persists per-student status for each module', async () => {
  const nowCompletedAt = new Date('2026-10-01T10:00:00.000Z');
  const modules = [
    { _id: 'module-1', moduleNumber: 1, title: 'SQL basics' },
    { _id: 'module-2', moduleNumber: 2, title: 'Integrity' },
  ];
  const practicals = [
    { _id: 'p1-a', moduleId: 'module-1' },
    { _id: 'p1-b', moduleId: 'module-1' },
    { _id: 'p2-a', moduleId: 'module-2' },
  ];
  const aggregateRows = [
    { _id: { studentId: 'student-1', practicalId: 'p1-a' } },
    { _id: { studentId: 'student-1', practicalId: 'p1-b' } },
    { _id: { studentId: 'student-2', practicalId: 'p1-a' } },
  ];
  const users = [
    { _id: 'student-1', pointAwardKeys: [] },
    { _id: 'student-2', pointAwardKeys: ['practical:p2-a'] },
  ];
  const existing = [{ studentId: 'student-1', moduleId: 'module-1', completedAt: nowCompletedAt }];
  let bulkOperations = [];

  const restore = [
    replace(Module, 'find', (filter) => {
      assert.equal(filter.courseCode, COURSE_CODE);
      assert.equal(filter.isActive, true);
      return fakeQuery(modules);
    }),
    replace(Practical, 'find', () => fakeQuery(practicals)),
    replace(PracticalAttempt, 'aggregate', async () => aggregateRows),
    replace(User, 'find', () => fakeQuery(users)),
    replace(ModuleManualProgress, 'find', () => fakeQuery(existing)),
    replace(ModuleManualProgress, 'bulkWrite', async (operations, options) => {
      bulkOperations = operations;
      assert.equal(options.ordered, false);
      return { modifiedCount: operations.length };
    }),
  ];

  try {
    const result = await syncModuleManualProgressForStudents(['student-1', 'student-2']);
    assert.equal(result.modules.length, 2);
    assert.equal(result.rows.length, 4);
    const row = (studentId, moduleNumber) => result.rows.find((item) => item.studentId === studentId && item.moduleNumber === moduleNumber);
    assert.deepEqual(
      [row('student-1', 1).moduleManualStatus, row('student-1', 1).completedPracticals, row('student-1', 1).totalPracticals],
      ['completed', 2, 2],
    );
    assert.equal(row('student-1', 1).completedAt, nowCompletedAt);
    assert.deepEqual(
      [row('student-1', 2).moduleManualStatus, row('student-1', 2).completedPracticals, row('student-1', 2).totalPracticals],
      ['pending', 0, 1],
    );
    assert.deepEqual(
      [row('student-2', 1).moduleManualStatus, row('student-2', 1).completedPracticals, row('student-2', 1).totalPracticals],
      ['pending', 1, 2],
    );
    assert.deepEqual(
      [row('student-2', 2).moduleManualStatus, row('student-2', 2).completedPracticals, row('student-2', 2).totalPracticals],
      ['completed', 1, 1],
    );
    assert.equal(bulkOperations.length, 4);
    assert.ok(bulkOperations.every((operation) => operation.updateOne.upsert));
  } finally {
    restore.reverse().forEach((restoreMethod) => restoreMethod());
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/User');
const Module = require('../src/models/Module');
const Practical = require('../src/models/Practical');
const PracticalAttempt = require('../src/models/PracticalAttempt');
const TopicProgress = require('../src/models/TopicProgress');
const ModuleManualProgress = require('../src/models/ModuleManualProgress');
const { exportCsv } = require('../src/controllers/adminController');

function replace(target, key, value) {
  const original = target[key];
  target[key] = value;
  return () => { target[key] = original; };
}

function fakeQuery(value) {
  return {
    select() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(value); },
  };
}

test('progress CSV includes a completed/pending manual status column for each module', async () => {
  const students = [
    { _id: 'student-1', studentId: 'GMIU-1', name: 'Asha', email: 'asha@example.edu', semester: 3, classSection: 'X1', totalPoints: 40 },
    { _id: 'student-2', studentId: 'GMIU-2', name: 'Dev', email: 'dev@example.edu', semester: 5, classSection: 'Y1', totalPoints: 20 },
  ];
  const modules = [
    { _id: 'module-1', moduleNumber: 1, title: 'SQL basics' },
    { _id: 'module-2', moduleNumber: 2, title: 'Integrity' },
  ];
  const practicals = [
    { _id: 'p1-a', moduleId: 'module-1' },
    { _id: 'p1-b', moduleId: 'module-1' },
    { _id: 'p2-a', moduleId: 'module-2' },
  ];
  const attemptRows = [
    { _id: { studentId: 'student-1', practicalId: 'p1-a' } },
    { _id: { studentId: 'student-1', practicalId: 'p1-b' } },
    { _id: { studentId: 'student-2', practicalId: 'p1-a' } },
  ];
  let csv = '';
  const restore = [
    replace(User, 'find', (filter) => fakeQuery(filter._id ? [
      { _id: 'student-1', pointAwardKeys: [] },
      { _id: 'student-2', pointAwardKeys: ['practical:p2-a'] },
    ] : students)),
    replace(Module, 'find', () => fakeQuery(modules)),
    replace(Practical, 'find', () => fakeQuery(practicals)),
    replace(PracticalAttempt, 'aggregate', async () => attemptRows),
    replace(TopicProgress, 'aggregate', async () => [
      { _id: 'student-1', opened: 2, completed: 1 },
      { _id: 'student-2', opened: 1, completed: 0 },
    ]),
    replace(ModuleManualProgress, 'find', () => fakeQuery([])),
    replace(ModuleManualProgress, 'bulkWrite', async () => ({ modifiedCount: 4 })),
  ];
  const response = {
    setHeader() {},
    send(value) { csv = value; },
  };

  try {
    await exportCsv({ params: { type: 'progress' }, query: {} }, response);
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
    assert.ok(lines[0].includes('"module1ManualStatus"'));
    assert.ok(lines[0].includes('"module2ManualStatus"'));
    assert.ok(lines[1].endsWith('"completed","pending"'));
    assert.ok(lines[2].endsWith('"pending","completed"'));
  } finally {
    restore.reverse().forEach((restoreMethod) => restoreMethod());
  }
});

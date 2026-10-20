const test = require('node:test');
const assert = require('node:assert/strict');
const { registerSchema } = require('../src/validators/authSchemas');

const validStudent = {
  name: 'Sample Student',
  email: 'student@example.edu',
  password: 'a-long-test-password-123',
  semester: '3',
  classSection: 'X1',
};

test('registration accepts the allowed semester and class and converts semester to a number', () => {
  const result = registerSchema.safeParse(validStudent);
  assert.equal(result.success, true);
  assert.equal(result.data.semester, 3);
  assert.equal(result.data.classSection, 'X1');
});

test('registration rejects semesters and classes outside the offered options', () => {
  assert.equal(registerSchema.safeParse({ ...validStudent, semester: '4' }).success, false);
  assert.equal(registerSchema.safeParse({ ...validStudent, classSection: 'Z1' }).success, false);
});

test('registration requires a semester and class selection', () => {
  const { semester, classSection, ...missingCohort } = validStudent;
  assert.equal(registerSchema.safeParse(missingCohort).success, false);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const content = require('../src/seed/courseContent.json');
const { localOracleSqlPreflight, runOraclePractical } = require('../src/services/oracleLabService');

test('official manifest preserves module order and exact practical counts', () => {
  assert.deepEqual(content.modules.map((module) => module.moduleNumber), [1, 2, 3, 4, 5]);
  assert.deepEqual(content.modules.map((module) => module.practicals.length), [16, 13, 9, 6, 8]);
  for (const module of content.modules) {
    assert.deepEqual(module.practicals.map((item) => item.number), Array.from({ length: module.practicals.length }, (_, i) => i + 1));
  }
});

test('Module 1 scan ambiguity is preserved and explicitly flagged', () => {
  const practical = content.modules[0].practicals[11];
  assert.equal(practical.number, 12);
  assert.equal(practical.sourceWordingUnclear, true);
  assert.match(practical.prompt, /Create minimum 10 records/);
});

test('course outcomes are present in source order', () => {
  assert.deepEqual(content.course.courseOutcomes.map((outcome) => outcome.code), ['CO1', 'CO2', 'CO3', 'CO4', 'CO5']);
});

test('page 12 instructional method and reference list are retained', () => {
  assert.equal(content.course.instructionalMethod.length, 5);
  assert.equal(content.course.referenceBooks.length, 5);
  assert.ok(content.course.instructionalMethod.some((item) => item.includes('Ten percent')));
});

test('static SQL parser preflight cannot claim expected result or completion', async () => {
  const previousUrl = process.env.ORACLE_LAB_URL;
  const previousToken = process.env.ORACLE_LAB_TOKEN;
  delete process.env.ORACLE_LAB_URL;
  delete process.env.ORACLE_LAB_TOKEN;
  const practical = { key: 'module-1-p01', prompt: 'Create and describe a table.', dialect: 'oracle' };
  const result = await runOraclePractical({ code: 'SELECT 1 FROM dual;', practical, studentId: 'student-test' });
  assert.equal(result.executionMode, 'preflight-only');
  assert.equal(result.isCorrect, null);
  assert.equal(result.expectedResultStatus, 'not-run');
  assert.equal(result.databaseStateStatus, 'not-run');
  if (previousUrl) process.env.ORACLE_LAB_URL = previousUrl;
  if (previousToken) process.env.ORACLE_LAB_TOKEN = previousToken;
});

test('procedural PL/SQL is not falsely parsed by the local SQL-only preflight', () => {
  const result = localOracleSqlPreflight('BEGIN NULL; END;');
  assert.equal(result.syntaxStatus, 'not-run');
  assert.match(result.validationNote, /PL\/SQL requires/);
});

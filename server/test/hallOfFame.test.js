const test = require('node:test');
const assert = require('node:assert/strict');
const HttpError = require('../src/utils/httpError');
const { HALL_OF_FAME_LIMIT, parseHallOfFameFilters, listHallOfFame } = require('../src/services/hallOfFameService');

test('Hall of Fame defaults to the full active student population', () => {
  assert.deepEqual(parseHallOfFameFilters({}), { filter: {}, semester: 'all', classSection: 'all' });
  assert.equal(HALL_OF_FAME_LIMIT, 10);
});

test('Hall of Fame accepts semester and class filters independently or together', () => {
  assert.deepEqual(parseHallOfFameFilters({ semester: '5' }), { filter: { semester: 5 }, semester: '5', classSection: 'all' });
  assert.deepEqual(parseHallOfFameFilters({ classSection: 'x2' }), { filter: { classSection: 'X2' }, semester: 'all', classSection: 'X2' });
  assert.deepEqual(parseHallOfFameFilters({ semester: '3', classSection: 'Y1' }), { filter: { semester: 3, classSection: 'Y1' }, semester: '3', classSection: 'Y1' });
});

test('Hall of Fame rejects unsupported cohort filters', () => {
  assert.throws(() => parseHallOfFameFilters({ semester: '7' }), (error) => error instanceof HttpError && error.status === 400);
  assert.throws(() => parseHallOfFameFilters({ classSection: 'Z9' }), (error) => error instanceof HttpError && error.status === 400);
});

test('Hall of Fame returns only safe fields and at most ten sorted students', async () => {
  const calls = { filter: null, selection: '', sort: null, limit: 0 };
  const rows = Array.from({ length: 12 }, (_, index) => ({
    _id: `student-${index}`,
    name: `Student ${String(index).padStart(2, '0')}`,
    email: `student${index}@example.edu`,
    studentId: `GMIU-${index}`,
    semester: 3,
    classSection: 'X1',
    totalPoints: 120 - index,
    profilePhotoUrl: `https://res.cloudinary.test/student-${index}.jpg`,
  }));
  const query = {
    select(selection) { calls.selection = selection; return this; },
    sort(sort) { calls.sort = sort; return this; },
    limit(limit) { calls.limit = limit; return this; },
    async lean() { return rows.slice(0, calls.limit); },
  };
  const model = { find(filter) { calls.filter = filter; return query; } };
  const result = await listHallOfFame({ semester: '3', classSection: 'X1' }, model);

  assert.deepEqual(calls.filter, { role: 'student', isActive: { $ne: false }, semester: 3, classSection: 'X1' });
  assert.equal(calls.selection, 'name semester classSection totalPoints profilePhotoUrl');
  assert.equal(calls.limit, 10);
  assert.deepEqual(calls.sort, { totalPoints: -1, name: 1, _id: 1 });
  assert.equal(result.students.length, 10);
  assert.deepEqual(result.students.map((student) => student.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(result.students[0].totalPoints, 120);
  assert.equal(result.students[0].profilePhotoUrl, 'https://res.cloudinary.test/student-0.jpg');
  assert.equal(Object.hasOwn(result.students[0], 'email'), false);
  assert.equal(Object.hasOwn(result.students[0], 'studentId'), false);
});

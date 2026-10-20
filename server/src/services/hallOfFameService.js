const User = require('../models/User');
const HttpError = require('../utils/httpError');

const VALID_SEMESTERS = new Set(['3', '5']);
const VALID_CLASSES = new Set(['X1', 'X2', 'Y1', 'Y2']);
const HALL_OF_FAME_LIMIT = 10;

function parseHallOfFameFilters(query = {}) {
  const filter = {};
  let semester = 'all';
  let classSection = 'all';

  if (query.semester !== undefined && String(query.semester).trim() !== '' && query.semester !== 'all') {
    semester = String(query.semester).trim();
    if (!VALID_SEMESTERS.has(semester)) throw new HttpError(400, 'Semester filter must be 3 or 5.');
    filter.semester = Number(semester);
  }

  if (query.classSection !== undefined && String(query.classSection).trim() !== '' && query.classSection !== 'all') {
    classSection = String(query.classSection).trim().toUpperCase();
    if (!VALID_CLASSES.has(classSection)) throw new HttpError(400, 'Class filter must be X1, X2, Y1 or Y2.');
    filter.classSection = classSection;
  }

  return { filter, semester, classSection };
}

async function listHallOfFame(query, userModel = User) {
  const parsed = parseHallOfFameFilters(query);
  const students = await userModel.find({
    role: 'student',
    isActive: { $ne: false },
    ...parsed.filter,
  })
    .select('name semester classSection totalPoints profilePhotoUrl')
    .sort({ totalPoints: -1, name: 1, _id: 1 })
    .limit(HALL_OF_FAME_LIMIT)
    .lean();

  return {
    students: students.map((student, index) => ({
      rank: index + 1,
      name: student.name,
      profilePhotoUrl: student.profilePhotoUrl || null,
      semester: student.semester ?? null,
      classSection: student.classSection || null,
      totalPoints: Number(student.totalPoints) || 0,
    })),
    filters: { semester: parsed.semester, classSection: parsed.classSection },
    limit: HALL_OF_FAME_LIMIT,
  };
}

module.exports = { HALL_OF_FAME_LIMIT, parseHallOfFameFilters, listHallOfFame };

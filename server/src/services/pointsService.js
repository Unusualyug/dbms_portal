const User = require("../models/User");
const { COURSE_CODE, normalizeCourseCode } = require("../config/constants");

const POINT_VALUES = Object.freeze({ mcq: 10, practical: 20 });

function mapValue(value, key) {
  if (value instanceof Map) return value.get(key);
  return value?.[key];
}

/**
 * DBMS continues using its original totalPoints / pointAwardKeys fields so every
 * pre-existing balance and deduplication key remains intact. Other subjects use
 * their own nested fields on the shared account document.
 */
async function awardPointsOnce({
  studentId,
  awardKey,
  points,
  courseCode = COURSE_CODE,
}) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  if (
    !studentId ||
    !awardKey ||
    !Number.isInteger(points) ||
    points <= 0 ||
    !normalizedCourseCode
  ) {
    throw new TypeError(
      "A student, award key, supported course, and positive integer point value are required.",
    );
  }

  if (normalizedCourseCode === COURSE_CODE) {
    const updated = await User.findOneAndUpdate(
      { _id: studentId, role: "student", pointAwardKeys: { $ne: awardKey } },
      {
        $addToSet: { pointAwardKeys: awardKey },
        $inc: { totalPoints: points },
      },
      { new: true },
    )
      .select("totalPoints")
      .lean();

    if (updated)
      return {
        awarded: true,
        pointsAwarded: points,
        totalPoints: updated.totalPoints || 0,
      };

    const current = await User.findById(studentId).select("totalPoints").lean();
    if (!current)
      throw new Error("Student account was not found while awarding points.");
    return {
      awarded: false,
      pointsAwarded: 0,
      totalPoints: current.totalPoints || 0,
    };
  }

  const pointsPath = `coursePoints.${normalizedCourseCode}`;
  const awardKeysPath = `pointAwardKeysByCourse.${normalizedCourseCode}`;
  const updated = await User.findOneAndUpdate(
    { _id: studentId, role: "student", [awardKeysPath]: { $ne: awardKey } },
    {
      $addToSet: { [awardKeysPath]: awardKey },
      $inc: { [pointsPath]: points },
    },
    { new: true },
  )
    .select("coursePoints")
    .lean();

  if (updated) {
    return {
      awarded: true,
      pointsAwarded: points,
      totalPoints:
        Number(mapValue(updated.coursePoints, normalizedCourseCode)) || 0,
    };
  }
  const current = await User.findById(studentId).select("coursePoints").lean();
  if (!current)
    throw new Error("Student account was not found while awarding points.");
  return {
    awarded: false,
    pointsAwarded: 0,
    totalPoints:
      Number(mapValue(current.coursePoints, normalizedCourseCode)) || 0,
  };
}

async function getCoursePoints({ studentId, courseCode = COURSE_CODE }) {
  const normalizedCourseCode = normalizeCourseCode(courseCode) || COURSE_CODE;
  if (!studentId) return 0;
  if (normalizedCourseCode === COURSE_CODE) {
    const user = await User.findById(studentId).select("totalPoints").lean();
    return Number(user?.totalPoints) || 0;
  }
  const user = await User.findById(studentId).select("coursePoints").lean();
  return Number(mapValue(user?.coursePoints, normalizedCourseCode)) || 0;
}

async function hasPointsAward({
  studentId,
  awardKey,
  courseCode = COURSE_CODE,
}) {
  const normalizedCourseCode = normalizeCourseCode(courseCode) || COURSE_CODE;
  if (!studentId || !awardKey) return false;
  if (normalizedCourseCode === COURSE_CODE) {
    return Boolean(
      await User.exists({
        _id: studentId,
        role: "student",
        pointAwardKeys: awardKey,
      }),
    );
  }
  return Boolean(
    await User.exists({
      _id: studentId,
      role: "student",
      [`pointAwardKeysByCourse.${normalizedCourseCode}`]: awardKey,
    }),
  );
}

async function getPointAwardKeys(studentId, courseCode = COURSE_CODE) {
  const normalizedCourseCode = normalizeCourseCode(courseCode) || COURSE_CODE;
  if (!studentId) return [];
  if (normalizedCourseCode === COURSE_CODE) {
    const user = await User.findById(studentId)
      .select("+pointAwardKeys")
      .lean();
    return Array.isArray(user?.pointAwardKeys) ? user.pointAwardKeys : [];
  }
  const user = await User.findById(studentId)
    .select("+pointAwardKeysByCourse")
    .lean();
  const keys = mapValue(user?.pointAwardKeysByCourse, normalizedCourseCode);
  return Array.isArray(keys) ? keys : [];
}

module.exports = {
  POINT_VALUES,
  awardPointsOnce,
  getCoursePoints,
  hasPointsAward,
  getPointAwardKeys,
};

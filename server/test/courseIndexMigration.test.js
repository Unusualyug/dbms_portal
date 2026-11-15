const test = require("node:test");
const assert = require("node:assert/strict");
const {
  LEGACY_COURSE_CODE_FILTER,
  OBSOLETE_UNIQUE_KEYS,
  sameIndexKey,
  run,
} = require("../src/seed/migrateCourseIndexes");
const Module = require("../src/models/Module");
const LearningTime = require("../src/models/LearningTime");

test("index migration only recognizes exact old unique keys", () => {
  assert.equal(sameIndexKey({ moduleNumber: 1 }, { moduleNumber: 1 }), true);
  assert.equal(
    sameIndexKey({ courseCode: 1, moduleNumber: 1 }, { moduleNumber: 1 }),
    false,
  );
  assert.ok(
    OBSOLETE_UNIQUE_KEYS.get(Module).some((key) =>
      sameIndexKey(key, { moduleNumber: 1 }),
    ),
  );
  assert.equal(OBSOLETE_UNIQUE_KEYS.get(LearningTime), undefined);
});

test("legacy course-code backfill targets only missing or null tags", () => {
  assert.deepEqual(LEGACY_COURSE_CODE_FILTER, {
    $or: [{ courseCode: { $exists: false } }, { courseCode: null }],
  });
});

test("index and data migration refuses apply without a verified-backup acknowledgement", async () => {
  const prior = process.env.COURSE_MIGRATION_ACK;
  delete process.env.COURSE_MIGRATION_ACK;
  try {
    await assert.rejects(run({ apply: true }), /back up.*staging/i);
  } finally {
    if (prior === undefined) delete process.env.COURSE_MIGRATION_ACK;
    else process.env.COURSE_MIGRATION_ACK = prior;
  }
});

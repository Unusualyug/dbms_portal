const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const manifests = [
  {
    name: "DBMS",
    file: "courseContent.json",
    expectedCourseCode: "BETICE13305",
    expectedPracticalCounts: [16, 13, 9, 6, 8],
    numbering: "per-module",
    expectedTotals: { topics: 153, practicals: 52 },
  },
  {
    name: "Operating Systems",
    file: "osCourseContent.json",
    expectedCourseCode: "BET1CE14311",
    expectedPracticalCounts: [23, 39, 22, 13, 14],
    numbering: "course-wide",
    expectedTotals: { topics: 34, practicals: 111 },
  },
];

for (const manifest of manifests) {
  const file = path.resolve(__dirname, `../server/src/seed/${manifest.file}`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(
    data.course.courseCode,
    manifest.expectedCourseCode,
    `${manifest.name} course code mismatch.`,
  );
  assert.equal(
    data.modules.length,
    5,
    `${manifest.name} must have five modules.`,
  );
  const seenTopicIds = new Set();
  let topicTotal = 0;
  let practicalTotal = 0;
  let nextCourseWidePractical = 1;

  for (const [index, module] of data.modules.entries()) {
    assert.equal(
      module.moduleNumber,
      index + 1,
      `${manifest.name}: module order/number must match the official syllabus.`,
    );
    assert.equal(
      module.practicals.length,
      manifest.expectedPracticalCounts[index],
      `${manifest.name}: Module ${index + 1} practical count mismatch.`,
    );
    if (manifest.numbering === "per-module") {
      assert.deepEqual(
        module.practicals.map((practical) => practical.number),
        Array.from({ length: module.practicals.length }, (_, i) => i + 1),
        `${manifest.name}: Module ${index + 1} practical numbering must be contiguous.`,
      );
    } else {
      assert.deepEqual(
        module.practicals.map((practical) => practical.number),
        Array.from(
          { length: module.practicals.length },
          (_, i) => nextCourseWidePractical + i,
        ),
        `${manifest.name}: Practical numbers must continue in source order.`,
      );
      nextCourseWidePractical += module.practicals.length;
      assert.equal(
        module.hours,
        18,
        `${manifest.name}: every module is listed as 18 hours.`,
      );
      assert.equal(
        module.weightagePercent,
        20,
        `${manifest.name}: every module has 20% course weightage.`,
      );
    }
    for (const topic of module.topics) {
      assert.ok(
        topic.title && topic.group && topic.id,
        `${manifest.name}: Module ${index + 1} contains an incomplete topic.`,
      );
      assert.ok(
        !seenTopicIds.has(topic.id),
        `${manifest.name}: duplicate topic id ${topic.id}`,
      );
      seenTopicIds.add(topic.id);
    }
    for (const practical of module.practicals)
      assert.ok(
        practical.prompt.trim(),
        `${manifest.name}: empty practical ${module.moduleNumber}.${practical.number}`,
      );
    topicTotal += module.topics.length;
    practicalTotal += module.practicals.length;
    console.log(
      `${manifest.name} Module ${module.moduleNumber}: ${module.topics.length} topic entries; ${module.practicals.length} official practicals — ${module.title}`,
    );
  }

  assert.equal(
    topicTotal,
    manifest.expectedTotals.topics,
    `${manifest.name} topic total mismatch.`,
  );
  assert.equal(
    practicalTotal,
    manifest.expectedTotals.practicals,
    `${manifest.name} official practical total mismatch.`,
  );
  assert.equal(
    data.course.courseOutcomes.length,
    5,
    `${manifest.name} must have five course outcomes.`,
  );
  if (manifest.numbering === "course-wide") {
    assert.equal(data.course.semester, 4);
    assert.equal(data.course.credits, 5);
    assert.equal(data.course.marks.semesterEndEvaluation, 100);
    assert.equal(data.course.marks.continuousComprehensiveEvaluation, 50);
    assert.equal(data.course.marks.total, 150);
  }
  console.log(
    `PASS: ${manifest.name} — ${topicTotal} topic entries and ${practicalTotal} official practical prompts match the manifest.\n`,
  );
}

console.log(
  "All course manifests passed. No database connection or seed operation was performed.",
);

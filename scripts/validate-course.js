const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const file = path.resolve(__dirname, '../server/src/seed/courseContent.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const expectedPracticals = [16, 13, 9, 6, 8];
assert.equal(data.modules.length, 5, 'The official file has five modules.');
const seenTopicIds = new Set();
let topicTotal = 0;
let practicalTotal = 0;
for (const [index, module] of data.modules.entries()) {
  assert.equal(module.moduleNumber, index + 1, 'Module order/number must match the official syllabus.');
  assert.equal(module.practicals.length, expectedPracticals[index], `Module ${index + 1} practical count mismatch.`);
  assert.deepEqual(module.practicals.map((p) => p.number), Array.from({ length: expectedPracticals[index] }, (_, i) => i + 1), `Module ${index + 1} practical numbering must be contiguous.`);
  for (const topic of module.topics) {
    assert.ok(topic.title && topic.group && topic.id, `Module ${index + 1} contains an incomplete topic.`);
    assert.ok(!seenTopicIds.has(topic.id), `Duplicate topic id: ${topic.id}`);
    seenTopicIds.add(topic.id);
  }
  for (const practical of module.practicals) assert.ok(practical.prompt.trim(), `Empty practical ${module.moduleNumber}.${practical.number}`);
  topicTotal += module.topics.length;
  practicalTotal += module.practicals.length;
  console.log(`Module ${module.moduleNumber}: ${module.topics.length} theory entries; ${module.practicals.length} practicals — ${module.title}`);
}
assert.equal(practicalTotal, 52);
assert.equal(data.course.courseOutcomes.length, 5);
console.log(`\nPASS: ${topicTotal} syllabus topic/subtopic entries, ${practicalTotal} official practical prompts; counts/order match the scanned PDF.`);
console.log('Note: Module 1 Practical 12 is flagged for source-scan verification and is preserved as transcribed.');

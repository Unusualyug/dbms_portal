const test = require('node:test');
const assert = require('node:assert/strict');

const practiceArenaRounds = require('../../shared/practiceArena.json');
const practiceArenaCounts = practiceArenaRounds.reduce((total, round) => {
  const count = round.sections.reduce((sectionTotal, section) => sectionTotal + section.tasks.length, 0);
  return { rounds: total.rounds + 1, challenges: total.challenges + count };
}, { rounds: 0, challenges: 0 });

test('Practice Arena contains seven independent rounds and all 208 challenge cards', () => {
  assert.deepEqual(practiceArenaRounds.map((round) => round.id), [
    'round-01', 'round-02', 'round-03', 'round-04', 'round-05', 'round-06', 'final-round',
  ]);
  assert.equal(practiceArenaCounts.rounds, 7);
  assert.equal(practiceArenaCounts.challenges, 208);

  const tasks = practiceArenaRounds.flatMap((round) => round.sections.flatMap((section) => section.tasks));
  assert.equal(new Set(tasks.map((task) => task.id)).size, tasks.length, 'challenge IDs must be unique');
  assert.ok(tasks.every((task) => task.title && task.prompt.trim()), 'each challenge needs a title and question prompt');
});

test('Practice Arena preserves the major SQL and PL/SQL topic areas', () => {
  const allPromptText = practiceArenaRounds.flatMap((round) => round.sections.flatMap((section) => section.tasks))
    .map((task) => `${task.title}\n${task.prompt}`).join('\n');
  for (const requiredTerm of ['NATURAL JOIN', 'CROSS JOIN', 'SAVEPOINT', 'NEXTVAL', 'EXPLAIN PLAN', 'PL/SQL', 'PKG_PROJECT_MGMT', 'PROJECT_AUDIT']) {
    assert.ok(allPromptText.includes(requiredTerm), `missing Practice Arena content: ${requiredTerm}`);
  }
});

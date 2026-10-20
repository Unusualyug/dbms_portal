import practiceArenaRounds from '../../../shared/practiceArena.json';

export { practiceArenaRounds };

export const practiceArenaCounts = practiceArenaRounds.reduce((total, round) => {
  const count = round.sections.reduce((sectionTotal, section) => sectionTotal + section.tasks.length, 0);
  return { rounds: total.rounds + 1, challenges: total.challenges + count };
}, { rounds: 0, challenges: 0 });

import dbmsPracticeArenaRounds from "../../../shared/practiceArena.json";
import osPracticeArenaRounds from "../../../shared/osPracticeArena.json";
import {
  DEFAULT_COURSE_CODE,
  OS_COURSE_CODE,
} from "../services/courseSelection.js";

function summarize(rounds) {
  return rounds.reduce(
    (total, round) => {
      const count = round.sections.reduce(
        (sectionTotal, section) => sectionTotal + section.tasks.length,
        0,
      );
      return { rounds: total.rounds + 1, challenges: total.challenges + count };
    },
    { rounds: 0, challenges: 0 },
  );
}

export const practiceArenaByCourse = Object.freeze({
  [DEFAULT_COURSE_CODE]: Object.freeze({
    rounds: dbmsPracticeArenaRounds,
    counts: summarize(dbmsPracticeArenaRounds),
  }),
  [OS_COURSE_CODE]: Object.freeze({
    rounds: osPracticeArenaRounds,
    counts: summarize(osPracticeArenaRounds),
  }),
});

export function getPracticeArena(courseCode = DEFAULT_COURSE_CODE) {
  return (
    practiceArenaByCourse[courseCode] ||
    practiceArenaByCourse[DEFAULT_COURSE_CODE]
  );
}

// Backward-compatible DBMS exports for components and tests that still use the original catalog.
export const practiceArenaRounds = dbmsPracticeArenaRounds;
export const practiceArenaCounts =
  practiceArenaByCourse[DEFAULT_COURSE_CODE].counts;

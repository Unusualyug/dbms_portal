export const POINT_MILESTONE_BADGES = Object.freeze([
  {
    id: "query-explorer",
    name: "Query Explorer",
    points: 500,
    shortLabel: "500",
    icon: "sparkles",
    theme: "copper",
    description: "Awarded for earning 500 points.",
  },
  {
    id: "data-architect",
    name: "Data Architect",
    points: 1000,
    shortLabel: "1k",
    icon: "database",
    theme: "blue",
    description: "Awarded for earning 1,000 points.",
  },
  {
    id: "dbms-legend",
    name: "DBMS Legend",
    points: 2000,
    shortLabel: "2k",
    icon: "crown",
    theme: "gold",
    description: "Awarded for earning 2,000 points.",
  },
]);

export function getEarnedPointBadges(totalPoints) {
  const points = Math.max(0, Number(totalPoints) || 0);
  return POINT_MILESTONE_BADGES.filter((badge) => points >= badge.points);
}

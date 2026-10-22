import { Crown, Database, Sparkles } from "lucide-react";

const BADGE_ICONS = {
  sparkles: Sparkles,
  database: Database,
  crown: Crown,
};

export default function BadgePins({ badges = [], className = "" }) {
  if (!badges.length) return null;

  return (
    <span
      className={`badge-pin-cluster ${className}`.trim()}
      role="group"
      aria-label={`Earned badges: ${badges.map((badge) => badge.name).join(", ")}`}
    >
      {badges.slice(0, 3).map((badge, index) => {
        const Icon = BADGE_ICONS[badge.icon] || Sparkles;
        const pointsLabel = `${badge.points.toLocaleString()} points`;
        return (
          <span
            key={badge.id}
            className={`badge-pin badge-pin--${badge.theme} badge-pin--slot-${index + 1}`}
            role="img"
            aria-label={`${badge.name}, ${pointsLabel}`}
            title={`${badge.name} · ${pointsLabel}`}
          >
            <span className="badge-pin-seal">
              <Icon size={11} aria-hidden="true" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

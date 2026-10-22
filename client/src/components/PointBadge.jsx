import { Crown, Database, Sparkles } from "lucide-react";

const BADGE_ICONS = {
  sparkles: Sparkles,
  database: Database,
  crown: Crown,
};

export default function PointBadge({ badge, earned = false, compact = false }) {
  const Icon = BADGE_ICONS[badge.icon] || Sparkles;
  const pointsLabel = `${badge.points.toLocaleString()} points`;

  if (compact) {
    return (
      <span
        className={`point-badge point-badge--compact point-badge--${badge.theme}${earned ? " is-earned" : " is-locked"}`}
        role="img"
        aria-label={`${badge.name}, ${pointsLabel}${earned ? ", earned" : ", locked"}`}
        title={`${badge.name} · ${pointsLabel}${earned ? " · Earned" : " · Locked"}`}
      >
        <Icon size={11} aria-hidden="true" />
        <span>{badge.shortLabel}</span>
      </span>
    );
  }

  return (
    <div
      className={`point-badge point-badge--full point-badge--${badge.theme}${earned ? " is-earned" : " is-locked"}`}
      role="group"
      aria-label={`${badge.name}, ${pointsLabel}, ${earned ? "earned" : "locked"}`}
    >
      <span className="point-badge-emblem">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="point-badge-copy">
        <strong>{badge.name}</strong>
        <small>{pointsLabel}</small>
      </span>
      <span className="point-badge-status">{earned ? "Earned" : "Locked"}</span>
    </div>
  );
}

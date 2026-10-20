export function formatDuration(seconds = 0) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}
export function formatDate(value, options = {}) {
  if (!value) return '—';
  const { time = true, ...intlOptions } = options;
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', ...(time ? { timeStyle: 'short' } : {}), ...intlOptions }).format(new Date(value));
}
export function formatTimeAgo(value) {
  if (!value) return 'No activity yet';
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
export function titleCaseEvent(eventType = '') {
  return eventType.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
}

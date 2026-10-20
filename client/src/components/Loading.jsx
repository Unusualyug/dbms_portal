export default function Loading({ label = 'Loading your learning space…' }) {
  return <div className="loading-state"><span className="loader" /><span>{label}</span></div>;
}

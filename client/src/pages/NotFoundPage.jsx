import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function NotFoundPage() {
  return <div className="not-found"><ThemeToggle className="not-found-theme-toggle" /><div className="not-found-code">404</div><h1>This page is off the syllabus.</h1><p>The route may have moved or you may not have access.</p><Link to="/" className="button button-dark">Return to portal</Link></div>;
}

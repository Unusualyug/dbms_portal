import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const target = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;

  return (
    <button
      className={`theme-toggle ${className}`.trim()}
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${target} mode`}
      aria-pressed={theme === 'dark'}
    >
      <span className="theme-toggle-icon" aria-hidden="true"><Icon size={17} strokeWidth={2} /></span>
    </button>
  );
}

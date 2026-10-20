import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

function readTokenFromFragment() {
  return new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
}

export default function ResetPasswordPage() {
  const { refresh } = useAuth();
  const [token] = useState(readTokenFromFragment);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('This reset link is missing or invalid. Request a new one.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      window.history.replaceState(null, '', window.location.pathname);
      await refresh();
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="password-recovery-page">
      <ThemeToggle className="auth-theme-toggle" />
      <section className="password-recovery-card surface-card">
        <Link className="password-recovery-back" to="/login"><ArrowLeft size={15} /> Back to sign in</Link>
        <span className="password-recovery-icon"><KeyRound size={22} /></span>
        <span className="eyebrow">STUDENT ACCOUNT RECOVERY</span>
        <h1>Set a new password</h1>
        {success ? (
          <div className="password-recovery-success" role="status"><CheckCircle2 size={18} /><span>Your password has been updated. Please sign in with the new password.</span></div>
        ) : !token ? (
          <div className="password-recovery-error" role="alert"><p>This reset link is missing or invalid.</p><Link to="/forgot-password">Request a new reset link</Link></div>
        ) : (
          <>
            <p className="password-recovery-description">Choose a new password with at least 12 characters. This link is one-time use and expires after 30 minutes.</p>
            <form className="password-recovery-form" onSubmit={submit}>
              <PasswordInput id="reset-new-password" label="New password" value={password} onChange={(event) => setPassword(event.target.value)} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
              <PasswordInput id="reset-confirm-password" label="Confirm new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} visible={showConfirmation} onToggle={() => setShowConfirmation((value) => !value)} />
              {error && <p className="profile-form-message is-error" role="alert">{error}</p>}
              <button className="button button-dark button-full" type="submit" disabled={busy || password.length < 12 || !confirmPassword}>
                {busy ? <LoaderCircle size={16} className="icon-spin" /> : <KeyRound size={16} />}
                {busy ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

function PasswordInput({ id, label, value, onChange, visible, onToggle }) {
  return (
    <div className="recovery-password-field">
      <label htmlFor={id}>{label}</label>
      <div className="profile-password-control">
        <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} autoComplete="new-password" minLength="12" maxLength="128" required />
        <button type="button" onClick={onToggle} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}><span aria-hidden="true">{visible ? <EyeOff size={16} /> : <Eye size={16} />}</span></button>
      </div>
    </div>
  );
}

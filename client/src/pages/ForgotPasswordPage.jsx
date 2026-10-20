import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, LoaderCircle, Mail } from 'lucide-react';
import { api } from '../services/api.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
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
        <h1>Forgot your password?</h1>
        <p className="password-recovery-description">Enter the email address on your student account. If it matches an active student account, we’ll send a one-time reset link.</p>
        {sent ? (
          <div className="password-recovery-success" role="status">
            <Mail size={18} />
            <span>If an active student account matches that email, a reset link will arrive shortly. Check your inbox and spam folder.</span>
          </div>
        ) : (
          <form className="password-recovery-form" onSubmit={submit}>
            <label htmlFor="recovery-email">Student email</label>
            <input id="recovery-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength="254" placeholder="you@university.edu" required />
            {error && <p className="profile-form-message is-error" role="alert">{error}</p>}
            <button className="button button-dark button-full" type="submit" disabled={busy}>
              {busy ? <LoaderCircle size={16} className="icon-spin" /> : <Mail size={16} />}
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
        <p className="password-recovery-note">The reset link expires after 30 minutes. Email reset requires the portal administrator to configure SMTP.</p>
        <p className="password-recovery-admin-note">Administrator password is managed by the portal administrator, not this student reset form.</p>
      </section>
    </main>
  );
}

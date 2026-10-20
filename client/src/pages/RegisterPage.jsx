import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import PortalLogo from '../components/PortalLogo.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', semester: '', classSection: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  const change = (event) => setForm((value) => ({ ...value, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await register(form); navigate('/student', { replace: true }); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return <div className="auth-page">
    <ThemeToggle className="auth-theme-toggle" />
    <div className="auth-left register-left">
      <Link to="/" className="auth-back"><ArrowLeft size={16} /> Back to course</Link>
      <div className="auth-left-content">
        <PortalLogo light />
        <span className="eyebrow">YOUR DBMS PATH STARTS HERE</span>
        <h1>From first query<br />to <em>confident design.</em></h1>
        <p>Learn in short steps, practise the official tasks and keep track of your own progress.</p>
        <div className="signup-perks"><span><i>01</i> Structured course modules</span><span><i>02</i> Active learning time</span><span><i>03</i> Progress that means something</span></div>
      </div>
      <span className="auth-copyright">GMIU · DBMS COURSE PORTAL</span>
    </div>
    <div className="auth-right">
      <div className="auth-form-wrap">
        <span className="eyebrow">STUDENT REGISTRATION</span>
        <h2>Create your account</h2>
        <p className="auth-subtitle">Choose your current semester and class. These details are saved with your student profile.</p>
        <form onSubmit={submit} className="auth-form">
          <label>Full name<div className="input-with-icon"><UserRound size={17} /><input name="name" value={form.name} onChange={change} placeholder="Your name" autoComplete="name" minLength="2" maxLength="100" required /></div></label>
          <label>University email<div className="input-with-icon"><Mail size={17} /><input name="email" type="email" value={form.email} onChange={change} placeholder="you@university.edu" autoComplete="email" required /></div></label>
          <div className="registration-cohort-grid">
            <label htmlFor="registration-semester">Semester
              <select id="registration-semester" name="semester" value={form.semester} onChange={change} required>
                <option value="">Select semester</option>
                <option value="3">Semester 3</option>
                <option value="5">Semester 5</option>
              </select>
            </label>
            <label htmlFor="registration-class">Class / section
              <select id="registration-class" name="classSection" value={form.classSection} onChange={change} required>
                <option value="">Select class</option>
                <option value="X1">X1</option>
                <option value="X2">X2</option>
                <option value="Y1">Y1</option>
                <option value="Y2">Y2</option>
              </select>
            </label>
          </div>
          <label>Create password<div className="input-with-icon"><LockKeyhole size={17} /><input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={change} placeholder="At least 12 characters" autoComplete="new-password" minLength="12" maxLength="128" required /><button className="password-toggle" type="button" onClick={() => setShowPassword((x) => !x)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><small className="field-note">Use at least 12 characters. Passwords are stored as a secure hash.</small></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-dark button-full" disabled={busy}>{busy ? <span className="button-loader" /> : 'Create student account'} {!busy && <span>→</span>}</button>
        </form>
        <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
        <div className="auth-security"><LockKeyhole size={15} /><span>Semester and class are stored on your student account. Admin access is provisioned separately.</span></div>
      </div>
    </div>
  </div>;
}

import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useCourse } from "../context/CourseContext.jsx";
import PortalLogo from "../components/PortalLogo.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function LoginPage() {
  const { user, login } = useAuth();
  const { currentCourse } = useCourse();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user)
    return (
      <Navigate to={user.role === "admin" ? "/admin" : "/student"} replace />
    );
  const change = (event) =>
    setForm((value) => ({ ...value, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const account = await login(form);
      const target =
        location.state?.from?.pathname ||
        (account.role === "admin" ? "/admin" : "/student");
      navigate(target, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <ThemeToggle className="auth-theme-toggle" />
      <div className="auth-left">
        <Link to="/" className="auth-back">
          <ArrowLeft size={16} /> Back to course
        </Link>
        <div className="auth-left-content">
          <PortalLogo light courseName={currentCourse?.shortName || "GMIU"} />
          <span className="eyebrow">WELCOME BACK</span>
          <h1>
            Your next {currentCourse?.shortName || "course"}
            <br />
            <em>breakthrough</em>
            <br />
            starts here.
          </h1>
          <p>
            Sign in once to your GMIU learning account, then switch between DBMS
            and Operating Systems whenever you like.
          </p>
          <div className="auth-bullet">
            <span>✦</span>{" "}
            {currentCourse?.shortName === "OS"
              ? "Architecture, processes, memory, and security"
              : "Oracle SQL and PL/SQL, explained simply"}
          </div>
          <div className="auth-bullet">
            <span>✦</span> Course progress and points stay separate
          </div>
        </div>
        <span className="auth-copyright">GMIU · LEARNING PORTAL</span>
      </div>
      <div className="auth-right">
        <div className="auth-form-wrap">
          <span className="eyebrow">SIGN IN TO YOUR WORKSPACE</span>
          <h2>Welcome back</h2>
          <p className="auth-subtitle">
            Use your student account or the fixed administrator account.
            Semester and class are saved when a student registers.
          </p>
          <form onSubmit={submit} className="auth-form">
            <label>
              Email address
              <div className="input-with-icon">
                <Mail size={17} />
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={change}
                  placeholder="you@university.edu"
                  autoComplete="username"
                  required
                />
              </div>
            </label>
            <label>
              Password
              <div className="input-with-icon">
                <LockKeyhole size={17} />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={change}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((x) => !x)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            <div className="auth-forgot-row">
              <Link to="/forgot-password">Forgot your student password?</Link>
              <small>Administrator password is managed on the server.</small>
            </div>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="button button-dark button-full" disabled={busy}>
              {busy ? <span className="button-loader" /> : "Sign in"}{" "}
              {!busy && <span>→</span>}
            </button>
          </form>
          <p className="auth-switch">
            New to the portal?{" "}
            <Link to="/register">Create your student account</Link>
          </p>
          <div className="auth-security">
            <LockKeyhole size={15} />
            <span>
              Passwords are hashed server-side. Admin credentials are never
              stored in the client.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

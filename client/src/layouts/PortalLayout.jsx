import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Brain,
  ChartNoAxesCombined,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Code2,
  Database,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { usePresenceHeartbeat } from "../hooks/usePresenceHeartbeat.js";
import { connectPortalSocket } from "../services/socket.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

const studentLinks = [
  {
    to: "/student",
    label: "Dashboard",
    icon: LayoutDashboard,
    end: true,
    group: "LEARNING",
  },
  {
    to: "/student/modules",
    label: "Modules",
    icon: BookOpen,
    group: "LEARNING",
  },
  {
    to: "/student/questions",
    label: "Questions",
    icon: CircleHelp,
    group: "LEARNING",
  },
  {
    to: "/student/lab",
    label: "Practical submissions",
    icon: Code2,
    group: "LEARNING",
  },
  {
    to: "/student/arena",
    label: "Practice Arena",
    icon: Brain,
    group: "LEARNING",
  },
  {
    to: "/student/progress",
    label: "My progress",
    icon: ChartNoAxesCombined,
    group: "LEARNING",
  },
  {
    to: "/student/hall-of-fame",
    label: "Hall of Fame",
    icon: Trophy,
    group: "LEARNING",
  },
  {
    to: "/student/support",
    label: "Contact & Support",
    icon: LifeBuoy,
    group: "LEARNING",
  },
  { to: "/student/profile", label: "Profile", icon: Users, group: "ACCOUNT" },
];
const adminLinks = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/activity", label: "Activity feed", icon: Clock3 },
  {
    to: "/admin/analytics",
    label: "Learning analytics",
    icon: ChartNoAxesCombined,
  },
  {
    to: "/admin/submissions",
    label: "Review submissions",
    icon: ClipboardCheck,
  },
  { to: "/admin/support", label: "Contact & Support", icon: LifeBuoy },
  { to: "/admin/content", label: "Content verification", icon: FileCheck2 },
];

export default function PortalLayout({ role }) {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  usePresenceHeartbeat(Boolean(user));
  useEffect(() => {
    if (role !== "student" || !user) return undefined;
    const socket = connectPortalSocket();
    const handleSubmissionReview = (detail) => {
      window.dispatchEvent(
        new CustomEvent("portal:submission-reviewed", { detail }),
      );
      refresh().catch(() => {});
    };
    socket.on("student:submission-reviewed", handleSubmissionReview);
    return () =>
      socket.off("student:submission-reviewed", handleSubmissionReview);
  }, [role, user, refresh]);
  const links = role === "admin" ? adminLinks : studentLinks;
  const title = role === "admin" ? "DBMS Admin" : "DBMS Learning";
  const onLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className={`portal-frame portal-frame-${role}`}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {menuOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${role === "student" ? "sidebar-student" : "sidebar-admin"} ${menuOpen ? "sidebar-open" : ""}`}
      >
        <div className="brand-lockup">
          <div className="brand-mark">
            <Database size={19} strokeWidth={2.1} />
          </div>
          <div className="brand-lockup-copy">
            <strong>
              GMIU <span>DBMS</span>
            </strong>
            <small>LEARNING PORTAL</small>
          </div>
          <button
            className="icon-button sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        {role === "student" && (
          <div className="student-sidebar-profile">
            <div className="student-sidebar-avatar">
              {user?.profilePhotoUrl ? (
                <img src={user.profilePhotoUrl} alt="" />
              ) : (
                user?.name?.slice(0, 1)?.toUpperCase() || "S"
              )}
            </div>
            <b>{user?.name || "Student"}</b>
            <small>{user?.studentId || "Student account"}</small>
          </div>
        )}
        <div className="course-chip">
          <span className="course-chip-icon">
            <GraduationCap size={17} />
          </span>
          <span>
            <b>
              {role === "student"
                ? `DBMS · Sem ${user?.semester || "—"} · ${user?.classSection || "—"}`
                : "DBMS · Admin"}
            </b>
            <small>BETICE13305</small>
          </span>
        </div>
        {role === "student" ? (
          <nav
            className="side-nav student-side-nav"
            aria-label="Main navigation"
          >
            {["LEARNING", "ACCOUNT"].map((group) => (
              <div className="sidebar-nav-group" key={group}>
                <p className="nav-eyebrow">{group}</p>
                {studentLinks
                  .filter((item) => item.group === group)
                  .map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        `nav-item ${isActive ? "nav-item-active" : ""}`
                      }
                    >
                      <Icon size={18} strokeWidth={1.9} />
                      <span>{label}</span>
                    </NavLink>
                  ))}
              </div>
            ))}
          </nav>
        ) : (
          <>
            <p className="nav-eyebrow">WORKSPACE</p>
            <nav className="side-nav" aria-label="Main navigation">
              {links.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "nav-item-active" : ""}`
                  }
                >
                  <Icon size={18} strokeWidth={1.9} />
                  <span>{label}</span>
                  {label === "Activity feed" && <i className="live-dot" />}
                </NavLink>
              ))}
            </nav>
          </>
        )}
        {role === "admin" && (
          <div className="sidebar-note">
            <ShieldCheck size={17} />
            <span>
              Single administrator
              <br />
              <b>analytics workspace</b>
            </span>
          </div>
        )}
        {role === "student" && (
          <div className="sidebar-help">
            <span className="help-icon">?</span>
            <div>
              <b>Need a quick start?</b>
              <small>Pick a module and continue learning.</small>
            </div>
            <a href="/student/modules" aria-label="Open modules">
              ↗
            </a>
          </div>
        )}
        <div className="sidebar-bottom">
          {role === "student" ? (
            <button className="student-sidebar-signout" onClick={onLogout}>
              <LogOut size={16} /> Sign out
            </button>
          ) : (
            <div className="user-mini">
              <div className="avatar">
                {user?.name?.slice(0, 1)?.toUpperCase() || "U"}
              </div>
              <div className="user-mini-info">
                <b>{user?.name || "Account"}</b>
                <small>Administrator</small>
              </div>
              <button
                className="icon-button logout-small"
                onClick={onLogout}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
          <div className="sidebar-footnote">
            Course content follows the official syllabus.
          </div>
        </div>
      </aside>
      <div className="portal-main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="topbar-crumb">
            <span>
              {role === "admin" ? "ADMIN WORKSPACE" : "STUDENT WORKSPACE"}
            </span>
            <b>/</b>
            <strong>{breadcrumb(location.pathname)}</strong>
          </div>
          <div className="topbar-right">
            <div className="status-pill">
              <span className="live-dot" />
              {role === "admin" ? "Live tracking on" : "Activity syncing"}
            </div>
            <ThemeToggle />
            <button
              className="top-avatar"
              type="button"
              onClick={() =>
                navigate(role === "admin" ? "/admin" : "/student/profile")
              }
              aria-label="Open account"
            >
              {role === "student" && user?.profilePhotoUrl ? (
                <img src={user.profilePhotoUrl} alt="" />
              ) : (
                user?.name?.slice(0, 1)?.toUpperCase() || "U"
              )}
            </button>
          </div>
        </header>
        <main className="page-content" id="main-content" tabIndex="-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className="page-route"
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="app-footer">
          <span>DBMS Learning Portal</span>
          <span>Official syllabus-aligned · {new Date().getFullYear()}</span>
          <span>Designed &amp; developed by Yug Lakhani</span>
        </footer>
      </div>
    </div>
  );
}

function breadcrumb(path) {
  const last = path.split("/").filter(Boolean).pop() || "dashboard";
  if (last === "student" || last === "admin") return "Overview";
  if (last === "support") return "Contact & Support";
  return last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

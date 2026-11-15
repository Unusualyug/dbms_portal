export default function PortalLogo({ light = false, courseName = "DBMS" }) {
  return (
    <div className={`portal-logo${light ? " portal-logo-light" : ""}`}>
      <img
        className="portal-logo-emblem"
        src="/gmiu-logo.png"
        alt="GMIU university logo"
      />
      <span className="portal-logo-copy">
        <strong className="portal-logo-title">
          <span>GMIU</span>
          <b>{courseName}</b>
        </strong>
        <small className="portal-logo-subtitle">LEARNING PORTAL</small>
      </span>
    </div>
  );
}

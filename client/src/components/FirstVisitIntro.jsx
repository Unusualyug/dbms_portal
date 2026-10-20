import { useCallback, useEffect, useState } from 'react';

const INTRO_KEY = 'gmiu-dbms-intro-seen-v1';

function hasSeenIntro() {
  try { return window.sessionStorage.getItem(INTRO_KEY) === '1'; }
  catch { return false; }
}

export default function FirstVisitIntro({ children }) {
  const [showIntro, setShowIntro] = useState(() => !hasSeenIntro());
  const finishIntro = useCallback(() => {
    try { window.sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* Storage may be disabled; the intro still closes. */ }
    setShowIntro(false);
  }, []);

  useEffect(() => {
    if (!showIntro) return undefined;
    const timeout = window.setTimeout(finishIntro, 3600);
    return () => window.clearTimeout(timeout);
  }, [showIntro, finishIntro]);

  return (
    <>
      {children}
      {showIntro && (
        <div className="gmiu-intro" role="status" aria-live="polite" aria-label="GMIU DBMS learning portal introduction">
          <div className="gmiu-intro-grid" aria-hidden="true" />
          <div className="gmiu-intro-orbit gmiu-intro-orbit-one" aria-hidden="true" />
          <div className="gmiu-intro-orbit gmiu-intro-orbit-two" aria-hidden="true" />
          <div className="gmiu-intro-content">
            <div className="gmiu-intro-kicker"><span /> GYANMANJARI INNOVATIVE UNIVERSITY</div>
            <div className="gmiu-intro-logo-frame">
              <img src="/gmiu-logo.png" alt="GMIU university emblem" />
            </div>
            <h1 className="gmiu-intro-title"><span>GMIU</span><b>DBMS</b></h1>
            <p className="gmiu-intro-subtitle">DATABASE LEARNING PORTAL</p>
            <div className="gmiu-intro-progress" aria-hidden="true"><span /></div>
            <p className="gmiu-intro-caption">Opening your learning space<span className="intro-ellipsis">…</span></p>
          </div>
          <button className="gmiu-intro-skip" type="button" onClick={finishIntro}>Skip intro</button>
        </div>
      )}
    </>
  );
}

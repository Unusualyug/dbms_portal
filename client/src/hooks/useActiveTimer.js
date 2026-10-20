import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

export function useActiveTimer({ scopeType, scopeId, enabled = true }) {
  const timerId = useRef(null);
  const activeRef = useRef(false);
  const heartbeatRef = useRef(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [ready, setReady] = useState(false);

  const start = useCallback(async () => {
    if (!enabled || activeRef.current || document.visibilityState !== 'visible') return;
    try {
      const result = await api.post('/student/activity/timer/start', { scopeType, scopeId });
      timerId.current = result.timerId;
      activeRef.current = true;
      setReady(true);
    } catch { /* A timer outage must not block reading; server will not count unreported time. */ }
  }, [enabled, scopeType, scopeId]);

  const stop = useCallback(async () => {
    if (!activeRef.current || !timerId.current) return;
    const id = timerId.current;
    activeRef.current = false;
    timerId.current = null;
    try { await api.post('/student/activity/timer/heartbeat', { timerId: id, stop: true }); } catch { /* best effort */ }
  }, []);

  const flush = useCallback(async () => {
    await stop();
  }, [stop]);

  useEffect(() => {
    if (!enabled || !scopeType || !scopeId) return undefined;
    let mounted = true;
    const ensureStart = async () => { if (mounted) await start(); };
    ensureStart();
    heartbeatRef.current = window.setInterval(async () => {
      if (!activeRef.current || !timerId.current || document.visibilityState !== 'visible') return;
      try { await api.post('/student/activity/timer/heartbeat', { timerId: timerId.current }); } catch { activeRef.current = false; timerId.current = null; }
    }, 15000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
      else ensureStart();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mounted = false;
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [enabled, scopeType, scopeId, start, stop]);

  useEffect(() => {
    if (!enabled || !scopeId) return undefined;
    let last = Date.now();
    const tick = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && activeRef.current) setElapsedSeconds((value) => value + Math.max(0, Math.floor((now - last) / 1000)));
      last = now;
    }, 1000);
    return () => window.clearInterval(tick);
  }, [enabled, scopeId]);

  return { elapsedSeconds, ready, flush };
}

export function useQuestionHeartbeat(attemptId, enabled) {
  useEffect(() => {
    if (!attemptId || !enabled) return undefined;
    const send = () => {
      if (document.visibilityState === 'visible') api.post(`/student/question-attempts/${attemptId}/heartbeat`).catch(() => {});
    };
    const interval = window.setInterval(send, 15000);
    document.addEventListener('visibilitychange', send);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', send); };
  }, [attemptId, enabled]);
}

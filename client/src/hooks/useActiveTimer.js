import { useCallback, useEffect, useRef, useState } from "react";
import { useCourse } from "../context/CourseContext.jsx";
import { api } from "../services/api";

function timerKey(courseCode, scopeType, scopeId) {
  return JSON.stringify([courseCode, scopeType, scopeId || ""]);
}

export function useActiveTimer({ scopeType, scopeId, enabled = true }) {
  const { courseCode } = useCourse();
  const timerId = useRef(null);
  const timerCourseCode = useRef(null);
  const activeRef = useRef(false);
  const heartbeatPendingRef = useRef(false);
  const pendingStartsRef = useRef(new Map());
  const startRef = useRef(null);
  const effectActiveRef = useRef(false);
  const currentConfigRef = useRef(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [ready, setReady] = useState(false);
  const currentKey = timerKey(courseCode, scopeType, scopeId);
  currentConfigRef.current = { key: currentKey, enabled: Boolean(enabled) };

  const start = useCallback(async () => {
    if (
      !enabled ||
      !scopeType ||
      !scopeId ||
      activeRef.current ||
      document.visibilityState !== "visible"
    )
      return;
    const requestCourseCode = courseCode;
    const requestKey = timerKey(requestCourseCode, scopeType, scopeId);
    const pending = pendingStartsRef.current.get(requestKey);
    if (pending) return pending;

    let startPromise;
    startPromise = (async () => {
      try {
        const result = await api.post(
          "/student/activity/timer/start",
          { scopeType, scopeId },
          { headers: { "x-course-code": requestCourseCode } },
        );
        const current = currentConfigRef.current;
        const requestIsCurrent =
          effectActiveRef.current &&
          current?.enabled &&
          current.key === requestKey &&
          document.visibilityState === "visible";

        if (
          !requestIsCurrent ||
          (activeRef.current && timerId.current !== result.timerId)
        ) {
          await api
            .post(
              "/student/activity/timer/heartbeat",
              { timerId: result.timerId, stop: true },
              { headers: { "x-course-code": requestCourseCode } },
            )
            .catch(() => {});
          window.setTimeout(() => {
            const latest = currentConfigRef.current;
            if (
              effectActiveRef.current &&
              latest?.enabled &&
              document.visibilityState === "visible" &&
              !activeRef.current
            ) {
              startRef.current?.();
            }
          }, 0);
          return;
        }

        timerId.current = result.timerId;
        timerCourseCode.current = requestCourseCode;
        activeRef.current = true;
        setReady(true);
      } catch {
        // A timer outage must not block reading; unreported time is never counted.
      }
    })().finally(() => {
      if (pendingStartsRef.current.get(requestKey) === startPromise)
        pendingStartsRef.current.delete(requestKey);
    });
    pendingStartsRef.current.set(requestKey, startPromise);
    return startPromise;
  }, [courseCode, enabled, scopeType, scopeId]);
  startRef.current = start;

  const stop = useCallback(async () => {
    if (!activeRef.current || !timerId.current) return;
    const id = timerId.current;
    const owningCourseCode = timerCourseCode.current || courseCode;
    activeRef.current = false;
    timerId.current = null;
    timerCourseCode.current = null;
    try {
      await api.post(
        "/student/activity/timer/heartbeat",
        { timerId: id, stop: true },
        { headers: { "x-course-code": owningCourseCode } },
      );
    } catch {
      // Best effort: the session cleanup closes any remaining active timers.
    }
  }, [courseCode]);

  const flush = useCallback(async () => {
    await stop();
  }, [stop]);

  useEffect(() => {
    setElapsedSeconds(0);
    setReady(false);
  }, [courseCode, scopeType, scopeId]);

  useEffect(() => {
    if (!enabled || !scopeType || !scopeId) {
      effectActiveRef.current = false;
      return undefined;
    }
    effectActiveRef.current = true;
    const ensureStart = () => {
      if (effectActiveRef.current) start();
    };
    ensureStart();
    const heartbeat = window.setInterval(async () => {
      if (
        !activeRef.current ||
        !timerId.current ||
        heartbeatPendingRef.current ||
        document.visibilityState !== "visible"
      )
        return;
      const id = timerId.current;
      const owningCourseCode = timerCourseCode.current || courseCode;
      heartbeatPendingRef.current = true;
      try {
        await api.post(
          "/student/activity/timer/heartbeat",
          { timerId: id },
          { headers: { "x-course-code": owningCourseCode } },
        );
      } catch {
        if (
          timerId.current === id &&
          timerCourseCode.current === owningCourseCode
        ) {
          activeRef.current = false;
          timerId.current = null;
          timerCourseCode.current = null;
          api
            .post(
              "/student/activity/timer/heartbeat",
              { timerId: id, stop: true },
              { headers: { "x-course-code": owningCourseCode } },
            )
            .catch(() => {});
        }
      } finally {
        heartbeatPendingRef.current = false;
      }
    }, 15000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
      else ensureStart();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      effectActiveRef.current = false;
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [enabled, scopeType, scopeId, courseCode, start, stop]);

  useEffect(() => {
    if (!enabled || !scopeId) return undefined;
    let last = Date.now();
    const tick = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible" && activeRef.current)
        setElapsedSeconds(
          (value) => value + Math.max(0, Math.floor((now - last) / 1000)),
        );
      last = now;
    }, 1000);
    return () => window.clearInterval(tick);
  }, [enabled, scopeId, courseCode]);

  return { elapsedSeconds, ready, flush };
}

export function useQuestionHeartbeat(attemptId, enabled) {
  useEffect(() => {
    if (!attemptId || !enabled) return undefined;
    const send = () => {
      if (document.visibilityState === "visible")
        api
          .post(`/student/question-attempts/${attemptId}/heartbeat`)
          .catch(() => {});
    };
    const interval = window.setInterval(send, 15000);
    document.addEventListener("visibilitychange", send);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", send);
    };
  }, [attemptId, enabled]);
}

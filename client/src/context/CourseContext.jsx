import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../services/api.js";
import { useAuth } from "./AuthContext.jsx";
import {
  DEFAULT_COURSE_CODE,
  SUPPORTED_COURSE_CODES,
  fallbackCourse,
  readSelectedCourseCode,
  saveSelectedCourseCode,
} from "../services/courseSelection.js";

const CourseContext = createContext(null);

export function CourseProvider({ children }) {
  const { user } = useAuth();
  const [courseCode, setCourseCode] = useState(readSelectedCourseCode);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseError, setCourseError] = useState("");

  useEffect(() => {
    saveSelectedCourseCode(courseCode);
  }, [courseCode]);

  useEffect(() => {
    if (!user) {
      setCourses([]);
      setCourseError("");
      setLoadingCourses(false);
      return undefined;
    }
    let current = true;
    setLoadingCourses(true);
    setCourseError("");
    const endpoint =
      user.role === "admin" ? "/admin/courses" : "/student/courses";
    api
      .get(endpoint)
      .then((data) => {
        if (!current) return;
        const available = Array.isArray(data.courses)
          ? data.courses.filter((course) =>
              SUPPORTED_COURSE_CODES.includes(course.code),
            )
          : [];
        setCourses(available);
        setCourseCode((selected) => {
          const resolved = available.some((course) => course.code === selected)
            ? selected
            : available.some(
                  (course) => course.code === data.selectedCourseCode,
                )
              ? data.selectedCourseCode
              : DEFAULT_COURSE_CODE;
          saveSelectedCourseCode(resolved);
          return resolved;
        });
      })
      .catch((error) => {
        if (current)
          setCourseError(error.message || "Could not load available subjects.");
      })
      .finally(() => {
        if (current) setLoadingCourses(false);
      });
    return () => {
      current = false;
    };
  }, [user?.id, user?.role]);

  const selectCourse = useCallback((nextCourseCode) => {
    if (!SUPPORTED_COURSE_CODES.includes(nextCourseCode)) return;
    saveSelectedCourseCode(nextCourseCode);
    setCourseCode(nextCourseCode);
  }, []);

  const currentCourse =
    courses.find((course) => course.code === courseCode) ||
    fallbackCourse(courseCode);
  const value = useMemo(
    () => ({
      courseCode,
      currentCourse,
      courses: courses.map((course) => ({
        ...course,
        selected: course.code === courseCode,
      })),
      loadingCourses,
      courseError,
      selectCourse,
    }),
    [
      courseCode,
      currentCourse,
      courses,
      loadingCourses,
      courseError,
      selectCourse,
    ],
  );

  return (
    <CourseContext.Provider value={value}>{children}</CourseContext.Provider>
  );
}

export function useCourse() {
  const value = useContext(CourseContext);
  if (!value) throw new Error("useCourse must be used inside CourseProvider.");
  return value;
}

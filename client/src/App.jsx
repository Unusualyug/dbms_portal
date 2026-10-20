import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PortalLayout from './layouts/PortalLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';

const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard.jsx'));
const ModulesPage = lazy(() => import('./pages/ModulesPage.jsx'));
const ModuleDetailPage = lazy(() => import('./pages/ModuleDetailPage.jsx'));
const TopicDetailPage = lazy(() => import('./pages/TopicDetailPage.jsx'));
const QuestionsPage = lazy(() => import('./pages/QuestionsPage.jsx'));
const PracticalLabPage = lazy(() => import('./pages/PracticalLabPage.jsx'));
const PracticeArenaPage = lazy(() => import('./pages/PracticeArenaPage.jsx'));
const ProgressPage = lazy(() => import('./pages/ProgressPage.jsx'));
const HallOfFamePage = lazy(() => import('./pages/HallOfFamePage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const AdminStudentsPage = lazy(() => import('./pages/AdminStudentsPage.jsx'));
const AdminStudentDetailPage = lazy(() => import('./pages/AdminStudentDetailPage.jsx'));
const AdminAnalyticsPage = lazy(() => import('./pages/AdminAnalyticsPage.jsx'));
const AdminActivityPage = lazy(() => import('./pages/AdminActivityPage.jsx'));
const AdminContentPage = lazy(() => import('./pages/AdminContentPage.jsx'));
const AdminSubmissionsPage = lazy(() => import('./pages/AdminSubmissionsPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

function HomeRedirect() {
  const { user } = useAuth();
  return user ? <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace /> : <LandingPage />;
}

function LoadingPage() {
  return <div className="page-loading"><span className="loader" />Loading GMIU DBMS…</div>;
}

export default function App() {
  return <Suspense fallback={<LoadingPage />}><Routes>
    <Route path="/" element={<HomeRedirect />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route element={<ProtectedRoute role="student" />}>
      <Route path="/student" element={<PortalLayout role="student" />}>
        <Route index element={<StudentDashboard />} />
        <Route path="modules" element={<ModulesPage />} />
        <Route path="modules/:moduleId" element={<ModuleDetailPage />} />
        <Route path="topics/:topicId" element={<TopicDetailPage />} />
        <Route path="questions" element={<QuestionsPage />} />
        <Route path="lab" element={<PracticalLabPage />} />
        <Route path="arena" element={<PracticeArenaPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="hall-of-fame" element={<HallOfFamePage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Route>
    <Route element={<ProtectedRoute role="admin" />}>
      <Route path="/admin" element={<PortalLayout role="admin" />}>
        <Route index element={<AdminDashboard />} />
        <Route path="students" element={<AdminStudentsPage />} />
        <Route path="students/:id" element={<AdminStudentDetailPage />} />
        <Route path="activity" element={<AdminActivityPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="content" element={<AdminContentPage />} />
        <Route path="submissions" element={<AdminSubmissionsPage />} />
      </Route>
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes></Suspense>;
}

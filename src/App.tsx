import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/AuthRoutes";
import { AcademicDataProvider } from "@/contexts/AcademicDataContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const StudentSubjects = lazy(() => import("./pages/student/StudentSubjects"));
const StudentAssignments = lazy(() => import("./pages/student/StudentAssignments"));
const StudentUpload = lazy(() => import("./pages/student/StudentUpload"));
const StudentStatus = lazy(() => import("./pages/student/StudentStatus"));
const StudentOriginality = lazy(() => import("./pages/student/StudentOriginality"));
const StudentGrades = lazy(() => import("./pages/student/StudentGrades"));
const StudentHistory = lazy(() => import("./pages/student/StudentHistory"));
const StudentCalendar = lazy(() => import("./pages/student/StudentCalendar"));

const TeacherDashboard = lazy(() => import("./pages/teacher/TeacherDashboard"));
const TeacherCreateAssignment = lazy(() => import("./pages/teacher/TeacherCreateAssignment"));
const TeacherAssignments = lazy(() => import("./pages/teacher/TeacherAssignments"));
const TeacherSubmissions = lazy(() => import("./pages/teacher/TeacherSubmissions"));
const TeacherReview = lazy(() => import("./pages/teacher/TeacherReview"));
const TeacherAnalytics = lazy(() => import("./pages/teacher/TeacherAnalytics"));
const TeacherReports = lazy(() => import("./pages/teacher/TeacherReports"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminRoles = lazy(() => import("./pages/admin/AdminRoles"));
const AdminSubjects = lazy(() => import("./pages/admin/AdminSubjects"));
const AdminActivity = lazy(() => import("./pages/admin/AdminActivity"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="bg-card border border-border rounded-2xl px-6 py-5 shadow-card text-center">
        <p className="text-sm font-medium">جاري تحميل الصفحة...</p>
      </div>
    </div>
  );
}

function StudentLayout() {
  return <AppLayout role="student" breadcrumbs={[{ label: "بوابة الطالب" }]} />;
}

function TeacherLayout() {
  return <AppLayout role="teacher" breadcrumbs={[{ label: "بوابة المعلم" }]} />;
}

function AdminLayout() {
  return <AppLayout role="admin" breadcrumbs={[{ label: "بوابة الإدارة" }]} />;
}

function SharedLayout() {
  return <AppLayout role="student" breadcrumbs={[{ label: "النظام" }]} />;
}

function AppShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NotificationsProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />

                <Route element={<PublicOnlyRoute />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                </Route>

                <Route element={<ProtectedRoute />}>
                  <Route path="/change-password" element={<ChangePasswordPage />} />
                </Route>

                <Route element={<ProtectedRoute />}>
                  <Route element={<SharedLayout />}>
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Route>
                </Route>

                <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
                  <Route element={<StudentLayout />}>
                    <Route path="/student" element={<StudentDashboard />} />
                    <Route path="/student/subjects" element={<StudentSubjects />} />
                    <Route path="/student/assignments" element={<StudentAssignments />} />
                    <Route path="/student/upload" element={<StudentUpload />} />
                    <Route path="/student/status" element={<StudentStatus />} />
                    <Route path="/student/originality" element={<StudentOriginality />} />
                    <Route path="/student/grades" element={<StudentGrades />} />
                    <Route path="/student/history" element={<StudentHistory />} />
                    <Route path="/student/calendar" element={<StudentCalendar />} />
                  </Route>
                </Route>

                <Route element={<ProtectedRoute allowedRoles={["teacher"]} />}>
                  <Route element={<TeacherLayout />}>
                    <Route path="/teacher" element={<TeacherDashboard />} />
                    <Route path="/teacher/create-assignment" element={<TeacherCreateAssignment />} />
                    <Route path="/teacher/assignments" element={<TeacherAssignments />} />
                    <Route path="/teacher/submissions" element={<TeacherSubmissions />} />
                    <Route path="/teacher/review" element={<TeacherReview />} />
                    <Route path="/teacher/analytics" element={<TeacherAnalytics />} />
                    <Route path="/teacher/reports" element={<TeacherReports />} />
                  </Route>
                </Route>

                <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                  <Route element={<AdminLayout />}>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/roles" element={<AdminRoles />} />
                    <Route path="/admin/subjects" element={<AdminSubjects />} />
                    <Route path="/admin/activity" element={<AdminActivity />} />
                    <Route path="/admin/reports" element={<AdminReports />} />
                    <Route path="/admin/settings" element={<AdminSettings />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </NotificationsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AcademicDataProvider>
        <AppShell />
      </AcademicDataProvider>
    </AuthProvider>
  );
}

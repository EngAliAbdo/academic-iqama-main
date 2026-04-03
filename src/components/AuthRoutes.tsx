import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleHome, type UserRole } from "@/lib/auth";

function AppBootFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="bg-card border border-border rounded-2xl px-6 py-5 shadow-card text-center">
        <p className="text-sm font-medium">جاري تهيئة النظام...</p>
      </div>
    </div>
  );
}

export function PublicOnlyRoute() {
  const { isReady, user } = useAuth();

  if (!isReady) {
    return <AppBootFallback />;
  }

  if (user) {
    return <Navigate to={user.mustChangePassword ? "/change-password" : getRoleHome(user.role)} replace />;
  }

  return <Outlet />;
}

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: UserRole[] }) {
  const { isReady, user } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return <AppBootFallback />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  return <Outlet />;
}

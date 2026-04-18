import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { isSuperAdminRole } from "@/lib/super-admin";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to={isSuperAdminRole(user?.role) ? "/admin" : "/"} replace />;
  }

  return <Outlet />;
}

/** Application locataire (admin / gestionnaire) : les super admins sont renvoyés vers le back-office. */
export function TenantAppRoute() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return null;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (isSuperAdminRole(user?.role)) {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}

/** Réservé au rôle SUPER_ADMIN (back-office plateforme). */
export function SuperAdminRoute() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return null;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!isSuperAdminRole(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

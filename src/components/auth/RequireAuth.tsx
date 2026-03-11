import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";

export default function RequireAuth() {
  const { session, isLoading } = useAuth();
  if (isLoading) return null;
  if (!session?.user?.id) return <Navigate to="/auth" replace />;
  return <Outlet />;
}

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthLoadingScreen } from '@/components/ui/loading-states';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireCorretor?: boolean;
}

const ProtectedRoute = ({ 
  children, 
  requireAdmin = false, 
  requireCorretor = false 
}: ProtectedRouteProps) => {
  const { user, profile, loading, isAdmin, isCorretor } = useAuth();
  const location = useLocation();

  // Show loading while checking auth
  if (loading) {
    return <AuthLoadingScreen />;
  }

  // Redirect to auth if not logged in
  if (!user || !profile) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requireCorretor && !isCorretor) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
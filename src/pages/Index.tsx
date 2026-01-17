import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import CorretorDashboard from '@/components/dashboard/CorretorDashboard';
import { AuthLoadingScreen } from '@/components/ui/loading-states';

const Index = () => {
  const { user, profile, loading, isAdmin, isCorretor } = useAuth();

  // Show loading spinner while checking auth
  if (loading) {
    return <AuthLoadingScreen />;
  }

  // Redirect to auth if not logged in
  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <DashboardLayout>
      {isAdmin && <AdminDashboard />}
      {isCorretor && <CorretorDashboard />}
      {!isAdmin && !isCorretor && (
        <div className="p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Bem-vindo ao MeMude Connect</h1>
          <p className="text-muted-foreground">
            Sua conta está sendo configurada. Entre em contato com o administrador.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Index;

import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import CorretorDashboard from '@/components/dashboard/CorretorDashboard';
import { AuthLoadingScreen } from '@/components/ui/loading-states';
import { useConfigComercial } from '@/hooks/comercial/dados';

const Index = ({ semRedirecionar = false }: { semRedirecionar?: boolean }) => {
  const { user, profile, loading, isAdmin, isCorretor, isComercial } = useAuth();
  const { data: cfg, isLoading: carregandoCfg } = useConfigComercial(isComercial && !semRedirecionar);

  if (loading || (isComercial && !semRedirecionar && carregandoCfg)) {
    return <AuthLoadingScreen />;
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  // Corretor abre direto no app (conversas, cliente novo, agenda); o portal antigo segue em /dashboard
  if (!semRedirecionar && isCorretor && !isComercial) {
    return <Navigate to="/app" replace />;
  }

  // A tela Hoje é a primeira tela de quem opera Leads e Visitas (SDR, closer e responsáveis configurados).
  const operaComercial = profile.role === 'sdr' || profile.role === 'closer'
    || cfg?.closer_user_id === user.id || (cfg?.responsaveis ?? []).includes(user.id);
  if (!semRedirecionar && operaComercial) {
    return <Navigate to="/hoje" replace />;
  }

  return (
    <DashboardLayout>
      {(isAdmin || isComercial) && <AdminDashboard />}
      {isCorretor && <CorretorDashboard />}
      {!isAdmin && !isComercial && !isCorretor && (
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

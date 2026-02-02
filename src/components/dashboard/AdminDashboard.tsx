import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import StatsCard from './StatsCard';
import VisitsChart from './VisitsChart';
import LeadModal from '@/components/modals/LeadModal';
import CorretorModal from '@/components/modals/CorretorModal';
import EmpreendimentoModal from '@/components/modals/EmpreendimentoModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Users,
  UserCheck,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Building2,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  totalLeads: number;
  leadsHoje: number;
  totalCorretores: number;
  corretoresAtivos: number;
  visitasHoje: number;
  visitasSemana: number;
  taxaConversao: number;
}



const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    leadsHoje: 0,
    totalCorretores: 0,
    corretoresAtivos: 0,
    visitasHoje: 0,
    visitasSemana: 0,
    taxaConversao: 0,
  });

  const [loading, setLoading] = useState(true);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isCorretorModalOpen, setIsCorretorModalOpen] = useState(false);
  const [isEmpreendimentoModalOpen, setIsEmpreendimentoModalOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch leads stats
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [
        totalLeadsResult,
        leadsHojeResult,
        totalCorretoresResult,
        corretoresAtivosResult,
        visitasHojeResult,
        visitasSemanaResult,
      ] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact' }),
        supabase.from('leads').select('*', { count: 'exact' }).gte('created_at', today),
        supabase.from('corretores').select('*', { count: 'exact' }),
        supabase.from('corretores').select('*', { count: 'exact' }).eq('status', 'ativo'),
        supabase.from('visitas').select('*', { count: 'exact' }).eq('data_visita', today),
        supabase.from('visitas').select('*', { count: 'exact' }).gte('data_visita', weekAgo),
      ]);

      // Calculate conversion rate
      const visitasRealizadas = await supabase
        .from('visitas')
        .select('*', { count: 'exact' })
        .eq('status', 'realizada');

      const taxaConversao = totalLeadsResult.count && visitasRealizadas.count
        ? Math.round((visitasRealizadas.count / totalLeadsResult.count) * 100)
        : 0;

      setStats({
        totalLeads: totalLeadsResult.count || 0,
        leadsHoje: leadsHojeResult.count || 0,
        totalCorretores: totalCorretoresResult.count || 0,
        corretoresAtivos: corretoresAtivosResult.count || 0,
        visitasHoje: visitasHojeResult.count || 0,
        visitasSemana: visitasSemanaResult.count || 0,
        taxaConversao,
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados do dashboard.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Dashboard Administrativo
        </h1>
        <p className="text-muted-foreground">
          Visão geral da operação MeMude Connect
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total de Leads"
          value={stats.totalLeads}
          icon={Users}
          description="Leads cadastrados"
          trend={{
            value: stats.leadsHoje,
            isPositive: stats.leadsHoje > 0
          }}
        />

        <StatsCard
          title="Corretores Ativos"
          value={`${stats.corretoresAtivos}/${stats.totalCorretores}`}
          icon={UserCheck}
          description="Corretores disponíveis"
        />

        <StatsCard
          title="Visitas Hoje"
          value={stats.visitasHoje}
          icon={Calendar}
          description="Agendadas para hoje"
        />

        <StatsCard
          title="Taxa de Conversão"
          value={`${stats.taxaConversao}%`}
          icon={TrendingUp}
          description="Leads → Visitas"
          trend={{
            value: stats.taxaConversao,
            isPositive: stats.taxaConversao > 50
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visits Chart */}
        <VisitsChart />

        {/* Quick Actions */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" />
              Ações Rápidas
            </CardTitle>
            <CardDescription>
              Acesso rápido às principais funcionalidades
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full justify-start hover-scale transition-all duration-200"
                    variant="outline"
                    onClick={() => setIsLeadModalOpen(true)}
                    disabled={isLeadModalOpen}
                  >
                    {isLeadModalOpen ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Users className="mr-2 h-4 w-4" />
                    )}
                    Adicionar Lead Manualmente
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cadastrar um novo lead diretamente no sistema</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full justify-start hover-scale transition-all duration-200"
                    variant="outline"
                    onClick={() => setIsCorretorModalOpen(true)}
                    disabled={isCorretorModalOpen}
                  >
                    {isCorretorModalOpen ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserCheck className="mr-2 h-4 w-4" />
                    )}
                    Cadastrar Novo Corretor
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Adicionar um novo corretor ao sistema</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full justify-start hover-scale transition-all duration-200"
                    variant="outline"
                    onClick={() => setIsEmpreendimentoModalOpen(true)}
                    disabled={isEmpreendimentoModalOpen}
                  >
                    {isEmpreendimentoModalOpen ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Building2 className="mr-2 h-4 w-4" />
                    )}
                    Adicionar Empreendimento
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cadastrar um novo empreendimento</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full justify-start hover-scale transition-all duration-200"
                    variant="outline"
                    onClick={() => navigate('/admin/corretores?filter=pendentes')}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Aprovar Corretores Pendentes
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ver corretores aguardando aprovação</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Métricas da Semana</CardTitle>
          <CardDescription>
            Performance dos últimos 7 dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.leadsHoje}</div>
              <div className="text-sm text-muted-foreground">Leads Hoje</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">{stats.visitasSemana}</div>
              <div className="text-sm text-muted-foreground">Visitas esta Semana</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{stats.corretoresAtivos}</div>
              <div className="text-sm text-muted-foreground">Corretores Ativos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <LeadModal
        open={isLeadModalOpen}
        onOpenChange={setIsLeadModalOpen}
        title="Adicionar Lead Manualmente"
      />

      <CorretorModal
        open={isCorretorModalOpen}
        onOpenChange={setIsCorretorModalOpen}
        title="Cadastrar Novo Corretor"
      />

      <EmpreendimentoModal
        open={isEmpreendimentoModalOpen}
        onOpenChange={setIsEmpreendimentoModalOpen}
        title="Adicionar Empreendimento"
      />
    </div>
  );
};

export default AdminDashboard;
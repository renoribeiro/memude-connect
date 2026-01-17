import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import StatsCard from './StatsCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Calendar, 
  Star, 
  TrendingUp, 
  Clock,
  MapPin,
  Phone
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseLocalDate } from '@/utils/dateHelpers';

interface CorretorStats {
  totalLeads: number;
  leadsAtivos: number;
  visitasAgendadas: number;
  visitasRealizadas: number;
  notaMedia: number;
  totalVisitas: number;
}

interface VisitaProxima {
  id: string;
  data_visita: string;
  horario_visita: string;
  leads: {
    nome: string;
    telefone: string;
  };
  empreendimentos: {
    nome: string;
    endereco?: string;
  };
}

const CorretorDashboard = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<CorretorStats>({
    totalLeads: 0,
    leadsAtivos: 0,
    visitasAgendadas: 0,
    visitasRealizadas: 0,
    notaMedia: 0,
    totalVisitas: 0,
  });
  const [proximasVisitas, setProximasVisitas] = useState<VisitaProxima[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (profile) {
      fetchCorretorData();
    }
  }, [profile]);

  const fetchCorretorData = async () => {
    try {
      // First get corretor info
      const { data: corretor } = await supabase
        .from('corretores')
        .select('*')
        .eq('profile_id', profile!.id)
        .single();

      if (!corretor) {
        toast({
          title: "Perfil não encontrado",
          description: "Seu perfil de corretor não foi encontrado. Entre em contato com o administrador.",
          variant: "destructive",
        });
        return;
      }

      // Get leads assigned to this corretor
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('corretor_designado_id', corretor.id);

      // Get visitas for this corretor
      const { data: visitas } = await supabase
        .from('visitas')
        .select(`
          *,
          leads (nome, telefone),
          empreendimentos (nome, endereco)
        `)
        .eq('corretor_id', corretor.id)
        .order('data_visita', { ascending: true });

      // Get upcoming visitas
      const today = new Date().toISOString().split('T')[0];
      const proximasVisitas = visitas?.filter(v => 
        v.data_visita >= today && ['agendada', 'confirmada'].includes(v.status)
      ).slice(0, 5) || [];

      // Calculate stats
      const leadsAtivos = leads?.filter(l => 
        !['cancelado', 'visita_realizada'].includes(l.status)
      ).length || 0;

      const visitasAgendadas = visitas?.filter(v => 
        ['agendada', 'confirmada'].includes(v.status)
      ).length || 0;

      const visitasRealizadas = visitas?.filter(v => 
        v.status === 'realizada'
      ).length || 0;

      setStats({
        totalLeads: leads?.length || 0,
        leadsAtivos,
        visitasAgendadas,
        visitasRealizadas,
        notaMedia: corretor.nota_media || 0,
        totalVisitas: corretor.total_visitas || 0,
      });

      setProximasVisitas(proximasVisitas);
    } catch (error) {
      console.error('Error fetching corretor data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar seus dados.",
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Bem-vindo, {profile?.first_name}!
        </h1>
        <p className="text-muted-foreground">
          Aqui está um resumo da sua performance e próximas atividades
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Meus Leads"
          value={stats.totalLeads}
          icon={Users}
          description={`${stats.leadsAtivos} ativos`}
        />
        
        <StatsCard
          title="Visitas Agendadas"
          value={stats.visitasAgendadas}
          icon={Calendar}
          description="Próximas visitas"
        />

        <StatsCard
          title="Minha Nota"
          value={stats.notaMedia.toFixed(1)}
          icon={Star}
          description="Avaliação média"
          trend={{
            value: stats.notaMedia * 20, // Convert to percentage
            isPositive: stats.notaMedia >= 4.0
          }}
        />

        <StatsCard
          title="Total de Visitas"
          value={stats.totalVisitas}
          icon={TrendingUp}
          description={`${stats.visitasRealizadas} realizadas`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximas Visitas */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="mr-2 h-5 w-5" />
              Próximas Visitas
            </CardTitle>
            <CardDescription>
              Suas visitas agendadas para os próximos dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {proximasVisitas.length > 0 ? (
                proximasVisitas.map((visita) => (
                  <div
                    key={visita.id}
                    className="flex items-center justify-between p-4 bg-white/50 rounded-lg border border-white/20"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="outline" className="bg-primary/10">
                          {parseLocalDate(visita.data_visita).toLocaleDateString('pt-BR')} às {visita.horario_visita}
                        </Badge>
                      </div>
                      
                      <h4 className="font-medium text-sm flex items-center">
                        <Users className="mr-1 h-3 w-3" />
                        {visita.leads?.nome}
                      </h4>
                      
                      <p className="text-xs text-muted-foreground flex items-center mt-1">
                        <Phone className="mr-1 h-3 w-3" />
                        {visita.leads?.telefone}
                      </p>
                      
                      <p className="text-xs text-primary font-medium flex items-center mt-1">
                        <MapPin className="mr-1 h-3 w-3" />
                        {visita.empreendimentos?.nome}
                      </p>
                      
                      {visita.empreendimentos?.endereco && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {visita.empreendimentos.endereco}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="mx-auto h-12 w-12 mb-2 opacity-50" />
                  <p>Nenhuma visita agendada</p>
                  <p className="text-sm">Aguarde novos leads serem direcionados para você</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="mr-2 h-5 w-5" />
              Minha Performance
            </CardTitle>
            <CardDescription>
              Estatísticas do seu desempenho
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">
                {stats.notaMedia.toFixed(1)}
              </div>
              <div className="flex justify-center mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= Math.round(stats.notaMedia)
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Avaliação dos clientes</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-secondary">{stats.visitasRealizadas}</div>
                <div className="text-sm text-muted-foreground">Visitas Realizadas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-success">{stats.leadsAtivos}</div>
                <div className="text-sm text-muted-foreground">Leads Ativos</div>
              </div>
            </div>

            <Button className="w-full" variant="outline">
              Ver Histórico Completo
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CorretorDashboard;
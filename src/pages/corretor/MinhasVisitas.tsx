import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Search, Filter, Calendar, Clock, MapPin, User, Star, MessageSquare, CheckCircle } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { isToday, isTomorrow, isPast, parseLocalDate } from "@/utils/dateHelpers";
import { VisitaActions } from "@/components/actions/VisitaActions";

interface Visita {
  id: string;
  data_visita: string;
  horario_visita: string;
  status: string;
  avaliacao_lead?: number;
  comentarios_lead?: string;
  feedback_corretor?: string;
  created_at: string;
  leads: {
    nome: string;
    telefone: string;
  };
  empreendimentos?: {
    nome: string;
  };
}

const statusVariants = {
  'agendada': 'secondary',
  'confirmada': 'outline',
  'realizada': 'success',
  'cancelada': 'destructive',
  'reagendada': 'default'
} as const;

const statusLabels = {
  'agendada': 'Agendada',
  'confirmada': 'Confirmada',
  'realizada': 'Realizada',
  'cancelada': 'Cancelada',
  'reagendada': 'Reagendada'
};

export default function MinhasVisitas() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: corretor } = useQuery({
    queryKey: ['my-corretor-profile'],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      const { data, error } = await supabase
        .from('corretores')
        .select('id')
        .eq('profile_id', profile.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id
  });

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ['my-visitas', searchTerm, filterStatus, corretor?.id],
    queryFn: async () => {
      if (!corretor?.id) return [];
      
      let query = supabase
        .from('visitas')
        .select(`
          *,
          leads(nome, telefone),
          empreendimentos(nome)
        `)
        .eq('corretor_id', corretor.id)
        .is('deleted_at', null)
        .order('data_visita', { ascending: true });

      if (searchTerm) {
        query = query.or(`leads.nome.ilike.%${searchTerm}%,leads.telefone.ilike.%${searchTerm}%`);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Visita[];
    },
    enabled: !!corretor?.id
  });

  const getRatingStars = (rating: number, interactive = false) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star 
          key={i} 
          className={`w-4 h-4 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'} ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`} 
        />
      );
    }
    return stars;
  };

  const getVisitaStatus = (visita: Visita) => {
    const visitaDateTime = new Date(`${visita.data_visita}T${visita.horario_visita}`);
    
    if (isPast(visitaDateTime) && visita.status !== 'realizada' && visita.status !== 'cancelada') {
      return 'atrasada';
    }
    return visita.status;
  };

  const getVisitaPriority = (visita: Visita) => {
    if (isToday(visita.data_visita)) return 'hoje';
    if (isTomorrow(visita.data_visita)) return 'amanha';
    return null;
  };

  if (!profile || !corretor) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Minhas Visitas</h1>
            <p className="text-muted-foreground">
              Acompanhe sua agenda de visitas
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Visitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{visitas.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {visitas.filter(v => isToday(v.data_visita)).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Amanhã
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {visitas.filter(v => isTomorrow(v.data_visita)).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Realizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {visitas.filter(v => v.status === 'realizada').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar visitas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  <option value="all">Todos os Status</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <Button variant="outline" size="icon">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visitas List */}
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Minhas Visitas Agendadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {visitas.map((visita) => {
                  const visitaStatus = getVisitaStatus(visita);
                  const priority = getVisitaPriority(visita);
                  
                  return (
                    <div
                      key={visita.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{visita.leads.nome}</h3>
                          <Badge variant={statusVariants[visitaStatus as keyof typeof statusVariants] || 'default'}>
                            {statusLabels[visitaStatus as keyof typeof statusLabels] || visitaStatus}
                          </Badge>
                          {priority === 'hoje' && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              Hoje
                            </Badge>
                          )}
                          {priority === 'amanha' && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              Amanhã
                            </Badge>
                          )}
                          {visitaStatus === 'atrasada' && (
                            <Badge variant="destructive">
                              Atrasada
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(parseLocalDate(visita.data_visita), 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {visita.horario_visita}
                          </div>
                          {visita.empreendimentos && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {visita.empreendimentos.nome}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {visita.leads.telefone}
                          </div>
                        </div>
                        
                        {visita.avaliacao_lead && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Avaliação do Lead:</span>
                            <div className="flex items-center gap-1">
                              {getRatingStars(visita.avaliacao_lead)}
                              <span className="text-sm text-muted-foreground ml-1">
                                ({visita.avaliacao_lead}/5)
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {visita.comentarios_lead && (
                          <div className="text-sm text-muted-foreground">
                            <strong>Comentário do Lead:</strong> {visita.comentarios_lead}
                          </div>
                        )}
                        
                        {visita.feedback_corretor && (
                          <div className="text-sm text-muted-foreground">
                            <strong>Meu Feedback:</strong> {visita.feedback_corretor}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {visita.status === 'agendada' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-green-600 border-green-600 hover:bg-green-50"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Confirmar
                          </Button>
                        )}
                        {visita.status === 'confirmada' && !isPast(new Date(`${visita.data_visita}T${visita.horario_visita}`)) && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-blue-600 border-blue-600 hover:bg-blue-50"
                          >
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Lembrar Cliente
                          </Button>
                        )}
                        <VisitaActions 
                          visitaId={visita.id}
                          status={visitaStatus}
                          leadId={String(visita.leads)}
                          onEdit={() => {
                            // Broker can't edit, only view
                            console.log('View visita details:', visita.id);
                          }}
                          onView={() => {
                            console.log('View visita details:', visita.id);
                          }}
                          isCorretor={true}
                        />
                      </div>
                    </div>
                  );
                })}
                {visitas.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma visita agendada encontrada.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
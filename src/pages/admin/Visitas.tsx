import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Calendar, Clock, MapPin, Star, CalendarDays, Filter, User, Phone, Trash2, Users } from "lucide-react";
import { VisitaModal } from "@/components/modals/VisitaModal";
import { VisitaActions } from "@/components/actions/VisitaActions";
import VisitasCalendar from "@/components/calendar/VisitasCalendar";
import { DistributionDashboard } from "@/components/automation/DistributionDashboard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate, isSameLocalDay } from "@/utils/dateHelpers";

interface Visita {
  id: string;
  data_visita: string;
  horario_visita: string;
  status: string;
  avaliacao_lead?: number;
  comentarios_lead?: string;
  feedback_corretor?: string;
  created_at: string;
  deleted_at?: string | null;
  leads: {
    nome: string;
    telefone: string;
  };
  corretores?: {
    profiles: {
      first_name: string;
      last_name: string;
    };
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

export default function Visitas() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedVisitaId, setSelectedVisitaId] = useState<string | undefined>();

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ['visitas', searchTerm, filterStatus, viewMode],
    queryFn: async () => {
      let query = supabase
        .from('visitas')
        .select(`
          *,
          leads(nome, telefone),
          corretores(
            profiles(first_name, last_name)
          ),
          empreendimentos(nome)
        `)
        .order('data_visita', { ascending: true });

      // Filter by view mode (active or trash)
      if (viewMode === 'active') {
        query = query.is('deleted_at', null);
      } else {
        query = query.not('deleted_at', 'is', null);
      }

      if (searchTerm) {
        query = query.or(`leads.nome.ilike.%${searchTerm}%,leads.telefone.ilike.%${searchTerm}%`);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Visita[];
    }
  });

  const getRatingStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star 
          key={i} 
          className={`w-3 h-3 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} 
        />
      );
    }
    return stars;
  };

  const isToday = (date: string) => {
    return isSameLocalDay(date, new Date());
  };

  const isTomorrow = (date: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return isSameLocalDay(date, tomorrow);
  };

  if (!profile) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciamento de Visitas</h1>
            <p className="text-muted-foreground">
              Agende e acompanhe todas as visitas do sistema
            </p>
          </div>
          <Button 
            className="flex items-center gap-2 hover-scale transition-all duration-200"
            onClick={() => {
              setSelectedVisitaId(undefined);
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Nova Visita
          </Button>
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

        {/* View Mode Toggle */}
        <Card className="hover-scale transition-all duration-200 animate-fade-in">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'active' ? 'default' : 'outline'}
                  onClick={() => setViewMode('active')}
                  className="flex items-center gap-2"
                >
                  <CalendarDays className="w-4 h-4" />
                  Visitas Ativas
                </Button>
                <Button
                  variant={viewMode === 'trash' ? 'default' : 'outline'}
                  onClick={() => setViewMode('trash')}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Lixeira
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar visitas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 transition-all duration-200 focus:ring-2"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background transition-all duration-200 hover:border-primary/50"
                >
                  <option value="all">Todos os Status</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <Button variant="outline" size="icon" className="hover-scale transition-all duration-200">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for List, Calendar and Distribution */}
        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Lista de Visitas
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Calendário
            </TabsTrigger>
            <TabsTrigger value="distribution" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Distribuição
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="list" className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <Card className="hover-scale transition-all duration-200 animate-fade-in">
                <CardHeader>
                  <CardTitle>
                    {viewMode === 'active' ? 'Visitas Agendadas' : 'Visitas na Lixeira'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {visitas.map((visita, index) => (
                      <div
                        key={visita.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-all duration-200 animate-fade-in hover-scale"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold">{visita.leads.nome}</h3>
                            <Badge variant={statusVariants[visita.status as keyof typeof statusVariants] || 'default'}>
                              {statusLabels[visita.status as keyof typeof statusLabels] || visita.status}
                            </Badge>
                            {visita.deleted_at && (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <Trash2 className="w-3 h-3" />
                                Na Lixeira
                              </Badge>
                            )}
                            {!visita.deleted_at && isToday(visita.data_visita) && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Hoje
                              </Badge>
                            )}
                            {!visita.deleted_at && isTomorrow(visita.data_visita) && (
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                Amanhã
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
                            {visita.corretores && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {visita.corretores.profiles.first_name} {visita.corretores.profiles.last_name}
                              </div>
                            )}
                          </div>
                          {visita.avaliacao_lead && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Avaliação:</span>
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
                              <strong>Feedback do Corretor:</strong> {visita.feedback_corretor}
                            </div>
                          )}
                        </div>
                        <VisitaActions 
                          visitaId={visita.id}
                          status={visita.status}
                          leadId={visita.leads ? String(visita.leads) : ''}
                          deletedAt={visita.deleted_at}
                          onEdit={() => {
                            setSelectedVisitaId(visita.id);
                            setIsModalOpen(true);
                          }}
                          onView={() => {
                            setSelectedVisitaId(visita.id);
                            setIsViewModalOpen(true);
                          }}
                        />
                      </div>
                    ))}
                    {visitas.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        {viewMode === 'active' 
                          ? 'Nenhuma visita ativa encontrada' 
                          : 'Nenhuma visita na lixeira'}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="calendar">
            <VisitasCalendar />
          </TabsContent>

          <TabsContent value="distribution">
            <DistributionDashboard />
          </TabsContent>
        </Tabs>

        {/* Visita Modal */}
        <VisitaModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedVisitaId(undefined);
          }}
          visitaId={selectedVisitaId}
        />

        {/* Modal de Visualização de Detalhes */}
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes da Visita</DialogTitle>
            </DialogHeader>
            {selectedVisitaId && <VisitaDetails visitaId={selectedVisitaId} />}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// Componente para mostrar detalhes da visita
function VisitaDetails({ visitaId }: { visitaId: string }) {
  const { data: visita, isLoading } = useQuery({
    queryKey: ['visita-details', visitaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitas')
        .select(`
          *,
          leads(nome, telefone, email),
          corretores(profiles(first_name, last_name), telefone),
          empreendimentos(nome, endereco)
        `)
        .eq('id', visitaId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="p-4">Carregando...</div>;
  if (!visita) return <div className="p-4">Visita não encontrada</div>;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendada': return 'bg-blue-100 text-blue-800';
      case 'confirmada': return 'bg-green-100 text-green-800';
      case 'realizada': return 'bg-purple-100 text-purple-800';
      case 'cancelada': return 'bg-red-100 text-red-800';
      case 'reagendada': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Status</Label>
          <Badge className={`mt-1 ${getStatusColor(visita.status)}`}>
            {visita.status}
          </Badge>
        </div>
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Data e Horário</Label>
          <div className="flex items-center gap-2 mt-1">
            <Calendar className="h-4 w-4" />
            <span>{format(parseLocalDate(visita.data_visita), "dd/MM/yyyy", { locale: ptBR })}</span>
            <Clock className="h-4 w-4 ml-2" />
            <span>{visita.horario_visita}</span>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-muted-foreground">Lead</Label>
        <div className="mt-1 p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4" />
            <span className="font-medium">{visita.leads?.nome}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <span>{visita.leads?.telefone}</span>
            </div>
            {visita.leads?.email && (
              <div className="flex items-center gap-1">
                <span>📧</span>
                <span>{visita.leads?.email}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-muted-foreground">Corretor</Label>
        <div className="mt-1 p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4" />
            <span className="font-medium">
              {visita.corretores?.profiles?.first_name} {visita.corretores?.profiles?.last_name}
            </span>
          </div>
          {visita.corretores?.telefone && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{visita.corretores?.telefone}</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-muted-foreground">Empreendimento</Label>
        <div className="mt-1 p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4" />
            <span className="font-medium">{visita.empreendimentos?.nome}</span>
          </div>
          {visita.empreendimentos?.endereco && (
            <p className="text-sm text-muted-foreground">{visita.empreendimentos?.endereco}</p>
          )}
        </div>
      </div>

      {visita.feedback_corretor && (
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Feedback do Corretor</Label>
          <p className="mt-1 p-3 bg-muted rounded-lg text-sm">{visita.feedback_corretor}</p>
        </div>
      )}

      {visita.comentarios_lead && (
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Comentários do Lead</Label>
          <p className="mt-1 p-3 bg-muted rounded-lg text-sm">{visita.comentarios_lead}</p>
        </div>
      )}

      {visita.avaliacao_lead && (
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Avaliação do Lead</Label>
          <div className="mt-1 flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <span key={i} className={`text-lg ${i < visita.avaliacao_lead ? 'text-yellow-400' : 'text-gray-300'}`}>
                ⭐
              </span>
            ))}
            <span className="ml-2 text-sm text-muted-foreground">({visita.avaliacao_lead}/5)</span>
          </div>
        </div>
      )}
    </div>
  );
}
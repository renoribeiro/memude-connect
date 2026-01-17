import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Phone, Mail, Calendar, MapPin, MessageSquare, Star } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lead {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  status: string;
  origem: string;
  data_visita_solicitada: string;
  horario_visita_solicitada: string;
  created_at: string;
  observacoes?: string;
  empreendimentos?: {
    nome: string;
  };
}

const statusVariants = {
  'novo': 'default',
  'buscando_corretor': 'secondary',
  'visita_agendada': 'outline',
  'visita_realizada': 'success',
  'cancelado': 'destructive',
  'follow_up': 'outline'
} as const;

const statusLabels = {
  'novo': 'Novo',
  'buscando_corretor': 'Em Contato',
  'visita_agendada': 'Agendado',
  'visita_realizada': 'Visitou',
  'cancelado': 'Perdido',
  'follow_up': 'Follow-up'
};

export default function MeusLeads() {
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

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['my-leads', searchTerm, filterStatus, corretor?.id],
    queryFn: async () => {
      if (!corretor?.id) return [];
      
      let query = supabase
        .from('leads')
        .select(`
          *,
          empreendimentos(nome)
        `)
        .eq('corretor_designado_id', corretor.id)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!corretor?.id
  });

  if (!profile || !corretor) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Meus Leads</h1>
            <p className="text-muted-foreground">
              Gerencie seus leads designados
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leads.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Novos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leads.filter(lead => lead.status === 'novo').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Em Contato
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leads.filter(lead => lead.status === 'buscando_corretor').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Convertidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leads.filter(lead => lead.status === 'visita_realizada').length}
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
                  placeholder="Buscar leads..."
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

        {/* Leads List */}
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Meus Leads Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{lead.nome}</h3>
                        <Badge variant={statusVariants[lead.status as keyof typeof statusVariants] || 'default'}>
                          {statusLabels[lead.status as keyof typeof statusLabels] || lead.status}
                        </Badge>
                        {lead.status === 'novo' && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            Urgente
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {lead.telefone}
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {lead.email}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Visita: {format(new Date(lead.data_visita_solicitada), 'dd/MM/yyyy', { locale: ptBR })} às {lead.horario_visita_solicitada}
                        </div>
                        {lead.empreendimentos && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {lead.empreendimentos.nome}
                          </div>
                        )}
                      </div>
                      {lead.observacoes && (
                        <div className="text-sm text-muted-foreground">
                          <strong>Observações:</strong> {lead.observacoes}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Lead recebido em {format(new Date(lead.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 text-green-600 border-green-600 hover:bg-green-50"
                      >
                        <Phone className="w-3 h-3" />
                        Ligar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-2 text-blue-600 border-blue-600 hover:bg-blue-50"
                      >
                        <MessageSquare className="w-3 h-3" />
                        WhatsApp
                      </Button>
                      <Button variant="outline" size="sm">
                        Detalhes
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Star className="w-3 h-3" />
                        Avaliar
                      </Button>
                    </div>
                  </div>
                ))}
                {leads.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum lead encontrado. Aguarde a designação de novos leads.
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
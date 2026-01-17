import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, Phone, Mail, Calendar, MapPin, Eye, Edit, Trash2, RotateCcw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import LeadModal from "@/components/modals/LeadModal";
import LeadStatusActions from "@/components/actions/LeadStatusActions";
import LeadActions from "@/components/actions/LeadActions";

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
  deleted_at?: string | null;
  empreendimento_id?: string;
  corretor_designado_id?: string;
  observacoes?: string;
  empreendimentos?: {
    nome: string;
  };
  corretores?: {
    profiles: {
      first_name: string;
      last_name: string;
    };
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

export default function Leads() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', searchTerm, filterStatus, viewMode],
    queryFn: async () => {
      try {
        // TENTATIVA 1: Query com filtro de Lixeira (Padrão)
        let query = supabase
          .from('leads')
          .select(`
            *,
            empreendimentos(nome),
            corretores(
              profiles(first_name, last_name)
            )
          `)
          .order('created_at', { ascending: false });

        if (searchTerm) {
          query = query.or(`nome.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }

        if (filterStatus !== 'all') {
          query = query.eq('status', filterStatus as any);
        }

        // Tentar aplicar filtro de soft delete
        let queryWithFilter = query;
        if (viewMode === 'active') {
          queryWithFilter = query.is('deleted_at', null);
        } else {
          queryWithFilter = query.not('deleted_at', 'is', null);
        }

        const { data, error } = await queryWithFilter;
        
        if (error) {
          // Se o erro for de coluna inexistente (PGRST204 ou similar), tentar sem o filtro
          console.warn("Erro ao filtrar por deleted_at, tentando query sem filtro de lixeira:", error.message);
          throw error; // Lançar para o catch
        }
        
        return data as Lead[];

      } catch (err: any) {
        // TENTATIVA 2: Fallback (Modo de Compatibilidade - Banco Desatualizado)
        // Se falhar (ex: coluna deleted_at não existe), carrega tudo sem filtrar lixeira
        if (err.message?.includes('deleted_at') || err.code === 'PGRST204' || err.code === '42703') {
          console.log("Ativando modo de compatibilidade (sem lixeira)...");
          
          let fallbackQuery = supabase
            .from('leads')
            .select(`
              *,
              empreendimentos(nome),
              corretores(
                profiles(first_name, last_name)
              )
            `)
            .order('created_at', { ascending: false });

          if (searchTerm) {
            fallbackQuery = fallbackQuery.or(`nome.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
          }

          if (filterStatus !== 'all') {
            fallbackQuery = fallbackQuery.eq('status', filterStatus as any);
          }

          const { data: fallbackData, error: fallbackError } = await fallbackQuery;
          
          if (fallbackError) throw fallbackError;
          return fallbackData as Lead[];
        }
        
        throw err;
      }
    }
  });

  if (!profile) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciamento de Leads</h1>
            <p className="text-muted-foreground">
              Gerencie e acompanhe todos os leads do sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant={viewMode === 'trash' ? 'default' : 'outline'}
              onClick={() => setViewMode(viewMode === 'active' ? 'trash' : 'active')}
            >
              {viewMode === 'active' ? (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Ver Lixeira
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Ver Ativos
                </>
              )}
            </Button>
            {viewMode === 'active' && (
              <Button className="flex items-center gap-2" onClick={() => {
                setSelectedLead(null);
                setShowLeadModal(true);
              }}>
                <Plus className="w-4 h-4" />
                Novo Lead
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards - Só mostrar no modo ativo */}
        {viewMode === 'active' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
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
                  Novos Hoje
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {leads.filter(lead => 
                    new Date(lead.created_at).toDateString() === new Date().toDateString()
                  ).length}
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
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={viewMode === 'active' ? "Buscar leads ativos..." : "Buscar leads na lixeira..."}
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
          <Card className={viewMode === 'trash' ? "border-red-200 bg-red-50/10" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {viewMode === 'active' ? (
                  "Leads Recentes"
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 text-destructive" />
                    Lixeira de Leads
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors bg-white/50"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{lead.nome}</h3>
                        <Badge variant={statusVariants[lead.status as keyof typeof statusVariants] || 'default'}>
                          {statusLabels[lead.status as keyof typeof statusLabels] || lead.status}
                        </Badge>
                        {lead.deleted_at && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <Trash2 className="w-3 h-3" />
                            Excluído
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
                          {format(new Date(lead.data_visita_solicitada), 'dd/MM/yyyy', { locale: ptBR })} às {lead.horario_visita_solicitada}
                        </div>
                        {lead.empreendimentos && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {lead.empreendimentos.nome}
                          </div>
                        )}
                      </div>
                        {lead.corretores && (
                        <div className="text-sm text-muted-foreground">
                          Corretor: {lead.corretores.profiles.first_name} {lead.corretores.profiles.last_name}
                        </div>
                        )}
                      {lead.deleted_at && (
                        <div className="text-xs text-destructive mt-1">
                          Excluído em: {format(new Date(lead.deleted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Ações específicas da Lixeira ou Ativos */}
                      {viewMode === 'active' && (
                        <>
                          <LeadStatusActions lead={lead} />
                          <Button variant="ghost" size="sm" onClick={() => {
                            setSelectedLead(lead);
                            setShowLeadModal(true);
                          }}>
                            <Eye className="w-4 h-4 text-gray-500" />
                            <span className="sr-only">Visualizar</span>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            setSelectedLead(lead);
                            setShowLeadModal(true);
                          }}>
                            <Edit className="w-4 h-4 text-blue-500" />
                            <span className="sr-only">Editar</span>
                          </Button>
                        </>
                      )}
                      
                      {/* Botão de Excluir/Restaurar (LeadActions lida com ambos os estados) */}
                      <LeadActions lead={lead} />
                    </div>
                  </div>
                ))}
                {leads.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="flex justify-center mb-4">
                      {viewMode === 'active' ? (
                        <Search className="h-12 w-12 opacity-20" />
                      ) : (
                        <Trash2 className="h-12 w-12 opacity-20" />
                      )}
                    </div>
                    <p className="text-lg font-medium">
                      {viewMode === 'active' ? 'Nenhum lead encontrado' : 'A lixeira está vazia'}
                    </p>
                    {searchTerm && (
                      <p className="text-sm">Tente ajustar seus termos de busca</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <LeadModal
        open={showLeadModal}
        onOpenChange={setShowLeadModal}
        initialData={selectedLead}
        title={selectedLead ? "Editar Lead" : "Novo Lead"}
      />
    </DashboardLayout>
  );
}
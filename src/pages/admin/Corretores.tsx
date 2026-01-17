import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, User, Star, Calendar, Edit, Eye, Phone, Upload, Download, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CorretorModal from "@/components/modals/CorretorModal";
import CorretorActions from "@/components/actions/CorretorActions";
import ImportExportModal from "@/components/modals/ImportExportModal";

interface Corretor {
  id: string;
  creci: string;
  whatsapp: string;
  email?: string;
  cpf?: string;
  status: string;
  nota_media: number;
  total_visitas: number;
  observacoes?: string;
  created_at: string;
  data_avaliacao?: string;
  deleted_at?: string | null;
  profiles: {
    first_name: string;
    last_name: string;
  };
}

const statusVariants = {
  'em_avaliacao': 'secondary',
  'ativo': 'success',
  'inativo': 'destructive',
  'bloqueado': 'outline'
} as const;

const statusLabels = {
  'em_avaliacao': 'Em Avaliação',
  'ativo': 'Aprovado',
  'inativo': 'Reprovado',
  'bloqueado': 'Suspenso'
};

export default function Corretores() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
  const [showCorretorModal, setShowCorretorModal] = useState(false);
  const [selectedCorretor, setSelectedCorretor] = useState<any>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const { data: corretores = [], isLoading } = useQuery({
    queryKey: ['corretores', searchTerm, filterStatus, viewMode],
    queryFn: async () => {
      let query = supabase
        .from('corretores')
        .select(`
          *,
          profiles(first_name, last_name),
          corretor_bairros(bairro_id),
          corretor_construtoras(construtora_id)
        `)
        .order('created_at', { ascending: false });

      // Filtrar por modo de visualização (ativos ou lixeira)
      if (viewMode === 'active') {
        query = query.is('deleted_at', null);
      } else {
        query = query.not('deleted_at', 'is', null);
      }

      if (searchTerm) {
        query = query.or(`creci.ilike.%${searchTerm}%,whatsapp.ilike.%${searchTerm}%,profiles.first_name.ilike.%${searchTerm}%,profiles.last_name.ilike.%${searchTerm}%`);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Corretor[];
    }
  });

  const getRatingStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Star key={i} className="w-3 h-3 fill-yellow-400/50 text-yellow-400" />);
      } else {
        stars.push(<Star key={i} className="w-3 h-3 text-muted-foreground" />);
      }
    }
    return stars;
  };

  if (!profile) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciamento de Corretores</h1>
            <p className="text-muted-foreground">
              Gerencie corretores, aprovar cadastros e acompanhar performance
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant={viewMode === 'trash' ? 'default' : 'outline'}
              onClick={() => setViewMode(viewMode === 'active' ? 'trash' : 'active')}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {viewMode === 'active' ? 'Ver Lixeira' : 'Ver Ativos'}
            </Button>
            {viewMode === 'active' && (
              <>
                <Button variant="outline" onClick={() => setShowImportModal(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar
                </Button>
                <Button variant="outline" onClick={() => setShowExportModal(true)}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
                <Button className="flex items-center gap-2" onClick={() => {
                  setSelectedCorretor(null);
                  setShowCorretorModal(true);
                }}>
                  <Plus className="w-4 h-4" />
                  Novo Corretor
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Corretores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{corretores.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Em Avaliação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {corretores.filter(c => c.status === 'em_avaliacao').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aprovados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {corretores.filter(c => c.status === 'ativo').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Nota Média
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {corretores.length > 0 ? 
                  (corretores.reduce((acc, c) => acc + c.nota_media, 0) / corretores.length).toFixed(1) : 
                  '0.0'
                }
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
                  placeholder="Buscar corretores..."
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

        {/* Corretores List */}
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {viewMode === 'active' ? 'Corretores Cadastrados' : 'Corretores na Lixeira'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {corretores.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {viewMode === 'active' 
                      ? 'Nenhum corretor encontrado' 
                      : 'A lixeira está vazia'}
                  </div>
                ) : (
                  corretores.map((corretor) => (
                    <div
                      key={corretor.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">
                            {corretor.profiles.first_name} {corretor.profiles.last_name}
                          </h3>
                          <Badge variant={statusVariants[corretor.status as keyof typeof statusVariants] || 'default'}>
                            {statusLabels[corretor.status as keyof typeof statusLabels] || corretor.status}
                          </Badge>
                          {corretor.deleted_at && (
                            <Badge variant="destructive">
                              <Trash2 className="w-3 h-3 mr-1" />
                              Excluído
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            CRECI: {corretor.creci}
                          </div>
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {corretor.whatsapp}
                          </div>
                          {corretor.email && (
                            <div className="flex items-center gap-1">
                              <span className="w-3 h-3">📧</span>
                              {corretor.email}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {corretor.total_visitas} visitas
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Avaliação:</span>
                          <div className="flex items-center gap-1">
                            {getRatingStars(corretor.nota_media)}
                            <span className="text-sm font-medium ml-1">
                              {corretor.nota_media.toFixed(1)}
                            </span>
                            {corretor.nota_media === 0 && (
                              <Badge variant="secondary" className="ml-2">
                                Não avaliado
                              </Badge>
                            )}
                          </div>
                        </div>
                        {corretor.data_avaliacao && (
                          <div className="text-sm text-muted-foreground">
                            Avaliado em: {format(new Date(corretor.data_avaliacao), 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                        )}
                        {corretor.deleted_at && (
                          <div className="text-sm text-destructive">
                            Excluído em: {format(new Date(corretor.deleted_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {viewMode === 'active' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCorretor(corretor);
                                setShowCorretorModal(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCorretor(corretor);
                                setShowCorretorModal(true);
                              }}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Editar
                            </Button>
                          </>
                        )}
                        <CorretorActions corretor={corretor} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <CorretorModal
        open={showCorretorModal}
        onOpenChange={setShowCorretorModal}
        initialData={selectedCorretor}
        title={selectedCorretor ? "Editar Corretor" : "Novo Corretor"}
      />

      <ImportExportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        type="import"
      />

      <ImportExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        type="export"
      />
    </DashboardLayout>
  );
}
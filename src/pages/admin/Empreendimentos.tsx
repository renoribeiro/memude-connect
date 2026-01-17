import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, MapPin, Building, DollarSign, Edit, Eye } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import EmpreendimentoModal from "@/components/modals/EmpreendimentoModal";

interface Empreendimento {
  id: string;
  nome: string;
  endereco?: string;
  descricao?: string;
  valor_min?: number;
  valor_max?: number;
  ativo: boolean;
  created_at: string;
  construtoras?: {
    nome: string;
  };
  bairros?: {
    nome: string;
    cidade: string;
  };
}

export default function Empreendimentos() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAtivo, setFilterAtivo] = useState<string>("all");
  const [showEmpreendimentoModal, setShowEmpreendimentoModal] = useState(false);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState<any>(null);

  const { data: empreendimentos = [], isLoading } = useQuery({
    queryKey: ['empreendimentos', searchTerm, filterAtivo],
    queryFn: async () => {
      let query = supabase
        .from('empreendimentos')
        .select(`
          *,
          construtoras(nome),
          bairros(nome, cidade)
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,endereco.ilike.%${searchTerm}%,descricao.ilike.%${searchTerm}%`);
      }

      if (filterAtivo !== 'all') {
        query = query.eq('ativo', filterAtivo === 'true');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Empreendimento[];
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (!profile) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciamento de Empreendimentos</h1>
            <p className="text-muted-foreground">
              Gerencie empreendimentos, preços e detalhes
            </p>
          </div>
          <Button className="flex items-center gap-2" onClick={() => {
            setSelectedEmpreendimento(null);
            setShowEmpreendimentoModal(true);
          }}>
            <Plus className="w-4 h-4" />
            Novo Empreendimento
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Empreendimentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{empreendimentos.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {empreendimentos.filter(e => e.ativo).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Inativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {empreendimentos.filter(e => !e.ativo).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Preço Médio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {empreendimentos.length > 0 && empreendimentos.some(e => e.valor_min && e.valor_max) ? 
                  formatCurrency(
                    empreendimentos
                      .filter(e => e.valor_min && e.valor_max)
                      .reduce((acc, e) => acc + ((e.valor_min! + e.valor_max!) / 2), 0) / 
                    empreendimentos.filter(e => e.valor_min && e.valor_max).length
                  ) : 'N/A'
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
                  placeholder="Buscar empreendimentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={filterAtivo}
                  onChange={(e) => setFilterAtivo(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  <option value="all">Todos</option>
                  <option value="true">Ativos</option>
                  <option value="false">Inativos</option>
                </select>
                <Button variant="outline" size="icon">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Empreendimentos List */}
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Empreendimentos Cadastrados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {empreendimentos.map((empreendimento) => (
                  <div
                    key={empreendimento.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{empreendimento.nome}</h3>
                        <Badge variant={empreendimento.ativo ? 'success' : 'secondary'}>
                          {empreendimento.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {empreendimento.construtoras && (
                          <div className="flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {empreendimento.construtoras.nome}
                          </div>
                        )}
                        {empreendimento.bairros && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {empreendimento.bairros.nome}, {empreendimento.bairros.cidade}
                          </div>
                        )}
                        {(empreendimento.valor_min || empreendimento.valor_max) && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {empreendimento.valor_min && empreendimento.valor_max ? (
                              `${formatCurrency(empreendimento.valor_min)} - ${formatCurrency(empreendimento.valor_max)}`
                            ) : empreendimento.valor_min ? (
                              `A partir de ${formatCurrency(empreendimento.valor_min)}`
                            ) : empreendimento.valor_max ? (
                              `Até ${formatCurrency(empreendimento.valor_max)}`
                            ) : null}
                          </div>
                        )}
                      </div>
                      {empreendimento.endereco && (
                        <div className="text-sm text-muted-foreground">
                          Endereço: {empreendimento.endereco}
                        </div>
                      )}
                      {empreendimento.descricao && (
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {empreendimento.descricao}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setSelectedEmpreendimento(empreendimento);
                        setShowEmpreendimentoModal(true);
                      }}>
                        <Eye className="w-3 h-3 mr-1" />
                        Visualizar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setSelectedEmpreendimento(empreendimento);
                        setShowEmpreendimentoModal(true);
                      }}>
                        <Edit className="w-3 h-3 mr-1" />
                        Editar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className={empreendimento.ativo ? "text-red-600 border-red-600 hover:bg-red-50" : "text-green-600 border-green-600 hover:bg-green-50"}
                      >
                        {empreendimento.ativo ? 'Desativar' : 'Ativar'}
                      </Button>
                    </div>
                  </div>
                ))}
                {empreendimentos.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum empreendimento encontrado
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <EmpreendimentoModal
        open={showEmpreendimentoModal}
        onOpenChange={setShowEmpreendimentoModal}
        initialData={selectedEmpreendimento}
        title={selectedEmpreendimento ? "Editar Empreendimento" : "Novo Empreendimento"}
      />
    </DashboardLayout>
  );
}
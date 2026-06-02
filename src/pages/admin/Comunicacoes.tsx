import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Filter, MessageSquare, Phone, Mail, Calendar, User, ArrowUpRight, ArrowDownLeft, FileText } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { CommunicationModal } from "@/components/modals/CommunicationModal";
import { TemplateManager } from "@/components/templates/TemplateManager";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface CommunicationLog {
  id: string;
  type: string;
  direction: string;
  status: string;
  phone_number?: string;
  content: string;
  message_id?: string;
  metadata?: any;
  created_at: string;
  leads?: {
    nome: string;
  } | null;
  corretores?: {
    profiles: {
      first_name: string;
      last_name: string;
    } | null;
  } | null;
}

const typeVariants = {
  'whatsapp': 'success',
  'sms': 'secondary',
  'email': 'outline',
  'sistema': 'default'
} as const;

const typeLabels = {
  'whatsapp': 'WhatsApp',
  'sms': 'SMS',
  'email': 'Email',
  'sistema': 'Sistema'
};

const statusVariants = {
  'pending': 'secondary',
  'sent': 'outline',
  'delivered': 'success',
  'read': 'success',
  'failed': 'destructive'
} as const;

const statusLabels = {
  'pending': 'Pendente',
  'sent': 'Enviado',
  'delivered': 'Entregue',
  'read': 'Lido',
  'failed': 'Falhou'
};

export default function Comunicacoes() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("templates");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const { data: communications = [], isLoading } = useQuery({
    queryKey: ['communications', debouncedSearchTerm, filterType, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('communication_log')
        .select(`
          *,
          leads(nome),
          corretores(
            profiles(first_name, last_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (debouncedSearchTerm) {
        query = query.or(`content.ilike.%${debouncedSearchTerm}%,phone_number.ilike.%${debouncedSearchTerm}%`);
      }

      if (filterType !== 'all') {
        query = query.eq('type', filterType as any);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CommunicationLog[];
    }
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'sistema':
        return <Phone className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'enviado' ?
      <ArrowUpRight className="w-3 h-3" /> :
      <ArrowDownLeft className="w-3 h-3" />;
  };

  // Reset page when filters change
  useState(() => {
    setCurrentPage(1);
  });

  if (!profile) return null;

  const totalPages = Math.ceil(communications.length / ITEMS_PER_PAGE);
  const paginatedCommunications = communications.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Comunicações</h1>
            <p className="text-muted-foreground">
              Gerencie comunicações e templates do sistema
            </p>
          </div>
          {activeTab === "comunicacoes" && (
            <Button
              className="flex items-center gap-2"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Nova Comunicação
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="comunicacoes" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Log de Comunicações
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comunicacoes" className="space-y-6 mt-6">

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total de Comunicações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{communications.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    WhatsApp
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {communications.filter(c => c.type === 'whatsapp').length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    SMS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {communications.filter(c => c.type === 'sms').length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Entregues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {communications.filter(c => c.status === 'delivered' || c.status === 'read').length}
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
                      placeholder="Buscar comunicações..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="all">Todos os Tipos</option>
                      {Object.entries(typeLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
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

            {/* Communications List */}
            {isLoading ? (
              <TableSkeleton />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Comunicações Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {paginatedCommunications.map((comm) => (
                      <div
                        key={comm.id}
                        className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              {getTypeIcon(comm.type)}
                              <Badge variant={typeVariants[comm.type as keyof typeof typeVariants] || 'default'}>
                                {typeLabels[comm.type as keyof typeof typeLabels] || comm.type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              {getDirectionIcon(comm.direction)}
                              <span className="text-sm text-muted-foreground">
                                {comm.direction === 'enviado' ? 'Enviado' : 'Recebido'}
                              </span>
                            </div>
                            <Badge variant={statusVariants[comm.status as keyof typeof statusVariants] || 'default'}>
                              {statusLabels[comm.status as keyof typeof statusLabels] || comm.status}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {comm.phone_number && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {comm.phone_number}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(comm.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </div>
                            {comm.leads && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                Lead: {comm.leads?.nome || "Lead Desconhecido"}
                              </div>
                            )}
                            {comm.corretores && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                Corretor: {comm.corretores.profiles?.first_name || ""} {comm.corretores.profiles?.last_name || ""}
                              </div>
                            )}
                          </div>

                          <div className="bg-muted/30 p-3 rounded-md">
                            <p className="text-sm">{comm.content}</p>
                          </div>

                          {comm.message_id && (
                            <div className="text-xs text-muted-foreground">
                              ID da mensagem: {comm.message_id}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toast({
                              title: "Detalhes da Mensagem",
                              description: `Log ID: ${comm.id}\nStatus: ${comm.status}`
                            })}
                          >
                            Detalhes
                          </Button>
                          {comm.type === 'whatsapp' && comm.status === 'failed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-blue-600 border-blue-600 hover:bg-blue-50"
                              onClick={() => toast({
                                title: "Reenviar Mensagem",
                                description: "O fluxo de reenvio será processado em background."
                              })}
                            >
                              Reenviar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {communications.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma comunicação encontrada
                      </div>
                    )}
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-6 border-t pt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(p => Math.max(1, p - 1));
                              }}
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                            />
                          </PaginationItem>

                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                            .map((page, i, arr) => (
                              <div key={page} className="flex items-center">
                                {i > 0 && arr[i - 1] !== page - 1 && (
                                  <span className="px-2 text-muted-foreground">...</span>
                                )}
                                <PaginationItem>
                                  <PaginationLink
                                    href="#"
                                    isActive={currentPage === page}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setCurrentPage(page);
                                    }}
                                  >
                                    {page}
                                  </PaginationLink>
                                </PaginationItem>
                              </div>
                            ))}

                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(p => Math.min(totalPages, p + 1));
                              }}
                              className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Communication Modal */}
            <CommunicationModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
            />
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            <TemplateManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
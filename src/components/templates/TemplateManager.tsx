import React, { useState } from "react";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTemplates } from "@/hooks/useTemplates";
import { TemplateCard } from "./TemplateCard";
import { TemplateModal } from "@/components/modals/TemplateModal";
import { Skeleton } from "@/components/ui/skeleton";

const categoryLabels = {
  lead_distribution: "Distribuição de Leads",
  visit_distribution: "Distribuição de Visitas",
  visit_confirmation: "Confirmação de Visita",
  visit_reminder: "Lembrete de Visita",
  follow_up: "Follow-up",
  welcome: "Boas-vindas",
  admin_notification: "Notificação Admin",
  payment_reminder: "Lembrete de Pagamento",
  feedback_request: "Solicitação de Feedback",
  custom: "Personalizado"
};

const typeLabels = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "E-mail",
  sistema: "Sistema"
};

export const TemplateManager: React.FC = () => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all_categories");
  const [typeFilter, setTypeFilter] = useState<string>("all_types");
  const [systemFilter, setSystemFilter] = useState<string>("all_systems");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filters = {
    ...(search && { search }),
    ...(categoryFilter && categoryFilter !== 'all_categories' && { category: categoryFilter }),
    ...(typeFilter && typeFilter !== 'all_types' && { type: typeFilter }),
    ...(systemFilter && systemFilter !== 'all_systems' && { is_system: systemFilter === 'system' })
  };

  const { data: templates = [], isLoading, error } = useTemplates(filters);

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive">Erro ao carregar templates: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Templates de Comunicação</h2>
          <p className="text-muted-foreground">
            Gerencie os templates de mensagens usados no sistema
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_categories">Todas as categorias</SelectItem>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_types">Todos os tipos</SelectItem>
              {Object.entries(typeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={systemFilter} onValueChange={setSystemFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Sistema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_systems">Todos</SelectItem>
              <SelectItem value="system">Sistema</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de Templates */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <Filter className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum template encontrado</h3>
          <p className="text-muted-foreground mb-4">
            Não foram encontrados templates com os filtros selecionados.
          </p>
          <Button onClick={() => {
            setSearch("");
            setCategoryFilter("all_categories");
            setTypeFilter("all_types");
            setSystemFilter("all_systems");
          }}>
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              categoryLabels={categoryLabels}
              typeLabels={typeLabels}
            />
          ))}
        </div>
      )}

      {/* Modal de Template */}
      <TemplateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categoryLabels={categoryLabels}
        typeLabels={typeLabels}
      />
    </div>
  );
};
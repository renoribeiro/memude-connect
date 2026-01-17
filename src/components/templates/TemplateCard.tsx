import React, { useState } from "react";
import { MoreVertical, Edit2, Copy, Trash2, Eye, MessageCircle, Mail, Smartphone, Settings } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessageTemplate, useDuplicateTemplate, useDeleteTemplate } from "@/hooks/useTemplates";
import { TemplateModal } from "@/components/modals/TemplateModal";
import { TemplatePreview } from "./TemplatePreview";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface TemplateCardProps {
  template: MessageTemplate;
  categoryLabels: Record<string, string>;
  typeLabels: Record<string, string>;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'whatsapp':
      return <MessageCircle className="w-4 h-4" />;
    case 'email':
      return <Mail className="w-4 h-4" />;
    case 'sms':
      return <Smartphone className="w-4 h-4" />;
    default:
      return <Settings className="w-4 h-4" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'whatsapp':
      return 'bg-green-100 text-green-800';
    case 'email':
      return 'bg-blue-100 text-blue-800';
    case 'sms':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  categoryLabels,
  typeLabels
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const duplicateTemplate = useDuplicateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const handleDuplicate = () => {
    duplicateTemplate.mutate(template.id);
  };

  const handleDelete = () => {
    deleteTemplate.mutate(template.id);
    setIsDeleteDialogOpen(false);
  };

  const createdBy = template.profiles 
    ? `${template.profiles.first_name} ${template.profiles.last_name}`
    : 'Sistema';

  return (
    <>
      <Card className="group hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate" title={template.name}>
                {template.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {categoryLabels[template.category]}
                </Badge>
                <Badge className={`text-xs ${getTypeColor(template.type)}`}>
                  <div className="flex items-center gap-1">
                    {getTypeIcon(template.type)}
                    {typeLabels[template.type]}
                  </div>
                </Badge>
              </div>
            </div>
            
            {/* Botões de ação sempre visíveis */}
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsEditModalOpen(true)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title={template.is_system ? "Editar template do sistema" : "Editar template"}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsPreviewModalOpen(true)}>
                    <Eye className="w-4 h-4 mr-2" />
                    Visualizar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate}>
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicar
                  </DropdownMenuItem>
                  {!template.is_system && (
                    <DropdownMenuItem 
                      onClick={() => setIsDeleteDialogOpen(true)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Preview do conteúdo */}
            <div className="bg-muted/50 p-3 rounded text-sm">
              <p className="line-clamp-3 text-muted-foreground">
                {template.content}
              </p>
            </div>

            {/* Informações adicionais */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {template.is_system ? 'Sistema' : `Por ${createdBy}`}
              </span>
              <span>
                {new Date(template.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between">
              <Badge variant={template.is_active ? "default" : "secondary"}>
                {template.is_active ? "Ativo" : "Inativo"}
              </Badge>
              {template.is_system && (
                <Badge variant="outline" className="text-xs">
                  Template do Sistema
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modais */}
      <TemplateModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        template={template}
        categoryLabels={categoryLabels}
        typeLabels={typeLabels}
      />

      <TemplatePreview
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        template={template}
        categoryLabels={categoryLabels}
        typeLabels={typeLabels}
      />

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o template "{template.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
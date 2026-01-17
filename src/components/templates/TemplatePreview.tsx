import React, { useState } from "react";
import { Eye, X, Play } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { MessageTemplate } from "@/hooks/useTemplates";
import { useTemplateRenderer } from "@/hooks/useTemplateRenderer";

interface TemplatePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  template: MessageTemplate;
  categoryLabels: Record<string, string>;
  typeLabels: Record<string, string>;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  isOpen,
  onClose,
  template,
  categoryLabels,
  typeLabels
}) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  
  const renderTemplate = useTemplateRenderer();

  // Dados de exemplo para preview
  const sampleVariables = {
    nome_lead: "Maria Silva",
    telefone_lead: "(85) 99999-8888",
    email_lead: "maria.silva@email.com",
    data_visita: "25/09/2024",
    horario_visita: "14:30",
    nome_empreendimento: "Residencial Jardim das Flores",
    endereco_empreendimento: "Rua das Palmeiras, 123 - Aldeota",
    construtora: "Construtora Premium",
    valor_min: "R$ 280.000",
    valor_max: "R$ 450.000",
    nome_corretor: "João Santos",
    whatsapp_corretor: "(85) 98888-7777",
    creci_corretor: "CRECI 12345-CE"
  };

  const handlePreview = async () => {
    try {
      setIsPreviewMode(true);
      const result = await renderTemplate.mutateAsync({
        templateId: template.id,
        variables: sampleVariables,
        previewMode: true
      });
      setPreviewContent(result.rendered_content);
    } catch (error) {
      console.error('Erro ao gerar preview:', error);
    }
  };

  const createdBy = template.profiles 
    ? `${template.profiles.first_name} ${template.profiles.last_name}`
    : 'Sistema';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Visualizar Template
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Template */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{template.name}</h3>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary">
                  {categoryLabels[template.category]}
                </Badge>
                <Badge variant="outline">
                  {typeLabels[template.type]}
                </Badge>
                {template.is_system && (
                  <Badge variant="outline" className="text-xs">
                    Sistema
                  </Badge>
                )}
                <Badge variant={template.is_active ? "default" : "secondary"}>
                  {template.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Criado por:</span>
                <p className="font-medium">{createdBy}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Data de criação:</span>
                <p className="font-medium">
                  {new Date(template.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Conteúdo Original */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Conteúdo do Template</h4>
              <Button 
                onClick={handlePreview} 
                disabled={renderTemplate.isPending}
                size="sm"
              >
                <Play className="w-4 h-4 mr-2" />
                {renderTemplate.isPending ? 'Gerando...' : 'Gerar Preview'}
              </Button>
            </div>
            
            <div className="bg-muted p-4 rounded-lg">
              <Textarea
                value={template.content}
                readOnly
                className="min-h-32 resize-none border-0 bg-transparent"
              />
            </div>
          </div>

          {/* Variáveis Disponíveis */}
          {template.variables && template.variables.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium">Variáveis Utilizadas</h4>
                <div className="flex flex-wrap gap-2">
                  {template.variables.map((variable) => (
                    <Badge key={variable} variant="outline" className="text-xs">
                      {variable}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Preview Renderizado */}
          {isPreviewMode && previewContent && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium">Preview com Dados de Exemplo</h4>
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <div className="whitespace-pre-wrap text-sm">
                    {previewContent}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  * Este preview usa dados fictícios para demonstração
                </p>
              </div>
            </>
          )}

          {/* Dados de Exemplo Usados */}
          {isPreviewMode && previewContent && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium">Dados de Exemplo Utilizados</h4>
                <div className="bg-gray-50 p-3 rounded text-xs">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(sampleVariables, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
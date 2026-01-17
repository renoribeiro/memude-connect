import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, AlertTriangle, Image, FileText, List } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { MessageTemplate, useCreateTemplate, useUpdateTemplate } from "@/hooks/useTemplates";
import { VariableSelector } from "../templates/VariableSelector";

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template?: MessageTemplate;
  categoryLabels: Record<string, string>;
  typeLabels: Record<string, string>;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  template,
  categoryLabels,
  typeLabels
}) => {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    type: "",
    subject: "",
    content: "",
    variables: [] as string[],
    is_active: true
  });

  const [showVariableSelector, setShowVariableSelector] = useState(false);
  
  // Fase 5: Estados para novos tipos de mensagem
  const [messageType, setMessageType] = useState<'text' | 'buttons' | 'media' | 'list'>('text');
  const [buttons, setButtons] = useState<Array<{ id: string; text: string }>>([]);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document' | 'audio'>('image');
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [listTitle, setListTitle] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [listButtonText, setListButtonText] = useState("Ver opções");
  const [listSections, setListSections] = useState<Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>>([]);

  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const isEditing = !!template;

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        category: template.category,
        type: template.type,
        subject: template.subject || "",
        content: template.content,
        variables: template.variables || [],
        is_active: template.is_active
      });
      
      // Carregar configurações de botões/mídia/lista
      if (template.button_config && template.button_config.length > 0) {
        setMessageType('buttons');
        setButtons(template.button_config);
      } else if (template.media_config) {
        setMessageType('media');
        setMediaType(template.media_config.type || 'image');
        setMediaUrl(template.media_config.url || '');
        setMediaCaption(template.media_config.caption || '');
      } else if (template.list_config) {
        setMessageType('list');
        setListTitle(template.list_config.title || '');
        setListDescription(template.list_config.description || '');
        setListButtonText(template.list_config.buttonText || 'Ver opções');
        setListSections(template.list_config.sections || []);
      }
    } else {
      setFormData({
        name: "",
        category: "",
        type: "",
        subject: "",
        content: "",
        variables: [],
        is_active: true
      });
      setMessageType('text');
      setButtons([]);
      setMediaUrl("");
      setMediaCaption("");
      setListSections([]);
    }
  }, [template, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const templateData: any = { ...formData };
      
      // Adicionar configurações específicas baseadas no tipo de mensagem
      if (formData.type === 'whatsapp') {
        if (messageType === 'buttons' && buttons.length > 0) {
          templateData.button_config = buttons;
        } else if (messageType === 'media' && mediaUrl) {
          templateData.media_config = {
            type: mediaType,
            url: mediaUrl,
            caption: mediaCaption || null,
          };
        } else if (messageType === 'list' && listSections.length > 0) {
          templateData.list_config = {
            title: listTitle,
            description: listDescription || null,
            buttonText: listButtonText,
            sections: listSections,
          };
        }
      }
      
      if (isEditing && template) {
        await updateTemplate.mutateAsync({
          id: template.id,
          ...templateData
        } as any);
      } else {
        await createTemplate.mutateAsync(templateData as any);
      }
      onClose();
    } catch (error) {
      console.error('Erro ao salvar template:', error);
    }
  };

  const addButton = () => {
    setButtons([...buttons, { id: `btn_${Date.now()}`, text: "" }]);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, field: 'id' | 'text', value: string) => {
    const newButtons = [...buttons];
    newButtons[index][field] = value;
    setButtons(newButtons);
  };

  const addListSection = () => {
    setListSections([...listSections, { title: "", rows: [{ id: `row_${Date.now()}`, title: "" }] }]);
  };

  const addListRow = (sectionIndex: number) => {
    const newSections = [...listSections];
    newSections[sectionIndex].rows.push({ id: `row_${Date.now()}`, title: "" });
    setListSections(newSections);
  };

  const handleVariableInsert = (variableName: string) => {
    const cursorPosition = document.querySelector('textarea')?.selectionStart || 0;
    const textBefore = formData.content.substring(0, cursorPosition);
    const textAfter = formData.content.substring(cursorPosition);
    
    const newContent = textBefore + `{${variableName}}` + textAfter;
    setFormData(prev => ({ ...prev, content: newContent }));
    
    // Adicionar variável à lista se não existir
    if (!formData.variables.includes(variableName)) {
      setFormData(prev => ({
        ...prev,
        variables: [...prev.variables, variableName]
      }));
    }
  };

  const removeVariable = (variableName: string) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.filter(v => v !== variableName)
    }));
  };

  const isLoading = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {isEditing ? 'Editar Template' : 'Novo Template'}
              {template?.is_system && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (Template do Sistema)
                </span>
              )}
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          {template?.is_system && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Atenção: Template do Sistema</p>
                  <p className="text-blue-700">
                    Este é um template do sistema. Alterações podem afetar funcionalidades automáticas. 
                    Certifique-se de manter as variáveis essenciais para o funcionamento correto.
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Template *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Distribuição de Lead - Bairro"
                required
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="is_active">Status</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">
                  {formData.is_active ? 'Ativo' : 'Inativo'}
                </Label>
              </div>
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <Label htmlFor="category">Categoria *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Comunicação *</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assunto (apenas para emails) */}
          {formData.type === 'email' && (
            <div className="space-y-2">
              <Label htmlFor="subject">Assunto do E-mail</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Ex: Confirmação de Visita - {nome_empreendimento}"
              />
            </div>
          )}

          {/* Conteúdo - Fase 5: Com suporte a diferentes tipos */}
          {formData.type === 'whatsapp' ? (
            <Tabs value={messageType} onValueChange={(v) => setMessageType(v as any)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="text">Texto</TabsTrigger>
                <TabsTrigger value="buttons">Botões</TabsTrigger>
                <TabsTrigger value="media">Mídia</TabsTrigger>
                <TabsTrigger value="list">Lista</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="content">Conteúdo *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowVariableSelector(!showVariableSelector)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Inserir Variável
                    </Button>
                  </div>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Use {variavel} para inserir variáveis dinâmicas"
                    rows={6}
                    required
                  />
                </div>
              </TabsContent>

              <TabsContent value="buttons" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Texto da mensagem"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Botões</Label>
                    <Button type="button" size="sm" onClick={addButton}>
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Botão
                    </Button>
                  </div>
                  {buttons.map((button, index) => (
                    <Card key={index}>
                      <CardContent className="flex gap-2 items-center pt-4">
                        <Input
                          placeholder="ID do botão"
                          value={button.id}
                          onChange={(e) => updateButton(index, 'id', e.target.value)}
                        />
                        <Input
                          placeholder="Texto do botão"
                          value={button.text}
                          onChange={(e) => updateButton(index, 'text', e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeButton(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="media" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Tipo de Mídia</Label>
                  <Select value={mediaType} onValueChange={(v) => setMediaType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image"><Image className="w-4 h-4 inline mr-2" />Imagem</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="document"><FileText className="w-4 h-4 inline mr-2" />Documento</SelectItem>
                      <SelectItem value="audio">Áudio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>URL da Mídia *</Label>
                  <Input
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Legenda (opcional)</Label>
                  <Textarea
                    value={mediaCaption}
                    onChange={(e) => setMediaCaption(e.target.value)}
                    placeholder="Legenda da mídia"
                    rows={3}
                  />
                </div>
              </TabsContent>

              <TabsContent value="list" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Título da Lista *</Label>
                  <Input
                    value={listTitle}
                    onChange={(e) => setListTitle(e.target.value)}
                    placeholder="Título principal"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    value={listDescription}
                    onChange={(e) => setListDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Texto do Botão</Label>
                  <Input
                    value={listButtonText}
                    onChange={(e) => setListButtonText(e.target.value)}
                    placeholder="Ver opções"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Seções</Label>
                    <Button type="button" size="sm" onClick={addListSection}>
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Seção
                    </Button>
                  </div>
                  {listSections.map((section, sectionIndex) => (
                    <Card key={sectionIndex}>
                      <CardContent className="space-y-2 pt-4">
                        <Input
                          placeholder="Título da seção"
                          value={section.title}
                          onChange={(e) => {
                            const newSections = [...listSections];
                            newSections[sectionIndex].title = e.target.value;
                            setListSections(newSections);
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addListRow(sectionIndex)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Adicionar Item
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content">Conteúdo da Mensagem *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVariableSelector(!showVariableSelector)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Inserir Variável
                </Button>
              </div>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Digite o conteúdo da mensagem. Use {variavel} para inserir dados dinâmicos."
                className="min-h-40"
                required
              />
            </div>
          )}

          {/* Seletor de Variáveis */}
          {showVariableSelector && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <VariableSelector onVariableSelect={handleVariableInsert} />
            </div>
          )}

          {/* Variáveis Utilizadas */}
          {formData.variables.length > 0 && (
            <div className="space-y-3">
              <Label>Variáveis Utilizadas</Label>
              <div className="flex flex-wrap gap-2">
                {formData.variables.map((variable) => (
                  <Badge key={variable} variant="secondary" className="text-xs">
                    {variable}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 ml-2"
                      onClick={() => removeVariable(variable)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar Template')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
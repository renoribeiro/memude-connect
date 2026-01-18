import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Bell } from "lucide-react";
import { FollowupEditor } from "./FollowupEditor";

interface AIAgent {
    id?: string;
    name: string;
    description: string | null;
    is_active: boolean;
    persona_name: string;
    persona_role: string;
    tone: string;
    greeting_message: string | null;
    llm_provider: 'openai' | 'gemini';
    ai_model: string;
    max_tokens: number;
    temperature: number;
    system_prompt: string;
    enable_property_search: boolean;
    max_properties_to_show: number;
    max_messages_per_conversation: number;
    conversation_timeout_hours: number;
    trigger_keywords: string[];
    fallback_action: string;
    evolution_instance_id?: string | null;
}

const LLM_MODELS = {
    openai: [
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Rápido, econômico)' },
        { value: 'gpt-4o', label: 'GPT-4o (Mais preciso)' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Mais barato)' },
    ],
    gemini: [
        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Mais recente)' },
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Rápido)' },
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Avançado)' },
    ]
};

interface AgentEditorProps {
    agent: AIAgent | null;
    onClose: () => void;
}

const DEFAULT_SYSTEM_PROMPT = `Você é uma consultora imobiliária virtual da MeMude Imóveis, especializada em lançamentos imobiliários em Fortaleza e região metropolitana.

## Seu Objetivo Principal
Qualificar leads interessados em comprar imóveis, descobrindo:
1. Tipo de imóvel desejado (apartamento, casa, terreno)
2. Faixa de preço/orçamento disponível
3. Localização preferida (bairros/regiões)
4. Prazo para compra
5. Se precisa de financiamento

## Comportamento
- Seja simpática, profissional e objetiva
- Use linguagem natural e amigável
- Faça uma pergunta por vez
- Quando identificar o perfil, apresente opções de imóveis compatíveis
- Quando o cliente demonstrar interesse em um imóvel, sugira agendar uma visita
- Nunca invente informações sobre imóveis
- Se não souber algo, diga que vai verificar

## Formato de Resposta
- Respostas curtas (máximo 3 parágrafos)
- Use emojis com moderação (1-2 por mensagem)
- Destaque informações importantes com *negrito*

## Ações Especiais
- [BUSCAR_IMOVEIS]: Quando precisar buscar imóveis compatíveis
- [AGENDAR_VISITA]: Quando cliente confirmar interesse em visitar
- [TRANSFERIR_HUMANO]: Quando não conseguir ajudar ou cliente solicitar`;

const DEFAULT_GREETING = `Olá! 👋 Sou a Ana, consultora virtual da MeMude Imóveis.

Estou aqui para ajudar você a encontrar o imóvel ideal! 🏠

Para começar, me conta: você está procurando um apartamento, casa ou terreno?`;

export function AgentEditor({ agent, onClose }: AgentEditorProps) {
    const { toast } = useToast();
    const [formData, setFormData] = useState<AIAgent>({
        name: '',
        description: '',
        is_active: false,
        persona_name: 'Ana',
        persona_role: 'Consultora de Imóveis',
        tone: 'professional_friendly',
        greeting_message: DEFAULT_GREETING,
        llm_provider: 'openai',
        ai_model: 'gpt-4o-mini',
        max_tokens: 500,
        temperature: 0.7,
        system_prompt: DEFAULT_SYSTEM_PROMPT,
        enable_property_search: true,
        max_properties_to_show: 3,
        max_messages_per_conversation: 50,
        conversation_timeout_hours: 24,
        trigger_keywords: ['comprar', 'apartamento', 'casa', 'imóvel', 'imovel'],
        fallback_action: 'notify_admin',
        evolution_instance_id: null
    });

    const { data: evolutionInstances = [] } = useQuery({
        queryKey: ['evolution-instances-select'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('evolution_instances')
                .select('id, name, instance_name')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data;
        }
    });

    useEffect(() => {
        if (agent) {
            setFormData({
                ...agent,
                trigger_keywords: agent.trigger_keywords || []
            });
        }
    }, [agent]);

    const saveMutation = useMutation({
        mutationFn: async (data: AIAgent) => {
            const payload = {
                name: data.name,
                description: data.description,
                is_active: data.is_active,
                persona_name: data.persona_name,
                persona_role: data.persona_role,
                tone: data.tone,
                greeting_message: data.greeting_message,
                llm_provider: data.llm_provider,
                ai_model: data.ai_model,
                max_tokens: data.max_tokens,
                temperature: data.temperature,
                system_prompt: data.system_prompt,
                enable_property_search: data.enable_property_search,
                max_properties_to_show: data.max_properties_to_show,
                max_messages_per_conversation: data.max_messages_per_conversation,
                conversation_timeout_hours: data.conversation_timeout_hours,
                trigger_keywords: data.trigger_keywords,
                fallback_action: data.fallback_action,
                evolution_instance_id: data.evolution_instance_id,
                updated_at: new Date().toISOString()
            };

            if (agent?.id) {
                const { error } = await supabase
                    .from('ai_agents')
                    .update(payload)
                    .eq('id', agent.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('ai_agents')
                    .insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast({
                title: "Salvo com sucesso",
                description: agent?.id ? "Agente atualizado." : "Agente criado."
            });
            onClose();
        },
        onError: (error: any) => {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast({
                title: "Nome obrigatório",
                description: "Por favor, informe um nome para o agente.",
                variant: "destructive"
            });
            return;
        }
        if (!formData.system_prompt.trim()) {
            toast({
                title: "System prompt obrigatório",
                description: "Por favor, configure o prompt do sistema.",
                variant: "destructive"
            });
            return;
        }
        saveMutation.mutate(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="basic">Básico</TabsTrigger>
                    <TabsTrigger value="personality">Personalidade</TabsTrigger>
                    <TabsTrigger value="ai">IA</TabsTrigger>
                    <TabsTrigger value="behavior">Comportamento</TabsTrigger>
                    <TabsTrigger value="followups" disabled={!agent?.id}>
                        <Bell className="h-3 w-3 mr-1" />
                        Follow-ups
                    </TabsTrigger>
                </TabsList>

                {/* Basic Settings */}
                <TabsContent value="basic" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome do Agente *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: Ana - Consultora Imobiliária"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="evolution_instance">Instância Evolution API</Label>
                        <Select
                            value={formData.evolution_instance_id || "default"}
                            onValueChange={(value) => setFormData({
                                ...formData,
                                evolution_instance_id: value === "default" ? null : value
                            })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione uma instância" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">Padrão (System Settings)</SelectItem>
                                {evolutionInstances.map((instance: any) => (
                                    <SelectItem key={instance.id} value={instance.id}>
                                        {instance.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Define qual conta do WhatsApp este agente usará.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="llm_provider">Provedor de IA</Label>
                            <Select
                                value={formData.llm_provider}
                                onValueChange={(value: 'openai' | 'gemini') => {
                                    const firstModel = LLM_MODELS[value][0].value;
                                    setFormData({ ...formData, llm_provider: value, ai_model: firstModel });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
                                    <SelectItem value="gemini">Google Gemini</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ai_model">Modelo</Label>
                            <Select
                                value={formData.ai_model}
                                onValueChange={(value) => setFormData({ ...formData, ai_model: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {LLM_MODELS[formData.llm_provider].map((model) => (
                                        <SelectItem key={model.value} value={model.value}>
                                            {model.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                            id="description"
                            value={formData.description || ''}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Descrição do propósito do agente..."
                            rows={2}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <Label>Agente Ativo</Label>
                            <p className="text-sm text-muted-foreground">
                                Apenas um agente pode estar ativo por vez
                            </p>
                        </div>
                        <Switch
                            checked={formData.is_active}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                    </div>
                </TabsContent>

                {/* Personality Settings */}
                <TabsContent value="personality" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="persona_name">Nome do Personagem</Label>
                            <Input
                                id="persona_name"
                                value={formData.persona_name}
                                onChange={(e) => setFormData({ ...formData, persona_name: e.target.value })}
                                placeholder="Ana"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="persona_role">Cargo/Papel</Label>
                            <Input
                                id="persona_role"
                                value={formData.persona_role}
                                onChange={(e) => setFormData({ ...formData, persona_role: e.target.value })}
                                placeholder="Consultora de Imóveis"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="tone">Tom de Voz</Label>
                        <Select
                            value={formData.tone}
                            onValueChange={(value) => setFormData({ ...formData, tone: value })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="professional">Profissional</SelectItem>
                                <SelectItem value="friendly">Amigável</SelectItem>
                                <SelectItem value="formal">Formal</SelectItem>
                                <SelectItem value="casual">Casual</SelectItem>
                                <SelectItem value="professional_friendly">Profissional e Amigável</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="greeting_message">Mensagem de Saudação</Label>
                        <Textarea
                            id="greeting_message"
                            value={formData.greeting_message || ''}
                            onChange={(e) => setFormData({ ...formData, greeting_message: e.target.value })}
                            placeholder="Olá! Como posso ajudar você hoje?"
                            rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                            Primeira mensagem enviada quando o cliente inicia uma conversa
                        </p>
                    </div>
                </TabsContent>

                {/* AI Settings */}
                <TabsContent value="ai" className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="system_prompt">System Prompt * (Instruções para a IA)</Label>
                        <Textarea
                            id="system_prompt"
                            value={formData.system_prompt}
                            onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                            rows={12}
                            className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                            Define o comportamento, personalidade e objetivos do agente.
                            Use [BUSCAR_IMOVEIS], [AGENDAR_VISITA], [TRANSFERIR_HUMANO] para ações especiais.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Temperatura: {formData.temperature}</Label>
                            <Slider
                                value={[formData.temperature]}
                                onValueChange={(value) => setFormData({ ...formData, temperature: value[0] })}
                                min={0}
                                max={1}
                                step={0.1}
                            />
                            <p className="text-xs text-muted-foreground">
                                Menor = mais focado, Maior = mais criativo
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Max Tokens: {formData.max_tokens}</Label>
                            <Slider
                                value={[formData.max_tokens]}
                                onValueChange={(value) => setFormData({ ...formData, max_tokens: value[0] })}
                                min={100}
                                max={2000}
                                step={100}
                            />
                            <p className="text-xs text-muted-foreground">
                                Limite de tamanho das respostas
                            </p>
                        </div>
                    </div>
                </TabsContent>

                {/* Behavior Settings */}
                <TabsContent value="behavior" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <Label>Busca de Imóveis</Label>
                            <p className="text-sm text-muted-foreground">
                                Permite que o agente busque e apresente imóveis
                            </p>
                        </div>
                        <Switch
                            checked={formData.enable_property_search}
                            onCheckedChange={(checked) => setFormData({ ...formData, enable_property_search: checked })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Máximo de Imóveis por Busca</Label>
                            <Select
                                value={formData.max_properties_to_show.toString()}
                                onValueChange={(value) => setFormData({ ...formData, max_properties_to_show: parseInt(value) })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="3">3 imóveis</SelectItem>
                                    <SelectItem value="5">5 imóveis</SelectItem>
                                    <SelectItem value="10">10 imóveis</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Ação de Fallback</Label>
                            <Select
                                value={formData.fallback_action}
                                onValueChange={(value) => setFormData({ ...formData, fallback_action: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="notify_admin">Notificar Administrador</SelectItem>
                                    <SelectItem value="transfer_human">Transferir para Humano</SelectItem>
                                    <SelectItem value="end_conversation">Encerrar Conversa</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Keywords de Ativação</Label>
                        <Input
                            value={formData.trigger_keywords.join(', ')}
                            onChange={(e) => setFormData({
                                ...formData,
                                trigger_keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                            })}
                            placeholder="comprar, apartamento, casa, imóvel"
                        />
                        <p className="text-xs text-muted-foreground">
                            Palavras que iniciam uma conversa com o agente (separadas por vírgula)
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Limite de Mensagens</Label>
                            <Input
                                type="number"
                                value={formData.max_messages_per_conversation}
                                onChange={(e) => setFormData({ ...formData, max_messages_per_conversation: parseInt(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Máximo de mensagens por conversa
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Timeout da Conversa (horas)</Label>
                            <Input
                                type="number"
                                value={formData.conversation_timeout_hours}
                                onChange={(e) => setFormData({ ...formData, conversation_timeout_hours: parseInt(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Tempo de inatividade para expirar conversa
                            </p>
                        </div>
                    </div>
                </TabsContent>

                {/* Follow-ups Tab - Only available for existing agents */}
                <TabsContent value="followups" className="space-y-4 mt-4">
                    {agent?.id ? (
                        <FollowupEditor agentId={agent.id} />
                    ) : (
                        <div className="p-8 text-center text-muted-foreground">
                            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Salve o agente primeiro para configurar os follow-ups</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Submit Button */}
            <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Salvando...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4 mr-2" />
                            Salvar Agente
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
}

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
    Plus,
    Trash2,
    GripVertical,
    Clock,
    MessageSquare,
    ChevronUp,
    ChevronDown,
    Save,
    Mic,
    Image,
    Volume2,
    PlayCircle,
    AlertCircle
} from "lucide-react";

interface Followup {
    id?: string;
    agent_id: string;
    sequence_order: number;
    delay_hours: number;
    message_template: string;
    send_after_hour: number;
    send_before_hour: number;
    is_active: boolean;
    skip_if_qualified: boolean;
    // Novos campos de mídia
    media_type?: 'text' | 'audio' | 'image' | 'video';
    audio_url?: string;
    audio_caption?: string;
    image_url?: string;
    image_caption?: string;
    include_property_reminder?: boolean;
}

interface FollowupEditorProps {
    agentId: string;
}

const DEFAULT_FOLLOWUP: Omit<Followup, 'agent_id' | 'sequence_order'> = {
    delay_hours: 24,
    message_template: "Oi {{nome}}! 😊 Ainda está interessado nos imóveis que conversamos?",
    send_after_hour: 8,
    send_before_hour: 20,
    is_active: true,
    skip_if_qualified: false,
    media_type: 'text',
    audio_url: '',
    audio_caption: '',
    image_url: '',
    image_caption: '',
    include_property_reminder: false
};

const AVAILABLE_VARIABLES = [
    { var: '{{nome}}', desc: 'Nome do cliente' },
    { var: '{{bairro}}', desc: 'Bairro de preferência' },
    { var: '{{tipo_imovel}}', desc: 'Tipo de imóvel' },
    { var: '{{orcamento}}', desc: 'Orçamento formatado' },
    { var: '{{ultimo_imovel}}', desc: 'Último imóvel mostrado' },
    { var: '{{bairro_imovel}}', desc: 'Bairro do último imóvel' },
    { var: '{{preco_imovel}}', desc: 'Preço do último imóvel' },
];

const MEDIA_TYPE_OPTIONS = [
    { value: 'text', label: '💬 Texto', icon: MessageSquare },
    { value: 'audio', label: '🎵 Áudio Pré-gravado', icon: Mic },
    { value: 'image', label: '🖼️ Imagem', icon: Image },
];

export function FollowupEditor({ agentId }: FollowupEditorProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);

    const { data: followups, isLoading } = useQuery({
        queryKey: ['agent-followups', agentId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('agent_followups')
                .select('*')
                .eq('agent_id', agentId)
                .order('sequence_order', { ascending: true });
            if (error) throw error;
            return data as Followup[];
        },
        enabled: !!agentId
    });

    const saveMutation = useMutation({
        mutationFn: async (followup: Followup) => {
            const payload = {
                delay_hours: followup.delay_hours,
                message_template: followup.message_template,
                send_after_hour: followup.send_after_hour,
                send_before_hour: followup.send_before_hour,
                is_active: followup.is_active,
                skip_if_qualified: followup.skip_if_qualified,
                media_type: followup.media_type || 'text',
                audio_url: followup.audio_url || null,
                audio_caption: followup.audio_caption || null,
                image_url: followup.image_url || null,
                image_caption: followup.image_caption || null,
                include_property_reminder: followup.include_property_reminder || false
            };

            if (followup.id) {
                const { error } = await supabase
                    .from('agent_followups')
                    .update(payload)
                    .eq('id', followup.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('agent_followups')
                    .insert({ ...payload, agent_id: followup.agent_id, sequence_order: followup.sequence_order });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent-followups', agentId] });
            setEditingId(null);
            toast({ title: "Follow-up salvo", description: "Configuração atualizada com sucesso." });
        },
        onError: (error: any) => {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('agent_followups')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent-followups', agentId] });
            toast({ title: "Follow-up excluído" });
        }
    });

    const addFollowup = () => {
        const newOrder = (followups?.length || 0) + 1;
        const newFollowup: Followup = {
            ...DEFAULT_FOLLOWUP,
            agent_id: agentId,
            sequence_order: newOrder
        };
        saveMutation.mutate(newFollowup);
    };

    const moveFollowup = async (index: number, direction: 'up' | 'down') => {
        if (!followups) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= followups.length) return;

        const current = followups[index];
        const target = followups[newIndex];

        await supabase.from('agent_followups').update({ sequence_order: target.sequence_order }).eq('id', current.id);
        await supabase.from('agent_followups').update({ sequence_order: current.sequence_order }).eq('id', target.id);

        queryClient.invalidateQueries({ queryKey: ['agent-followups', agentId] });
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Sequência de Follow-ups</h3>
                    <p className="text-sm text-muted-foreground">
                        Configure mensagens automáticas para reengajar leads inativos. Suporta texto, áudio e imagens.
                    </p>
                </div>
                <Button onClick={addFollowup} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                </Button>
            </div>

            {/* Dica sobre áudio */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                <Volume2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                    <p className="font-medium text-blue-800 dark:text-blue-200">💡 Dica: Use áudios para aumentar engajamento</p>
                    <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                        Follow-ups com áudio pré-gravado têm até 3x mais taxa de resposta. Grave mensagens autênticas e humanizadas para captar a atenção dos leads.
                    </p>
                </div>
            </div>

            {/* Variáveis disponíveis */}
            <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                <span className="text-xs font-medium">Variáveis disponíveis:</span>
                {AVAILABLE_VARIABLES.map(v => (
                    <Badge key={v.var} variant="outline" className="text-xs cursor-help" title={v.desc}>
                        {v.var}
                    </Badge>
                ))}
            </div>

            {(!followups || followups.length === 0) ? (
                <Card className="p-8 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Nenhum follow-up configurado</p>
                    <Button onClick={addFollowup}>
                        <Plus className="h-4 w-4 mr-1" />
                        Criar Primeiro Follow-up
                    </Button>
                </Card>
            ) : (
                <div className="space-y-3">
                    {followups.map((followup, index) => (
                        <FollowupCard
                            key={followup.id}
                            followup={followup}
                            index={index}
                            total={followups.length}
                            isEditing={editingId === followup.id}
                            onEdit={() => setEditingId(followup.id || null)}
                            onSave={(updated) => saveMutation.mutate({ ...followup, ...updated })}
                            onDelete={() => deleteMutation.mutate(followup.id!)}
                            onMoveUp={() => moveFollowup(index, 'up')}
                            onMoveDown={() => moveFollowup(index, 'down')}
                            onCancel={() => setEditingId(null)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

interface FollowupCardProps {
    followup: Followup;
    index: number;
    total: number;
    isEditing: boolean;
    onEdit: () => void;
    onSave: (updated: Partial<Followup>) => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onCancel: () => void;
}

function FollowupCard({ followup, index, total, isEditing, onEdit, onSave, onDelete, onMoveUp, onMoveDown, onCancel }: FollowupCardProps) {
    const [form, setForm] = useState<Followup>(followup);

    useEffect(() => {
        setForm(followup);
    }, [followup]);

    const mediaType = form.media_type || 'text';

    const getMediaIcon = () => {
        if (mediaType === 'audio') return <Mic className="h-4 w-4 text-purple-500" />;
        if (mediaType === 'image') return <Image className="h-4 w-4 text-green-500" />;
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
    };

    const getMediaLabel = () => {
        if (mediaType === 'audio') return 'Áudio';
        if (mediaType === 'image') return 'Imagem';
        return 'Texto';
    };

    if (!isEditing) {
        return (
            <Card className={`${!followup.is_active ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex flex-col gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={index === 0}>
                                <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={index === total - 1}>
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant={followup.is_active ? "default" : "secondary"}>
                                    #{followup.sequence_order}
                                </Badge>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    Após {followup.delay_hours}h
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    ({followup.send_after_hour}h - {followup.send_before_hour}h BRT)
                                </span>
                                {/* Badge de tipo de mídia */}
                                <Badge variant="outline" className="text-xs flex items-center gap-1">
                                    {getMediaIcon()}
                                    {getMediaLabel()}
                                </Badge>
                                {followup.include_property_reminder && (
                                    <Badge variant="outline" className="text-xs">🏠 Lembrete</Badge>
                                )}
                            </div>

                            {/* Preview do conteúdo */}
                            {mediaType === 'audio' && followup.audio_url ? (
                                <div className="flex items-center gap-2 text-sm text-purple-600">
                                    <PlayCircle className="h-4 w-4" />
                                    <span className="truncate max-w-[300px]">{followup.audio_url}</span>
                                </div>
                            ) : (
                                <p className="text-sm line-clamp-2">{followup.message_template}</p>
                            )}
                        </div>

                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={onEdit}>Editar</Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={onDelete}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-primary">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <GripVertical className="h-4 w-4" />
                    Follow-up #{followup.sequence_order}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Timing */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>Delay (horas)</Label>
                        <Input
                            type="number"
                            min={1}
                            value={form.delay_hours}
                            onChange={(e) => setForm({ ...form, delay_hours: parseInt(e.target.value) || 1 })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Enviar após (hora BRT)</Label>
                        <Input
                            type="number"
                            min={0}
                            max={23}
                            value={form.send_after_hour}
                            onChange={(e) => setForm({ ...form, send_after_hour: parseInt(e.target.value) || 8 })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Enviar até (hora BRT)</Label>
                        <Input
                            type="number"
                            min={0}
                            max={23}
                            value={form.send_before_hour}
                            onChange={(e) => setForm({ ...form, send_before_hour: parseInt(e.target.value) || 20 })}
                        />
                    </div>
                </div>

                {/* Tipo de Mídia */}
                <div className="space-y-2">
                    <Label>Tipo de Mensagem</Label>
                    <Select
                        value={form.media_type || 'text'}
                        onValueChange={(value: 'text' | 'audio' | 'image') =>
                            setForm({ ...form, media_type: value })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {MEDIA_TYPE_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        Áudios pré-gravados têm maior taxa de engajamento e humanizam o follow-up.
                    </p>
                </div>

                {/* Campos específicos por tipo de mídia */}
                {(form.media_type || 'text') === 'audio' && (
                    <div className="space-y-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4 text-purple-600" />
                            <Label className="text-purple-800 dark:text-purple-200">Configuração de Áudio</Label>
                        </div>
                        <div className="space-y-2">
                            <Label>URL do Áudio *</Label>
                            <Input
                                value={form.audio_url || ''}
                                onChange={(e) => setForm({ ...form, audio_url: e.target.value })}
                                placeholder="https://exemplo.com/audio/followup1.ogg"
                            />
                            <p className="text-xs text-muted-foreground">
                                URL pública do arquivo de áudio (.ogg, .mp3, .m4a). 
                                Recomendamos .ogg para melhor compatibilidade com WhatsApp.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Mensagem de texto após o áudio (opcional)</Label>
                            <Textarea
                                value={form.message_template}
                                onChange={(e) => setForm({ ...form, message_template: e.target.value })}
                                rows={2}
                                placeholder="Mensagem curta após o áudio. Deixe vazio para enviar só o áudio. Use {{nome}}, {{bairro}}, etc."
                            />
                        </div>
                        {!form.audio_url && (
                            <div className="flex items-center gap-2 text-amber-600 text-xs">
                                <AlertCircle className="h-3 w-3" />
                                <span>URL do áudio é obrigatória para este tipo de follow-up</span>
                            </div>
                        )}
                    </div>
                )}

                {(form.media_type || 'text') === 'image' && (
                    <div className="space-y-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2">
                            <Image className="h-4 w-4 text-green-600" />
                            <Label className="text-green-800 dark:text-green-200">Configuração de Imagem</Label>
                        </div>
                        <div className="space-y-2">
                            <Label>URL da Imagem *</Label>
                            <Input
                                value={form.image_url || ''}
                                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                                placeholder="https://exemplo.com/imagens/apartamento.jpg"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Legenda da Imagem</Label>
                            <Textarea
                                value={form.image_caption || form.message_template || ''}
                                onChange={(e) => setForm({ ...form, image_caption: e.target.value, message_template: e.target.value })}
                                rows={2}
                                placeholder="Legenda que aparece embaixo da imagem. Use {{nome}}, {{bairro}}, etc."
                            />
                        </div>
                    </div>
                )}

                {/* Texto padrão (sempre visível para type=text) */}
                {(form.media_type === 'text' || !form.media_type) && (
                    <div className="space-y-2">
                        <Label>Mensagem</Label>
                        <Textarea
                            value={form.message_template}
                            onChange={(e) => setForm({ ...form, message_template: e.target.value })}
                            rows={3}
                            placeholder="Use {{nome}}, {{bairro}}, {{tipo_imovel}}, {{orcamento}}, etc."
                        />
                    </div>
                )}

                {/* Switches de configuração */}
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={form.is_active}
                            onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                        />
                        <Label>Ativo</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={form.skip_if_qualified}
                            onCheckedChange={(checked) => setForm({ ...form, skip_if_qualified: checked })}
                        />
                        <Label>Pular se já qualificado</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={form.include_property_reminder || false}
                            onCheckedChange={(checked) => setForm({ ...form, include_property_reminder: checked })}
                        />
                        <Label>🏠 Incluir lembrete do imóvel</Label>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                    <Button
                        onClick={() => onSave(form)}
                        disabled={
                            (form.media_type === 'audio' && !form.audio_url) ||
                            (form.media_type === 'image' && !form.image_url)
                        }
                    >
                        <Save className="h-4 w-4 mr-1" />
                        Salvar
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

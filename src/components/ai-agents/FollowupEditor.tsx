import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    Plus,
    Trash2,
    GripVertical,
    Clock,
    MessageSquare,
    ChevronUp,
    ChevronDown,
    Save
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
    skip_if_qualified: false
};

const AVAILABLE_VARIABLES = [
    { var: '{{nome}}', desc: 'Nome do cliente' },
    { var: '{{bairro}}', desc: 'Bairro de preferência' },
    { var: '{{tipo_imovel}}', desc: 'Tipo de imóvel' },
    { var: '{{orcamento}}', desc: 'Orçamento' }
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
            if (followup.id) {
                const { error } = await supabase
                    .from('agent_followups')
                    .update({
                        delay_hours: followup.delay_hours,
                        message_template: followup.message_template,
                        send_after_hour: followup.send_after_hour,
                        send_before_hour: followup.send_before_hour,
                        is_active: followup.is_active,
                        skip_if_qualified: followup.skip_if_qualified
                    })
                    .eq('id', followup.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('agent_followups')
                    .insert(followup);
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
                        Configure mensagens automáticas para reengajar leads inativos
                    </p>
                </div>
                <Button onClick={addFollowup} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                </Button>
            </div>

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
    const [form, setForm] = useState(followup);

    useEffect(() => {
        setForm(followup);
    }, [followup]);

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
                                    ({followup.send_after_hour}h - {followup.send_before_hour}h)
                                </span>
                            </div>
                            <p className="text-sm line-clamp-2">{followup.message_template}</p>
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
                        <Label>Enviar após</Label>
                        <Input
                            type="number"
                            min={0}
                            max={23}
                            value={form.send_after_hour}
                            onChange={(e) => setForm({ ...form, send_after_hour: parseInt(e.target.value) || 8 })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Enviar até</Label>
                        <Input
                            type="number"
                            min={0}
                            max={23}
                            value={form.send_before_hour}
                            onChange={(e) => setForm({ ...form, send_before_hour: parseInt(e.target.value) || 20 })}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Mensagem</Label>
                    <Textarea
                        value={form.message_template}
                        onChange={(e) => setForm({ ...form, message_template: e.target.value })}
                        rows={3}
                        placeholder="Use {{nome}}, {{bairro}}, etc."
                    />
                </div>

                <div className="flex items-center gap-6">
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
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                    <Button onClick={() => onSave(form)}>
                        <Save className="h-4 w-4 mr-1" />
                        Salvar
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

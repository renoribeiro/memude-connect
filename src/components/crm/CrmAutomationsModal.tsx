import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Zap } from 'lucide-react';
import type { CrmStage, CrmAutomation } from '@/hooks/useCrmPipeline';

const TRIGGER_TYPES = [
    { value: 'visit_status_change', label: 'Status da visita mudou para' },
    { value: 'lead_status_change', label: 'Status do lead mudou para' },
];

const VISIT_STATUSES = [
    { value: 'agendada', label: 'Agendada' },
    { value: 'confirmada', label: 'Confirmada' },
    { value: 'realizada', label: 'Realizada' },
    { value: 'cancelada', label: 'Cancelada' },
    { value: 'reagendada', label: 'Reagendada' },
];

const LEAD_STATUSES = [
    { value: 'novo', label: 'Novo' },
    { value: 'buscando_corretor', label: 'Em Contato' },
    { value: 'visita_agendada', label: 'Visita Agendada' },
    { value: 'visita_realizada', label: 'Visita Realizada' },
    { value: 'cancelado', label: 'Cancelado' },
    { value: 'follow_up', label: 'Follow-up' },
];

interface CrmAutomationsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    automations: CrmAutomation[];
    stages: CrmStage[];
    onCreateAutomation: (data: {
        nome: string;
        trigger_type: string;
        trigger_value?: string;
        target_stage_id: string;
    }) => void;
    onToggleAutomation: (id: string, is_active: boolean) => void;
    onDeleteAutomation: (id: string) => void;
    isCreating?: boolean;
}

export default function CrmAutomationsModal({
    open,
    onOpenChange,
    automations,
    stages,
    onCreateAutomation,
    onToggleAutomation,
    onDeleteAutomation,
    isCreating,
}: CrmAutomationsModalProps) {
    const [showForm, setShowForm] = useState(false);
    const [nome, setNome] = useState('');
    const [triggerType, setTriggerType] = useState('');
    const [triggerValue, setTriggerValue] = useState('');
    const [targetStageId, setTargetStageId] = useState('');

    const triggerValueOptions =
        triggerType === 'visit_status_change'
            ? VISIT_STATUSES
            : triggerType === 'lead_status_change'
                ? LEAD_STATUSES
                : [];

    const handleCreate = () => {
        if (!nome || !triggerType || !targetStageId) return;
        onCreateAutomation({
            nome,
            trigger_type: triggerType,
            trigger_value: triggerValue || undefined,
            target_stage_id: targetStageId,
        });
        setShowForm(false);
        setNome('');
        setTriggerType('');
        setTriggerValue('');
        setTargetStageId('');
    };

    const getTriggerLabel = (type: string) =>
        TRIGGER_TYPES.find((t) => t.value === type)?.label ?? type;

    const getTriggerValueLabel = (type: string, value: string | null) => {
        if (!value) return '';
        const list = type === 'visit_status_change' ? VISIT_STATUSES : LEAD_STATUSES;
        return list.find((s) => s.value === value)?.label ?? value;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        Automações do CRM
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Existing Automations */}
                    {automations.length > 0 ? (
                        <div className="space-y-2">
                            {automations.map((auto) => (
                                <div
                                    key={auto.id}
                                    className="flex items-center justify-between p-3 border rounded-lg bg-white"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium truncate">{auto.nome}</p>
                                            <Badge variant={auto.is_active ? 'default' : 'secondary'} className="text-[10px]">
                                                {auto.is_active ? 'Ativa' : 'Inativa'}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Quando: {getTriggerLabel(auto.trigger_type)}{' '}
                                            <span className="font-medium">
                                                {getTriggerValueLabel(auto.trigger_type, auto.trigger_value)}
                                            </span>{' '}
                                            → Mover para{' '}
                                            <span className="font-medium">
                                                {auto.crm_stages?.nome ?? 'Etapa removida'}
                                            </span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2">
                                        <Switch
                                            checked={auto.is_active}
                                            onCheckedChange={(v) => onToggleAutomation(auto.id, v)}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive"
                                            onClick={() => onDeleteAutomation(auto.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        !showForm && (
                            <div className="text-center py-6 text-sm text-muted-foreground">
                                <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                Nenhuma automação configurada
                            </div>
                        )
                    )}

                    {/* Create Form */}
                    {showForm ? (
                        <div className="border rounded-lg p-4 bg-gray-50/50 space-y-3">
                            <div>
                                <Label>Nome da automação</Label>
                                <Input
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    placeholder="Ex: Visita realizada → Proposta"
                                />
                            </div>

                            <div>
                                <Label>Quando (Trigger)</Label>
                                <Select value={triggerType} onValueChange={setTriggerType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o trigger" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TRIGGER_TYPES.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {triggerType && triggerValueOptions.length > 0 && (
                                <div>
                                    <Label>Valor do trigger</Label>
                                    <Select value={triggerValue} onValueChange={setTriggerValue}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o valor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {triggerValueOptions.map((s) => (
                                                <SelectItem key={s.value} value={s.value}>
                                                    {s.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div>
                                <Label>Mover para etapa</Label>
                                <Select value={targetStageId} onValueChange={setTargetStageId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione a etapa" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {stages.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full"
                                                        style={{ backgroundColor: s.cor }}
                                                    />
                                                    {s.nome}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-2 pt-1">
                                <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="flex-1">
                                    Cancelar
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleCreate}
                                    disabled={isCreating || !nome || !triggerType || !targetStageId}
                                    className="flex-1"
                                >
                                    Salvar
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Nova Automação
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

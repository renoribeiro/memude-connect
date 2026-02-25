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
import { Switch } from '@/components/ui/switch';
import { Plus, GripVertical, Trash2, Palette } from 'lucide-react';
import type { CrmStage } from '@/hooks/useCrmPipeline';

const PRESET_COLORS = [
    '#6366f1', '#3b82f6', '#22c55e', '#f59e0b',
    '#ef4444', '#ec4899', '#8b5cf6', '#f97316',
    '#14b8a6', '#64748b',
];

interface PipelineSettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pipelineName: string;
    pipelineDescription: string;
    autoAddVisits: boolean;
    stages: CrmStage[];
    onSave: (data: {
        nome: string;
        descricao: string;
        auto_add_visits: boolean;
        stages: Array<{
            id?: string;
            pipeline_id: string;
            nome: string;
            cor: string;
            posicao: number;
            is_final?: boolean;
        }>;
    }) => void;
    pipelineId: string;
    isSaving?: boolean;
}

interface StageItem {
    id?: string;
    nome: string;
    cor: string;
    is_final: boolean;
}

export default function PipelineSettingsModal({
    open,
    onOpenChange,
    pipelineName,
    pipelineDescription,
    autoAddVisits,
    stages: initialStages,
    onSave,
    pipelineId,
    isSaving,
}: PipelineSettingsModalProps) {
    const [nome, setNome] = useState(pipelineName);
    const [descricao, setDescricao] = useState(pipelineDescription);
    const [autoAdd, setAutoAdd] = useState(autoAddVisits);
    const [editStages, setEditStages] = useState<StageItem[]>(() =>
        initialStages.map((s) => ({
            id: s.id,
            nome: s.nome,
            cor: s.cor,
            is_final: s.is_final,
        }))
    );
    const [colorPickerIndex, setColorPickerIndex] = useState<number | null>(null);

    // Reset state when modal opens
    const handleOpenChange = (v: boolean) => {
        if (v) {
            setNome(pipelineName);
            setDescricao(pipelineDescription);
            setAutoAdd(autoAddVisits);
            setEditStages(
                initialStages.map((s) => ({
                    id: s.id,
                    nome: s.nome,
                    cor: s.cor,
                    is_final: s.is_final,
                }))
            );
        }
        onOpenChange(v);
    };

    const addStage = () => {
        setEditStages([
            ...editStages,
            { nome: '', cor: PRESET_COLORS[editStages.length % PRESET_COLORS.length], is_final: false },
        ]);
    };

    const removeStage = (index: number) => {
        setEditStages(editStages.filter((_, i) => i !== index));
    };

    const updateStage = (index: number, field: keyof StageItem, value: string | boolean) => {
        setEditStages(
            editStages.map((s, i) => (i === index ? { ...s, [field]: value } : s))
        );
    };

    const moveStage = (from: number, to: number) => {
        if (to < 0 || to >= editStages.length) return;
        const updated = [...editStages];
        const [removed] = updated.splice(from, 1);
        updated.splice(to, 0, removed);
        setEditStages(updated);
    };

    const handleSave = () => {
        const validStages = editStages.filter((s) => s.nome.trim());
        onSave({
            nome,
            descricao,
            auto_add_visits: autoAdd,
            stages: validStages.map((s, i) => ({
                id: s.id,
                pipeline_id: pipelineId,
                nome: s.nome.trim(),
                cor: s.cor,
                posicao: i,
                is_final: s.is_final,
            })),
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Configurações do Pipeline</DialogTitle>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Pipeline Info */}
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="pipeline-name">Nome do Pipeline</Label>
                            <Input
                                id="pipeline-name"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                placeholder="Ex: Funil de Vendas"
                            />
                        </div>
                        <div>
                            <Label htmlFor="pipeline-desc">Descrição</Label>
                            <Input
                                id="pipeline-desc"
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                placeholder="Opcional"
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <p className="text-sm font-medium">Auto-adicionar leads com visita</p>
                                <p className="text-xs text-muted-foreground">
                                    Leads com visitas agendadas entram automaticamente
                                </p>
                            </div>
                            <Switch checked={autoAdd} onCheckedChange={setAutoAdd} />
                        </div>
                    </div>

                    {/* Stages */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label>Etapas do Funil</Label>
                            <Button variant="ghost" size="sm" onClick={addStage}>
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Adicionar
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {editStages.map((stage, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2 p-2 border rounded-lg bg-white"
                                >
                                    <div className="flex flex-col gap-0.5">
                                        <button
                                            onClick={() => moveStage(index, index - 1)}
                                            disabled={index === 0}
                                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                        >
                                            <GripVertical className="h-3.5 w-3" />
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <button
                                            className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                                            style={{ backgroundColor: stage.cor }}
                                            onClick={() =>
                                                setColorPickerIndex(colorPickerIndex === index ? null : index)
                                            }
                                        >
                                            <Palette className="h-3 w-3 text-white/70 mx-auto" />
                                        </button>
                                        {colorPickerIndex === index && (
                                            <div className="absolute top-8 left-0 z-50 bg-white border rounded-lg shadow-lg p-2 grid grid-cols-5 gap-1">
                                                {PRESET_COLORS.map((color) => (
                                                    <button
                                                        key={color}
                                                        className="w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform"
                                                        style={{
                                                            backgroundColor: color,
                                                            borderColor: stage.cor === color ? '#000' : 'transparent',
                                                        }}
                                                        onClick={() => {
                                                            updateStage(index, 'cor', color);
                                                            setColorPickerIndex(null);
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <Input
                                        value={stage.nome}
                                        onChange={(e) => updateStage(index, 'nome', e.target.value)}
                                        placeholder={`Etapa ${index + 1}`}
                                        className="h-8 text-sm flex-1"
                                    />

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={() => removeStage(index)}
                                        disabled={editStages.length <= 1}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => handleOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || !nome.trim()}>
                        {isSaving ? 'Salvando...' : 'Salvar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

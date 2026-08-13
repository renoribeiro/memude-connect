import { useEffect, useState } from 'react';
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
    '#059669', '#10b981', '#34d399', '#0d9488',
    '#14b8a6', '#2dd4bf', '#0891b2', '#06b6d4',
    '#22d3ee', '#64748b',
];

interface PipelineSettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pipelineName: string;
    pipelineDescription: string;
    autoAddVisits: boolean;
    isDefault: boolean;
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
    onDelete?: () => void;
    pipelineId: string;
    isSaving?: boolean;
}

interface StageItem {
    clientKey: string;
    id?: string;
    nome: string;
    cor: string;
    is_final: boolean;
}

function toEditableStage(stage: CrmStage): StageItem {
    return {
        clientKey: stage.id,
        id: stage.id,
        nome: stage.nome,
        cor: stage.cor,
        is_final: stage.is_final,
    };
}

export default function PipelineSettingsModal({
    open,
    onOpenChange,
    pipelineName,
    pipelineDescription,
    autoAddVisits,
    isDefault,
    stages: initialStages,
    onSave,
    onDelete,
    pipelineId,
    isSaving,
}: PipelineSettingsModalProps) {
    const [nome, setNome] = useState(pipelineName);
    const [descricao, setDescricao] = useState(pipelineDescription);
    const [autoAdd, setAutoAdd] = useState(autoAddVisits);
    const [editStages, setEditStages] = useState<StageItem[]>(() =>
        initialStages.map(toEditableStage)
    );
    const [colorPickerIndex, setColorPickerIndex] = useState<number | null>(null);
    const [validationError, setValidationError] = useState('');

    // O Dialog é controlado pelo componente pai. Portanto, abrir por meio da
    // prop `open` não dispara necessariamente onOpenChange(true). Hidratamos o
    // estado aqui, inclusive quando a consulta de etapas termina após a abertura.
    useEffect(() => {
        if (!open) return;

        setNome(pipelineName);
        setDescricao(pipelineDescription);
        setAutoAdd(autoAddVisits);
        setEditStages(initialStages.map(toEditableStage));
        setColorPickerIndex(null);
        setValidationError('');
    }, [
        open,
        pipelineId,
        pipelineName,
        pipelineDescription,
        autoAddVisits,
        initialStages,
    ]);

    const handleOpenChange = (v: boolean) => {
        onOpenChange(v);
    };

    const addStage = () => {
        setValidationError('');
        setEditStages((current) => [
            ...current,
            {
                clientKey: crypto.randomUUID(),
                nome: '',
                cor: PRESET_COLORS[current.length % PRESET_COLORS.length],
                is_final: false,
            },
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
        if (!nome.trim()) {
            setValidationError('Informe o nome do pipeline.');
            return;
        }

        if (editStages.length === 0) {
            setValidationError('O pipeline deve ter pelo menos uma etapa.');
            return;
        }

        if (editStages.some((stage) => !stage.nome.trim())) {
            setValidationError('Preencha o nome de todas as etapas antes de salvar.');
            return;
        }

        setValidationError('');
        onSave({
            nome: nome.trim(),
            descricao: descricao.trim(),
            auto_add_visits: autoAdd,
            stages: editStages.map((s, i) => ({
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
                            <Button type="button" variant="ghost" size="sm" onClick={addStage}>
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Adicionar
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {editStages.map((stage, index) => (
                                <div
                                    key={stage.clientKey}
                                    className="flex items-center gap-2 p-2 border rounded-lg bg-white"
                                >
                                    <div className="flex flex-col gap-0.5">
                                        <button
                                            type="button"
                                            onClick={() => moveStage(index, index - 1)}
                                            disabled={index === 0}
                                            aria-label={`Mover ${stage.nome || `etapa ${index + 1}`} para cima`}
                                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                        >
                                            <GripVertical className="h-3.5 w-3" />
                                        </button>
                                    </div>

                                    <div className="relative flex-shrink-0">
                                        <button
                                            type="button"
                                            aria-label={`Escolher cor de ${stage.nome || `etapa ${index + 1}`}`}
                                            className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                                            style={{ backgroundColor: stage.cor }}
                                            onClick={() =>
                                                setColorPickerIndex(colorPickerIndex === index ? null : index)
                                            }
                                        >
                                            <Palette className="h-3 w-3 text-white/70 mx-auto" />
                                        </button>
                                        {colorPickerIndex === index && (
                                            <div className="absolute top-full left-0 mt-2 z-[100] bg-white border border-gray-200 rounded-xl shadow-xl p-3 grid grid-cols-5 gap-2 w-max animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95">
                                                {PRESET_COLORS.map((color) => (
                                                    <button
                                                        type="button"
                                                        key={color}
                                                        aria-label={`Usar a cor ${color}`}
                                                        className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                                                        style={{
                                                            backgroundColor: color,
                                                            boxShadow: stage.cor === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : 'none'
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
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={() => removeStage(index)}
                                        disabled={editStages.length <= 1}
                                        aria-label={`Remover ${stage.nome || `etapa ${index + 1}`}`}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        {validationError && (
                            <p role="alert" className="mt-2 text-sm text-destructive">
                                {validationError}
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <div className="flex w-full items-center justify-between">
                        {/* Area for Deletion */}
                        <div>
                            {!isDefault && onDelete && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => {
                                        if (window.confirm('Tem certeza que deseja excluir este funil? Todos os leads atrelados a ele ficarão sem funil definido.')) {
                                            onDelete();
                                        }
                                    }}
                                >
                                    Excluir Funil
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving || !nome.trim() || editStages.length === 0}
                            >
                                {isSaving ? 'Salvando...' : 'Salvar'}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

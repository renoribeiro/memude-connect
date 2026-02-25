import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Search, UserPlus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CrmStage } from '@/hooks/useCrmPipeline';

interface Lead {
    id: string;
    nome: string;
    telefone: string;
    email: string | null;
    status: string;
    empreendimentos: { nome: string } | null;
}

interface AddLeadToPipelineModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pipelineId: string;
    stages: CrmStage[];
    existingLeadIds: string[];
    onAdd: (leadId: string, stageId: string, valorEstimado?: number, notas?: string) => void;
    isAdding?: boolean;
}

export default function AddLeadToPipelineModal({
    open,
    onOpenChange,
    pipelineId,
    stages,
    existingLeadIds,
    onAdd,
    isAdding,
}: AddLeadToPipelineModalProps) {
    const [search, setSearch] = useState('');
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [selectedStageId, setSelectedStageId] = useState<string>('');
    const [valorEstimado, setValorEstimado] = useState('');

    const { data: availableLeads = [], isLoading } = useQuery({
        queryKey: ['available-leads-for-crm', search, existingLeadIds],
        queryFn: async () => {
            let query = supabase
                .from('leads')
                .select('id, nome, telefone, email, status, empreendimentos(nome)')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(50);

            if (search) {
                query = query.or(
                    `nome.ilike.%${search}%,telefone.ilike.%${search}%,email.ilike.%${search}%`
                );
            }

            const { data, error } = await query;
            if (error) throw error;

            // Filter out leads already in this pipeline
            return (data as Lead[]).filter((l) => !existingLeadIds.includes(l.id));
        },
        enabled: open,
    });

    const handleAdd = () => {
        if (!selectedLeadId || !selectedStageId) return;
        const valor = valorEstimado ? parseFloat(valorEstimado) : undefined;
        onAdd(selectedLeadId, selectedStageId, valor);
        // Reset
        setSelectedLeadId(null);
        setValorEstimado('');
    };

    const defaultStageId = stages.length > 0 ? stages[0].id : '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[85vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Adicionar Lead ao Funil
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar leads por nome, telefone ou email..."
                            className="pl-10"
                        />
                    </div>

                    {/* Lead List */}
                    <ScrollArea className="h-[200px] border rounded-lg">
                        <div className="p-1">
                            {isLoading ? (
                                <div className="text-center py-8 text-sm text-muted-foreground">
                                    Carregando...
                                </div>
                            ) : availableLeads.length === 0 ? (
                                <div className="text-center py-8 text-sm text-muted-foreground">
                                    {search ? 'Nenhum lead encontrado' : 'Todos os leads já estão no funil'}
                                </div>
                            ) : (
                                availableLeads.map((lead) => (
                                    <button
                                        key={lead.id}
                                        onClick={() => setSelectedLeadId(lead.id)}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedLeadId === lead.id
                                                ? 'bg-primary text-white'
                                                : 'hover:bg-gray-50'
                                            }`}
                                    >
                                        <p className="font-medium">{lead.nome}</p>
                                        <p
                                            className={`text-xs ${selectedLeadId === lead.id
                                                    ? 'text-white/80'
                                                    : 'text-muted-foreground'
                                                }`}
                                        >
                                            {lead.telefone}
                                            {lead.empreendimentos && ` · ${lead.empreendimentos.nome}`}
                                        </p>
                                    </button>
                                ))
                            )}
                        </div>
                    </ScrollArea>

                    {/* Stage Selection */}
                    <div>
                        <Label>Etapa inicial</Label>
                        <Select
                            value={selectedStageId || defaultStageId}
                            onValueChange={setSelectedStageId}
                        >
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

                    {/* Valor estimado (optional) */}
                    <div>
                        <Label>Valor estimado (R$) - Opcional</Label>
                        <Input
                            type="number"
                            value={valorEstimado}
                            onChange={(e) => setValorEstimado(e.target.value)}
                            placeholder="0,00"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleAdd}
                        disabled={!selectedLeadId || isAdding}
                    >
                        {isAdding ? 'Adicionando...' : 'Adicionar ao Funil'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

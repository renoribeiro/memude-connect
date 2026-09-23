import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BriefcaseBusiness, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CreateOpportunityInput, CrmStage } from '@/hooks/useCrmPipeline';

const NO_SELECTION = '__none__';

interface LeadOption {
    id: string;
    nome: string;
    telefone: string;
    email: string | null;
}

interface CreateOpportunityModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    stages: CrmStage[];
    isCreating: boolean;
    onCreate: (input: CreateOpportunityInput) => void;
}

export default function CreateOpportunityModal({
    open,
    onOpenChange,
    stages,
    isCreating,
    onCreate,
}: CreateOpportunityModalProps) {
    const [search, setSearch] = useState('');
    const [leadId, setLeadId] = useState('');
    const [stageId, setStageId] = useState('');
    const [empreendimentoId, setEmpreendimentoId] = useState('');
    const [valorEstimado, setValorEstimado] = useState('');
    const [notas, setNotas] = useState('');
    const debouncedSearch = useDebounce(search, 350);

    useEffect(() => {
        if (!open) return;
        setSearch('');
        setLeadId('');
        setStageId(stages[0]?.id ?? '');
        setEmpreendimentoId('');
        setValorEstimado('');
        setNotas('');
    }, [open, stages]);

    const { data: leads = [], isLoading: isLoadingLeads } = useQuery({
        queryKey: ['available-leads-for-opportunity', debouncedSearch],
        queryFn: async ({ signal }) => {
            let query = supabase
                .from('leads')
                .select('id, nome, telefone, email')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(50)
                .abortSignal(signal);

            const safeSearch = debouncedSearch.replace(/[,%()]/g, ' ').trim();
            if (safeSearch) {
                query = query.or(
                    `nome.ilike.%${safeSearch}%,telefone.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`,
                );
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as LeadOption[];
        },
        enabled: open,
    });

    const { data: empreendimentos = [] } = useQuery({
        queryKey: ['empreendimentos-select'],
        queryFn: async ({ signal }) => {
            const { data, error } = await supabase
                .from('empreendimentos')
                .select('id, nome')
                .eq('ativo', true)
                .order('nome')
                .limit(500)
                .abortSignal(signal);
            if (error) throw error;
            return data;
        },
        enabled: open,
    });

    const numericValue = valorEstimado === '' ? undefined : Number(valorEstimado);
    const isValueValid = numericValue === undefined || (Number.isFinite(numericValue) && numericValue >= 0);
    const canSubmit = Boolean(leadId && stageId && isValueValid && !isCreating);

    const handleSubmit = () => {
        if (!canSubmit) return;
        onCreate({
            leadId,
            stageId,
            empreendimentoId: empreendimentoId || undefined,
            valorEstimado: numericValue,
            notas: notas.trim() || undefined,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BriefcaseBusiness className="h-5 w-5" />
                        Gerar Oportunidade
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="opportunity-lead-search">Lead *</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="opportunity-lead-search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Buscar por nome, telefone ou e-mail"
                                className="pl-10"
                            />
                        </div>
                        <ScrollArea className="h-40 rounded-md border">
                            <div className="p-1">
                                {isLoadingLeads ? (
                                    <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
                                ) : leads.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-muted-foreground">Nenhum lead ativo encontrado.</p>
                                ) : leads.map((lead) => (
                                    <button
                                        key={lead.id}
                                        type="button"
                                        onClick={() => setLeadId(lead.id)}
                                        aria-pressed={leadId === lead.id}
                                        className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                            leadId === lead.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                                        }`}
                                    >
                                        <span className="block font-medium">{lead.nome}</span>
                                        <span className={`block text-xs ${leadId === lead.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                            {lead.telefone}{lead.email ? ` · ${lead.email}` : ''}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Etapa inicial *</Label>
                            <Select value={stageId} onValueChange={setStageId}>
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                    {stages.map((stage) => (
                                        <SelectItem key={stage.id} value={stage.id}>{stage.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="opportunity-value">Valor previsto (R$)</Label>
                            <Input
                                id="opportunity-value"
                                type="number"
                                min="0"
                                step="0.01"
                                value={valorEstimado}
                                onChange={(event) => setValorEstimado(event.target.value)}
                                placeholder="0,00"
                                aria-invalid={!isValueValid}
                            />
                            {!isValueValid ? <p className="text-xs text-destructive">Informe um valor válido.</p> : null}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Empreendimento da oportunidade</Label>
                        <Select
                            value={empreendimentoId || NO_SELECTION}
                            onValueChange={(value) => setEmpreendimentoId(value === NO_SELECTION ? '' : value)}
                        >
                            <SelectTrigger><SelectValue placeholder="Selecione o empreendimento" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_SELECTION}>Sem empreendimento definido</SelectItem>
                                {empreendimentos.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="opportunity-notes">Notas da oportunidade</Label>
                        <Textarea
                            id="opportunity-notes"
                            value={notas}
                            onChange={(event) => setNotas(event.target.value)}
                            rows={3}
                            maxLength={4000}
                            placeholder="Contexto específico desta negociação"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
                        {isCreating ? 'Criando...' : 'Gerar Oportunidade'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

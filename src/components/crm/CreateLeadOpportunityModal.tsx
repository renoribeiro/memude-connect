import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { isValidBrazilianPhone } from '@/utils/phoneHelpers';
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
import { PhoneInput } from '@/components/ui/phone-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CreateLeadOpportunityInput, CrmStage } from '@/hooks/useCrmPipeline';

const origins = ['website', 'facebook', 'instagram', 'google', 'indicacao', 'whatsapp', 'outro'];
const NO_SELECTION = '__none__';

interface CreateLeadOpportunityModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    stages: CrmStage[];
    isCreating: boolean;
    onCreate: (input: CreateLeadOpportunityInput) => void;
}

export default function CreateLeadOpportunityModal({
    open,
    onOpenChange,
    stages,
    isCreating,
    onCreate,
}: CreateLeadOpportunityModalProps) {
    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');
    const [email, setEmail] = useState('');
    const [origem, setOrigem] = useState('website');
    const [observacoes, setObservacoes] = useState('');
    const [corretorId, setCorretorId] = useState('');
    const [stageId, setStageId] = useState('');
    const [empreendimentoId, setEmpreendimentoId] = useState('');
    const [valorEstimado, setValorEstimado] = useState('');
    const [notas, setNotas] = useState('');

    useEffect(() => {
        if (!open) return;
        setNome('');
        setTelefone('');
        setEmail('');
        setOrigem('website');
        setObservacoes('');
        setCorretorId('');
        setStageId(stages[0]?.id ?? '');
        setEmpreendimentoId('');
        setValorEstimado('');
        setNotas('');
    }, [open, stages]);

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

    const { data: corretores = [] } = useQuery({
        queryKey: ['corretores-select'],
        queryFn: async ({ signal }) => {
            const { data, error } = await supabase
                .from('corretores')
                .select('id, profiles(first_name, last_name)')
                .eq('status', 'ativo')
                .limit(500)
                .abortSignal(signal);
            if (error) throw error;
            return data;
        },
        enabled: open,
    });

    const parsedValue = valorEstimado === '' ? undefined : Number(valorEstimado);
    const isValueValid = parsedValue === undefined || (Number.isFinite(parsedValue) && parsedValue >= 0);
    const isEmailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isPhoneValid = isValidBrazilianPhone(telefone);
    const canSubmit = Boolean(nome.trim().length >= 2 && isPhoneValid && isEmailValid && stageId && isValueValid && !isCreating);

    const handleSubmit = () => {
        if (!canSubmit) return;
        onCreate({
            nome: nome.trim(),
            telefone,
            email: email.trim() || undefined,
            origem,
            observacoes: observacoes.trim() || undefined,
            corretorDesignadoId: corretorId || undefined,
            stageId,
            empreendimentoId: empreendimentoId || undefined,
            valorEstimado: parsedValue,
            notas: notas.trim() || undefined,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Adicionar Lead ao Funil
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5">
                    <section className="space-y-3" aria-labelledby="new-lead-section">
                        <h3 id="new-lead-section" className="text-sm font-semibold">Dados do novo lead</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="funnel-lead-name">Nome *</Label>
                                <Input id="funnel-lead-name" value={nome} onChange={(event) => setNome(event.target.value)} maxLength={150} />
                            </div>
                            <div className="space-y-2">
                                <Label>Telefone *</Label>
                                <PhoneInput value={telefone} onChange={setTelefone} placeholder="(85) 99999-9999" />
                                {telefone && !isPhoneValid ? <p className="text-xs text-destructive">Informe um celular brasileiro válido.</p> : null}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="funnel-lead-email">E-mail</Label>
                                <Input id="funnel-lead-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} />
                                {!isEmailValid ? <p className="text-xs text-destructive">Informe um e-mail válido.</p> : null}
                            </div>
                            <div className="space-y-2">
                                <Label>Origem *</Label>
                                <Select value={origem} onValueChange={setOrigem}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {origins.map((item) => (
                                            <SelectItem key={item} value={item}>{item === 'indicacao' ? 'Indicação' : item.charAt(0).toUpperCase() + item.slice(1)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label>Corretor designado</Label>
                                <Select
                                    value={corretorId || NO_SELECTION}
                                    onValueChange={(value) => setCorretorId(value === NO_SELECTION ? '' : value)}
                                >
                                    <SelectTrigger><SelectValue placeholder="Distribuição automática" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NO_SELECTION}>Distribuição automática</SelectItem>
                                        {corretores.map((corretor) => (
                                            <SelectItem key={corretor.id} value={corretor.id}>
                                                {corretor.profiles?.first_name} {corretor.profiles?.last_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="funnel-lead-notes">Observações do lead</Label>
                                <Textarea id="funnel-lead-notes" value={observacoes} onChange={(event) => setObservacoes(event.target.value)} rows={2} maxLength={4000} />
                            </div>
                        </div>
                    </section>

                    <section className="space-y-3 border-t pt-4" aria-labelledby="new-opportunity-section">
                        <h3 id="new-opportunity-section" className="text-sm font-semibold">Primeira oportunidade</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Etapa inicial *</Label>
                                <Select value={stageId} onValueChange={setStageId}>
                                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>{stages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.nome}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="funnel-opportunity-value">Valor previsto (R$)</Label>
                                <Input id="funnel-opportunity-value" type="number" min="0" step="0.01" value={valorEstimado} onChange={(event) => setValorEstimado(event.target.value)} aria-invalid={!isValueValid} />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label>Empreendimento da oportunidade</Label>
                                <Select
                                    value={empreendimentoId || NO_SELECTION}
                                    onValueChange={(value) => setEmpreendimentoId(value === NO_SELECTION ? '' : value)}
                                >
                                    <SelectTrigger><SelectValue placeholder="Selecione o empreendimento" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NO_SELECTION}>Sem empreendimento definido</SelectItem>
                                        {empreendimentos.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="funnel-opportunity-notes">Notas da oportunidade</Label>
                                <Textarea id="funnel-opportunity-notes" value={notas} onChange={(event) => setNotas(event.target.value)} rows={2} maxLength={4000} />
                            </div>
                        </div>
                    </section>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
                        {isCreating ? 'Cadastrando...' : 'Criar Lead e Oportunidade'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

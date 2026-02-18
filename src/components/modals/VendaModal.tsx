import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, DollarSign, TrendingDown, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/utils/formatters';

interface VendaModalProps {
    isOpen: boolean;
    onClose: () => void;
    vendaId: string | null;
}

vendaId: string | null;
}

const VendaModal = ({ isOpen, onClose, vendaId }: VendaModalProps) => {
    const { profile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const isEditing = !!vendaId;

    // Form state
    const [leadId, setLeadId] = useState('');
    const [empreendimentoId, setEmpreendimentoId] = useState('');
    const [corretorId, setCorretorId] = useState('');
    const [vendaDireta, setVendaDireta] = useState(false);
    const [valorImovel, setValorImovel] = useState('');
    const [comissaoPercentual, setComissaoPercentual] = useState('6');
    const [impostoPercentual, setImpostoPercentual] = useState('20');
    const [status, setStatus] = useState('pendente');
    const [dataVenda, setDataVenda] = useState<Date>(new Date());
    const [dataPagamento, setDataPagamento] = useState<Date | undefined>();
    const [observacoes, setObservacoes] = useState('');

    // Fetch system settings for defaults
    const { data: settings } = useQuery({
        queryKey: ['system-settings-financeiro'],
        queryFn: async () => {
            const { data } = await supabase
                .from('system_settings')
                .select('key, value')
                .in('key', ['tax_rate_percentage', 'default_commission_percentage']);
            return data || [];
        },
    });

    // Fetch leads
    const { data: leads = [] } = useQuery({
        queryKey: ['leads-for-venda'],
        queryFn: async () => {
            const { data } = await supabase
                .from('leads')
                .select('id, nome, telefone, empreendimento_id, corretor_designado_id')
                .order('nome');
            return data || [];
        },
    });

    // Fetch empreendimentos
    const { data: empreendimentos = [] } = useQuery({
        queryKey: ['empreendimentos-for-venda'],
        queryFn: async () => {
            const { data } = await supabase
                .from('empreendimentos')
                .select('id, nome, valor_min, valor_max')
                .eq('ativo', true)
                .order('nome');
            return data || [];
        },
    });

    // Fetch corretores
    const { data: corretores = [] } = useQuery({
        queryKey: ['corretores-for-venda'],
        queryFn: async () => {
            const { data } = await supabase
                .from('corretores')
                .select('id, nome')
                .eq('status', 'ativo')
                .order('nome');
            return data || [];
        },
    });

    // Fetch existing venda for editing
    const { data: vendaData } = useQuery({
        queryKey: ['venda-detail', vendaId],
        queryFn: async () => {
            if (!vendaId) return null;
            const { data, error } = await supabase
                .from('vendas')
                .select('*')
                .eq('id', vendaId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!vendaId,
    });

    // Set defaults from settings
    useEffect(() => {
        if (settings && !vendaId) {
            const taxRate = settings.find(s => s.key === 'tax_rate_percentage');
            const commRate = settings.find(s => s.key === 'default_commission_percentage');
            if (taxRate) setImpostoPercentual(taxRate.value);
            if (commRate) setComissaoPercentual(commRate.value);
        }
    }, [settings, vendaId]);

    // Fill form when editing
    useEffect(() => {
        if (vendaData) {
            setLeadId(vendaData.lead_id || '');
            setEmpreendimentoId(vendaData.empreendimento_id || '');
            setCorretorId(vendaData.corretor_id || '');
            setVendaDireta(vendaData.is_venda_direta || false);
            setValorImovel(String(vendaData.valor_imovel || ''));
            setComissaoPercentual(String(vendaData.comissao_percentual || '6'));
            setImpostoPercentual(String(vendaData.imposto_percentual || '20'));
            setStatus(vendaData.status || 'pendente');
            setDataVenda(vendaData.data_venda ? new Date(vendaData.data_venda + 'T12:00:00') : new Date());
            setDataPagamento(vendaData.data_pagamento ? new Date(vendaData.data_pagamento + 'T12:00:00') : undefined);
            setObservacoes(vendaData.observacoes || '');
        }
    }, [vendaData]);

    // Reset form on close
    useEffect(() => {
        if (!isOpen) {
            setLeadId('');
            setEmpreendimentoId('');
            setCorretorId('');
            setVendaDireta(false);
            setValorImovel('');
            setComissaoPercentual('6');
            setImpostoPercentual('20');
            setStatus('pendente');
            setDataVenda(new Date());
            setDataPagamento(undefined);
            setObservacoes('');
        }
    }, [isOpen]);

    // Auto-fill empreendimento and corretor from lead
    useEffect(() => {
        if (leadId && !isEditing) {
            const lead = leads.find(l => l.id === leadId);
            if (lead) {
                if (lead.empreendimento_id) setEmpreendimentoId(lead.empreendimento_id);
                if (lead.corretor_designado_id) setCorretorId(lead.corretor_designado_id);
            }
        }
    }, [leadId, leads, isEditing]);

    // Real-time calculations
    const calculations = useMemo(() => {
        const valor = parseFloat(valorImovel) || 0;
        const comissao = parseFloat(comissaoPercentual) || 0;
        const imposto = parseFloat(impostoPercentual) || 0;

        const comissaoBruta = valor * comissao / 100;
        const valorImposto = comissaoBruta * imposto / 100;
        const comissaoLiquida = comissaoBruta - valorImposto;
        const valorCorretor = vendaDireta ? 0 : comissaoLiquida * 0.5;
        const valorMemude = vendaDireta ? comissaoLiquida : comissaoLiquida * 0.5;

        return { comissaoBruta, valorImposto, comissaoLiquida, valorCorretor, valorMemude };
    }, [valorImovel, comissaoPercentual, impostoPercentual, vendaDireta]);

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                lead_id: leadId,
                empreendimento_id: empreendimentoId,
                corretor_id: vendaDireta ? null : (corretorId || null),
                valor_imovel: parseFloat(valorImovel),
                comissao_percentual: parseFloat(comissaoPercentual),
                imposto_percentual: parseFloat(impostoPercentual),
                is_venda_direta: vendaDireta,
                status,
                data_venda: format(dataVenda, 'yyyy-MM-dd'),
                data_pagamento: dataPagamento ? format(dataPagamento, 'yyyy-MM-dd') : null,
                observacoes: observacoes || null,
                created_by: profile?.id,
            };

            if (isEditing) {
                const { error } = await supabase
                    .from('vendas')
                    .update(payload)
                    .eq('id', vendaId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('vendas')
                    .insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendas'] });
            toast({
                title: isEditing ? 'Venda atualizada' : 'Venda registrada',
                description: isEditing ? 'Os dados da venda foram atualizados.' : 'A venda foi registrada com sucesso.',
            });
            onClose();
        },
        onError: (error: Error) => {
            toast({
                title: 'Erro ao salvar venda',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!leadId || !empreendimentoId || !valorImovel) {
            toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
            return;
        }

        const comissao = parseFloat(comissaoPercentual);
        const imposto = parseFloat(impostoPercentual);

        if (comissao < 0 || comissao > 100 || imposto < 0 || imposto > 100) {
            toast({ title: 'Porcentagens devem estar entre 0 e 100', variant: 'destructive' });
            return;
        }

        saveMutation.mutate();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        {isEditing ? 'Editar Venda' : 'Nova Venda'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Lead & Empreendimento */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="lead">Lead *</Label>
                            <Select value={leadId} onValueChange={setLeadId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o lead" />
                                </SelectTrigger>
                                <SelectContent>
                                    {leads.map(lead => (
                                        <SelectItem key={lead.id} value={lead.id}>
                                            {lead.nome} - {lead.telefone}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="empreendimento">Empreendimento *</Label>
                            <Select value={empreendimentoId} onValueChange={setEmpreendimentoId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o empreendimento" />
                                </SelectTrigger>
                                <SelectContent>
                                    {empreendimentos.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Corretor & Venda Direta */}
                    <div className="grid grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                            <Label htmlFor="corretor">Corretor</Label>
                            <Select
                                value={corretorId}
                                onValueChange={setCorretorId}
                                disabled={vendaDireta}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o corretor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {corretores.map(cor => (
                                        <SelectItem key={cor.id} value={cor.id}>
                                            {cor.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-3 pb-1">
                            <Switch
                                checked={vendaDireta}
                                onCheckedChange={(checked) => {
                                    setVendaDireta(checked);
                                    if (checked) setCorretorId('');
                                }}
                            />
                            <Label>Venda Direta</Label>
                            {vendaDireta && (
                                <Badge variant="secondary" className="text-xs">100% MeMude</Badge>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Valores */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="valor">Valor do Imóvel (R$) *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="500000.00"
                                value={valorImovel}
                                onChange={(e) => setValorImovel(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="comissao">Comissão (%)</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={comissaoPercentual}
                                onChange={(e) => setComissaoPercentual(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="imposto">Imposto (%)</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={impostoPercentual}
                                onChange={(e) => setImpostoPercentual(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Calculation Preview */}
                    {parseFloat(valorImovel) > 0 && (
                        <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 space-y-3">
                            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <TrendingDown className="h-4 w-4" />
                                Cálculo Automático
                            </h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Comissão Bruta:</span>
                                    <span className="font-mono font-medium">{formatCurrency(calculations.comissaoBruta)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Imposto:</span>
                                    <span className="font-mono font-medium text-red-500">
                                        - {formatCurrency(calculations.valorImposto)}
                                    </span>
                                </div>
                                <div className="flex justify-between col-span-2 pt-2 border-t">
                                    <span className="text-gray-700 font-medium">Comissão Líquida:</span>
                                    <span className="font-mono font-bold text-lg">{formatCurrency(calculations.comissaoLiquida)}</span>
                                </div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 flex items-center gap-1">
                                        <ArrowRight className="h-3 w-3" /> Corretor (50%):
                                    </span>
                                    <span className="font-mono font-semibold text-blue-600">
                                        {formatCurrency(calculations.valorCorretor)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 flex items-center gap-1">
                                        <ArrowRight className="h-3 w-3" /> MeMude ({vendaDireta ? '100%' : '50%'}):
                                    </span>
                                    <span className="font-mono font-semibold text-emerald-600">
                                        {formatCurrency(calculations.valorMemude)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* Datas & Status */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Data da Venda</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(dataVenda, 'dd/MM/yyyy', { locale: ptBR })}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={dataVenda}
                                        onSelect={(date) => date && setDataVenda(date)}
                                        locale={ptBR}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>Data de Pagamento</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dataPagamento
                                            ? format(dataPagamento, 'dd/MM/yyyy', { locale: ptBR })
                                            : 'Selecionar data'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={dataPagamento}
                                        onSelect={setDataPagamento}
                                        locale={ptBR}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pendente">Pendente</SelectItem>
                                    <SelectItem value="aprovada">Aprovada</SelectItem>
                                    <SelectItem value="paga">Paga</SelectItem>
                                    <SelectItem value="cancelada">Cancelada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Observações */}
                    <div className="space-y-2">
                        <Label htmlFor="observacoes">Observações</Label>
                        <Textarea
                            placeholder="Observações adicionais sobre a venda..."
                            value={observacoes}
                            onChange={(e) => setObservacoes(e.target.value)}
                            rows={3}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saveMutation.isPending} className="shadow-glow">
                            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditing ? 'Salvar Alterações' : 'Registrar Venda'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default VendaModal;

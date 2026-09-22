import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DollarSign,
    Search,
    Plus,
    TrendingUp,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Trash2,
} from 'lucide-react';
import VendaModal from '@/components/modals/VendaModal';
import { formatCurrency } from '@/utils/formatters';
import { toast } from 'sonner';

interface Venda {
    id: string;
    lead_id: string;
    empreendimento_id: string;
    corretor_id: string | null;
    valor_imovel: number;
    comissao_percentual: number;
    imposto_percentual: number;
    valor_comissao_bruta: number;
    valor_imposto: number;
    valor_comissao_liquida: number;
    valor_corretor: number;
    valor_memude: number;
    is_venda_direta: boolean;
    status: 'pendente' | 'aprovada' | 'paga' | 'cancelada';
    data_venda: string;
    data_pagamento: string | null;
    observacoes: string | null;
    created_at: string;
    leads: { nome: string; telefone: string } | null;
    empreendimentos: { nome: string } | null;
    corretores: { profiles: { first_name: string; last_name: string } } | null;
}

type VendaStatus = Venda['status'];

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pendente: { label: 'Pendente', variant: 'outline' },
    aprovada: { label: 'Aprovada', variant: 'secondary' },
    paga: { label: 'Paga', variant: 'default' },
    cancelada: { label: 'Cancelada', variant: 'destructive' },
};

const Vendas = () => {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedVendaId, setSelectedVendaId] = useState<string | null>(null);
    const [vendaToDelete, setVendaToDelete] = useState<Venda | null>(null);
    const [deleteFromFinance, setDeleteFromFinance] = useState(false);

    const { data: vendas = [], isLoading } = useQuery({
        queryKey: ['vendas', searchTerm, filterStatus],
        queryFn: async () => {
            let query = supabase
                .from('vendas')
                .select(`
          *,
          leads ( nome, telefone ),
          empreendimentos ( nome ),
          corretores ( profiles ( first_name, last_name ) )
        `)
                .order('created_at', { ascending: false });

            if (filterStatus && filterStatus !== 'all') {
                query = query.eq('status', filterStatus as VendaStatus);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (searchTerm) {
                return (data as Venda[]).filter(v =>
                    v.leads?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    v.empreendimentos?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (v.corretores?.profiles ? `${v.corretores.profiles.first_name} ${v.corretores.profiles.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) : false)
                );
            }

            return data as Venda[];
        },
    });

    const stats = useMemo(() => {
        const total = vendas.length;
        const pendentes = vendas.filter(v => v.status === 'pendente').length;
        const receitaMemude = vendas
            .filter(v => v.status === 'paga')
            .reduce((acc, v) => acc + Number(v.valor_memude), 0);
        const comissoesPagas = vendas
            .filter(v => v.status === 'paga')
            .reduce((acc, v) => acc + Number(v.valor_corretor), 0);

        return { total, pendentes, receitaMemude, comissoesPagas };
    }, [vendas]);

    const handleOpenModal = (vendaId?: string) => {
        setSelectedVendaId(vendaId || null);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedVendaId(null);
    };

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!vendaToDelete) throw new Error('Venda não selecionada');
            const { data, error } = await supabase.functions.invoke('delete-sale', {
                body: {
                    vendaId: vendaToDelete.id,
                    deleteFromFinance,
                },
            });
            if (error) throw error;
            return data as { finance: 'not_requested' | 'deleted' | 'pending' };
        },
        onSuccess: async (result) => {
            await queryClient.invalidateQueries({ queryKey: ['vendas'] });
            setVendaToDelete(null);
            setDeleteFromFinance(false);

            if (result.finance === 'deleted') {
                toast.success('Venda excluída do Core e do Finanças.');
            } else if (result.finance === 'pending') {
                toast.info('Venda excluída do Core. A exclusão no Finanças ficou na fila automática.');
            } else {
                toast.success('Venda excluída do Core.');
            }
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Não foi possível excluir a venda.');
        },
    });

    const openDeleteDialog = (event: React.MouseEvent, venda: Venda) => {
        event.stopPropagation();
        setDeleteFromFinance(false);
        setVendaToDelete(venda);
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Vendas & Comissões</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Gerencie vendas, calcule comissões e acompanhe pagamentos
                        </p>
                    </div>
                    <Button onClick={() => handleOpenModal()} className="shadow-glow">
                        <Plus className="mr-2 h-4 w-4" />
                        Nova Venda
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card className="glass-card">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                        </CardContent>
                    </Card>
                    <Card className="glass-card">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                            <Clock className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-600">{stats.pendentes}</div>
                        </CardContent>
                    </Card>
                    <Card className="glass-card">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Receita MeMude</CardTitle>
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600">
                                {formatCurrency(stats.receitaMemude)}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="glass-card">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Comissões Pagas</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">
                                {formatCurrency(stats.comissoesPagas)}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <div className="flex gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                            placeholder="Buscar por cliente, empreendimento ou corretor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Filtrar por status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os status</SelectItem>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="aprovada">Aprovada</SelectItem>
                            <SelectItem value="paga">Paga</SelectItem>
                            <SelectItem value="cancelada">Cancelada</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Table */}
                <Card className="glass-card">
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-48">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                            </div>
                        ) : vendas.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                                <AlertCircle className="h-8 w-8 mb-2" />
                                <p>Nenhuma venda encontrada</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Empreendimento</TableHead>
                                        <TableHead>Corretor</TableHead>
                                        <TableHead className="text-right">Valor Imóvel</TableHead>
                                        <TableHead className="text-right">Comissão Líquida</TableHead>
                                        <TableHead className="text-right">Valor Corretor</TableHead>
                                        <TableHead className="text-right">Valor MeMude</TableHead>
                                        <TableHead>Data Pgto</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-16 text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vendas.map((venda) => (
                                        <TableRow
                                            key={venda.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => handleOpenModal(venda.id)}
                                        >
                                            <TableCell className="font-medium">
                                                {venda.leads?.nome || '—'}
                                            </TableCell>
                                            <TableCell>{venda.empreendimentos?.nome || '—'}</TableCell>
                                            <TableCell>
                                                {venda.is_venda_direta ? (
                                                    <Badge variant="outline" className="text-xs">Venda Direta</Badge>
                                                ) : (
                                                    venda.corretores?.profiles ? `${venda.corretores.profiles.first_name} ${venda.corretores.profiles.last_name}` : '—'
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {formatCurrency(Number(venda.valor_imovel))}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {formatCurrency(Number(venda.valor_comissao_liquida))}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {formatCurrency(Number(venda.valor_corretor))}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-emerald-600 font-semibold">
                                                {formatCurrency(Number(venda.valor_memude))}
                                            </TableCell>
                                            <TableCell>
                                                {venda.data_pagamento
                                                    ? new Date(venda.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR')
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={statusConfig[venda.status]?.variant || 'outline'}>
                                                    {statusConfig[venda.status]?.label || venda.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                                    aria-label={`Excluir venda de ${venda.leads?.nome || 'cliente'}`}
                                                    onClick={(event) => openDeleteDialog(event, venda)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            <VendaModal
                isOpen={modalOpen}
                onClose={handleCloseModal}
                vendaId={selectedVendaId}
            />

            <AlertDialog
                open={Boolean(vendaToDelete)}
                onOpenChange={(open) => {
                    if (!open && !deleteMutation.isPending) {
                        setVendaToDelete(null);
                        setDeleteFromFinance(false);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir esta venda?</AlertDialogTitle>
                        <AlertDialogDescription>
                            A venda de <strong>{vendaToDelete?.leads?.nome || 'cliente não identificado'}</strong>, no valor de{' '}
                            <strong>{formatCurrency(Number(vendaToDelete?.valor_imovel || 0))}</strong>, será removida permanentemente do Core.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="rounded-lg border border-border bg-muted/40 p-4">
                        <div className="flex items-start gap-3">
                            <Checkbox
                                id="delete-from-finance"
                                checked={deleteFromFinance}
                                onCheckedChange={(checked) => setDeleteFromFinance(checked === true)}
                                disabled={deleteMutation.isPending}
                            />
                            <div className="space-y-1">
                                <Label htmlFor="delete-from-finance" className="cursor-pointer font-medium">
                                    Excluir também o espelho desta venda no Finanças
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Contas a Receber independentes serão preservadas. Se houver qualquer movimento financeiro vinculado à venda, o Finanças bloqueará a exclusão automaticamente.
                                </p>
                            </div>
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            disabled={deleteMutation.isPending}
                            onClick={(event) => {
                                event.preventDefault();
                                deleteMutation.mutate();
                            }}
                        >
                            {deleteMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Excluindo...
                                </>
                            ) : (
                                'Excluir venda'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    );
};

export default Vendas;

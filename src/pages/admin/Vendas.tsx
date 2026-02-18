import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import VendaModal from '@/components/modals/VendaModal';
import { formatCurrency } from '@/utils/formatters';

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
    corretores: { nome: string } | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pendente: { label: 'Pendente', variant: 'outline' },
    aprovada: { label: 'Aprovada', variant: 'secondary' },
    paga: { label: 'Paga', variant: 'default' },
    cancelada: { label: 'Cancelada', variant: 'destructive' },
};

const Vendas = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedVendaId, setSelectedVendaId] = useState<string | null>(null);

    const { data: vendas = [], isLoading } = useQuery({
        queryKey: ['vendas', searchTerm, filterStatus],
        queryFn: async () => {
            let query = supabase
                .from('vendas')
                .select(`
          *,
          leads ( nome, telefone ),
          empreendimentos ( nome ),
          corretores ( nome )
        `)
                .order('created_at', { ascending: false });

            if (filterStatus && filterStatus !== 'all') {
                query = query.eq('status', filterStatus);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (searchTerm) {
                return (data as Venda[]).filter(v =>
                    v.leads?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    v.empreendimentos?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    v.corretores?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
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

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Vendas & Comissões</h1>
                        <p className="text-sm text-gray-500 mt-1">
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
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                            placeholder="Buscar por lead, empreendimento ou corretor..."
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
                            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                                <AlertCircle className="h-8 w-8 mb-2" />
                                <p>Nenhuma venda encontrada</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Lead</TableHead>
                                        <TableHead>Empreendimento</TableHead>
                                        <TableHead>Corretor</TableHead>
                                        <TableHead className="text-right">Valor Imóvel</TableHead>
                                        <TableHead className="text-right">Comissão Líquida</TableHead>
                                        <TableHead className="text-right">Valor Corretor</TableHead>
                                        <TableHead className="text-right">Valor MeMude</TableHead>
                                        <TableHead>Data Pgto</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vendas.map((venda) => (
                                        <TableRow
                                            key={venda.id}
                                            className="cursor-pointer hover:bg-gray-50/50"
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
                                                    venda.corretores?.nome || '—'
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
        </DashboardLayout>
    );
};

export default Vendas;

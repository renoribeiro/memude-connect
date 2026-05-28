import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    TrendingUp,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
} from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';

interface Venda {
    id: string;
    valor_imovel: number;
    valor_corretor: number;
    valor_comissao_liquida: number;
    status: 'pendente' | 'aprovada' | 'paga' | 'cancelada';
    data_venda: string;
    data_pagamento: string | null;
    is_venda_direta: boolean;
    leads: { nome: string } | null;
    empreendimentos: { nome: string } | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pendente: { label: 'Pendente', variant: 'outline' },
    aprovada: { label: 'Aprovada', variant: 'secondary' },
    paga: { label: 'Paga', variant: 'default' },
    cancelada: { label: 'Cancelada', variant: 'destructive' },
};

const MinhasComissoes = () => {
    const { profile } = useAuth();

    const { data: vendas = [], isLoading } = useQuery({
        queryKey: ['minhas-comissoes', profile?.id],
        queryFn: async () => {
            // First get corretor record for the current user
            const { data: corretor } = await supabase
                .from('corretores')
                .select('id')
                .eq('profile_id', profile?.id)
                .single();

            if (!corretor) return [];

            const { data, error } = await supabase
                .from('vendas')
                .select(`
          id,
          valor_imovel,
          valor_corretor,
          valor_comissao_liquida,
          status,
          data_venda,
          data_pagamento,
          is_venda_direta,
          leads ( nome ),
          empreendimentos ( nome )
        `)
                .eq('corretor_id', corretor.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Venda[];
        },
        enabled: !!profile?.id,
    });

    const stats = useMemo(() => {
        const total = vendas.length;
        const recebidas = vendas
            .filter(v => v.status === 'paga')
            .reduce((acc, v) => acc + Number(v.valor_corretor), 0);
        const pendentes = vendas
            .filter(v => v.status !== 'paga' && v.status !== 'cancelada')
            .reduce((acc, v) => acc + Number(v.valor_corretor), 0);
        const media = total > 0
            ? vendas.reduce((acc, v) => acc + Number(v.valor_corretor), 0) / total
            : 0;

        return { total, recebidas, pendentes, media };
    }, [vendas]);

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Minhas Comissões</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Acompanhe suas vendas e comissões
                    </p>
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
                            <CardTitle className="text-sm font-medium">Comissões Recebidas</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600">
                                {formatCurrency(stats.recebidas)}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="glass-card">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Comissões Pendentes</CardTitle>
                            <Clock className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-600">
                                {formatCurrency(stats.pendentes)}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="glass-card">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Média por Venda</CardTitle>
                            <TrendingUp className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">
                                {formatCurrency(stats.media)}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Table */}
                <Card className="glass-card">
                    <CardHeader>
                        <CardTitle className="text-lg">Histórico de Vendas</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 md:p-6">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-48">
                                <Loader2 className="animate-spin h-8 w-8 text-primary" />
                            </div>
                        ) : vendas.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                                <AlertCircle className="h-8 w-8 mb-2" />
                                <p>Nenhuma venda registrada</p>
                            </div>
                        ) : (
                            <>
                                {/* Mobile view (Lista de Cartões) */}
                                <div className="block md:hidden divide-y divide-border">
                                    {vendas.map((venda) => (
                                        <div key={venda.id} className="p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-semibold text-foreground">{venda.leads?.nome || '—'}</h4>
                                                    <p className="text-xs text-muted-foreground">{venda.empreendimentos?.nome || '—'}</p>
                                                </div>
                                                <Badge variant={statusConfig[venda.status]?.variant || 'outline'}>
                                                    {statusConfig[venda.status]?.label || venda.status}
                                                </Badge>
                                            </div>
                                            <div className="flex justify-between text-xs pt-1 border-t border-dashed">
                                                <span className="text-muted-foreground">Valor do Imóvel:</span>
                                                <span className="font-mono text-foreground">{formatCurrency(Number(venda.valor_imovel))}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground font-medium">Sua Comissão:</span>
                                                <span className="font-mono font-semibold text-emerald-600">
                                                    {formatCurrency(Number(venda.valor_corretor))}
                                                </span>
                                            </div>
                                            {venda.data_pagamento && (
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>Pago em:</span>
                                                    <span>{new Date(venda.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop view (Tabela Tradicional) */}
                                <div className="hidden md:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Cliente</TableHead>
                                                <TableHead>Empreendimento</TableHead>
                                                <TableHead className="text-right">Valor do Imóvel</TableHead>
                                                <TableHead className="text-right">Sua Comissão</TableHead>
                                                <TableHead>Data Pagamento</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vendas.map((venda) => (
                                                <TableRow key={venda.id}>
                                                    <TableCell className="font-medium">
                                                        {venda.leads?.nome || '—'}
                                                    </TableCell>
                                                    <TableCell>{venda.empreendimentos?.nome || '—'}</TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {formatCurrency(Number(venda.valor_imovel))}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-semibold text-emerald-600">
                                                        {formatCurrency(Number(venda.valor_corretor))}
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
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default MinhasComissoes;

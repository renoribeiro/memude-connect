import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { formatarDataHora, relativo } from '@/lib/comercial/datas';

type Execucao = {
  id: number; modo: string; iniciado_em: string; concluido_em: string | null; enviados: number; erros: number;
  mensagem: string | null; detalhes: Record<string, unknown> | null;
};

const MODOS = ['diario', 'enviar'];

function resumo(e: Execucao) {
  const d = (e.detalhes ?? {}) as {
    importacao?: { contagem?: Record<string, number> };
    envio?: { enviados?: number };
  };
  const c = d.importacao?.contagem ?? {};
  const novos = c.criado ?? 0;
  const ligados = (c.existente ?? 0) + (c.conflito ?? 0);
  const enviados = d.envio?.enviados ?? e.enviados ?? 0;
  return [
    `${novos} ${novos === 1 ? 'lead novo' : 'leads novos'} da planilha`,
    ligados ? `${ligados} linha(s) ligadas a leads que já existiam` : null,
    `${enviados} linha(s) atualizadas na planilha`,
  ].filter(Boolean).join(' · ');
}

/**
 * Botão "Sincronizar planilha": roda na hora a mesma rotina das 17h30, nos dois sentidos
 * (linhas novas da planilha → Connect; o que está no Connect e falta na planilha → planilha).
 */
export function SincronizarPlanilha() {
  const qc = useQueryClient();
  const [rodando, setRodando] = useState(false);

  const { data: ultima } = useQuery({
    queryKey: ['comercial', 'planilha-ultima-sync'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('sheet_sync_execucoes')
        .select('id, modo, iniciado_em, concluido_em, enviados, erros, mensagem, detalhes')
        .in('modo', MODOS).order('iniciado_em', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as Execucao | null;
    },
  });

  const sincronizar = async () => {
    setRodando(true);
    const aviso = toast.loading('Sincronizando com a planilha…', { description: 'Leva poucos segundos.' });
    try {
      const { data, error } = await supabase.rpc('planilha_sincronizar_agora');
      if (error) throw error;
      const pedidoEm = new Date((data as { pedido_em: string }).pedido_em).getTime();
      // Espera o resultado aparecer no histórico (até 2 minutos)
      let fim: Execucao | null = null;
      for (let i = 0; i < 40 && !fim; i += 1) {
        await new Promise((r) => setTimeout(r, 3000));
        const { data: ex } = await supabase.from('sheet_sync_execucoes')
          .select('id, modo, iniciado_em, concluido_em, enviados, erros, mensagem, detalhes')
          .in('modo', [...MODOS, 'falha'])
          .gte('iniciado_em', new Date(pedidoEm - 5000).toISOString())
          .order('iniciado_em', { ascending: false }).limit(1).maybeSingle();
        if (ex) fim = ex as Execucao;
      }
      if (!fim) {
        toast.info('A sincronização continua rodando', { id: aviso, description: 'O resultado aparece aqui na próxima vez que você abrir a tela.' });
      } else if (fim.modo === 'falha' || fim.erros) {
        toast.error('A sincronização terminou com erro', { id: aviso, description: fim.mensagem ?? 'Tente de novo em alguns minutos.' });
      } else {
        toast.success('Planilha e Connect sincronizados', { id: aviso, description: resumo(fim), duration: 8000 });
      }
      qc.invalidateQueries({ queryKey: ['comercial'] });
    } catch (e) {
      toast.error((e as Error).message || 'Não foi possível sincronizar', { id: aviso });
    } finally {
      setRodando(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" onClick={sincronizar} disabled={rodando}>
          {rodando ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sincronizar planilha
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        Traz para o Connect os leads novos da planilha e leva para a planilha o que falta lá. Roda sozinho às 17h30.
        {ultima && <span className="mt-1 block opacity-80">Última: {relativo(ultima.iniciado_em)} ({formatarDataHora(ultima.iniciado_em)})</span>}
      </TooltipContent>
    </Tooltip>
  );
}

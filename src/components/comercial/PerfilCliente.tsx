import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MessagesSquare, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Temperatura } from '@/components/conversas/pecas';
import { formatarDataHora } from '@/lib/comercial/datas';
import { cn } from '@/lib/utils';

const CAMPOS: [string, string][] = [['renda', 'Renda'], ['entrada_fgts', 'Entrada/FGTS'], ['prazo', 'Prazo'], ['finalidade', 'Finalidade'], ['regiao', 'Região']];

/** Perfil único do cliente: o mesmo em Leads, CRM, visita e app (a IA atualiza a partir de todas as conversas dele). */
export function usePerfilCliente(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ['comercial', 'perfil-cliente', leadId ?? ''],
    enabled: !!leadId,
    queryFn: async () => {
      const [lead, conversa] = await Promise.all([
        supabase.from('leads').select('perfil_ia, perfil_falta, perfil_temperatura, perfil_ia_em, qualificacao, status_atendimento')
          .eq('id', leadId!).maybeSingle(),
        supabase.from('conversas').select('id').eq('lead_id', leadId!).order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
          .limit(1).maybeSingle(),
      ]);
      if (lead.error) throw lead.error;
      return { ...lead.data, conversa_id: conversa.data?.id ?? null };
    },
  });
}

export function PerfilCliente({ leadId, className, titulo = 'Perfil do cliente' }: { leadId: string | null | undefined; className?: string; titulo?: string }) {
  const { data: p, isLoading } = usePerfilCliente(leadId);
  if (!leadId) return null;
  const q = (p?.qualificacao ?? {}) as Record<string, unknown>;
  const campos = CAMPOS.filter(([k]) => typeof q[k] === 'string' && q[k]);

  return (
    <section className={cn('rounded-xl border bg-card p-4', className)} aria-label={titulo}>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" aria-hidden /> {titulo}</h3>
        {p?.perfil_temperatura && <Temperatura valor={p.perfil_temperatura} comRotulo />}
        {p?.conversa_id && (
          <Link to={`/conversas?c=${p.conversa_id}`} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <MessagesSquare className="h-3.5 w-3.5" aria-hidden /> Conversa
          </Link>
        )}
      </div>
      {isLoading ? <Skeleton className="h-14 w-full" /> : (
        <>
          <p className="rounded-lg bg-mm-lilas p-3 text-sm leading-relaxed">
            {p?.perfil_ia ?? 'Ainda sem resumo: ele aparece quando o cliente conversar pelo número da MeMude.'}
          </p>
          {p?.perfil_falta && (
            <p className="mt-2 flex items-start gap-1.5 text-sm"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-mm-acao" aria-hidden />
              <span><strong>Próximo passo:</strong> {p.perfil_falta}</span></p>
          )}
          {campos.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {campos.map(([k, rotulo]) => (
                <span key={k} className="rounded-full border border-mm-borda-suave px-2.5 py-0.5 text-xs"><span className="text-muted-foreground">{rotulo}:</span> <strong>{String(q[k])}</strong></span>
              ))}
            </div>
          )}
          {p?.perfil_ia_em && <p className="mt-2 text-[11px] text-muted-foreground">Atualizado pela IA em {formatarDataHora(p.perfil_ia_em)}</p>}
        </>
      )}
    </section>
  );
}

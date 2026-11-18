import { useMemo, useState } from 'react';
import { CalendarClock, CalendarDays, History, Loader2, MessageSquarePlus, StickyNote, UserRound } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useEquipe, useHistoricoLead, type ItemHistorico } from '@/hooks/comercial/dados';
import { descreverEvento } from '@/lib/comercial/eventos';
import { formatarData, formatarDataHora } from '@/lib/comercial/datas';

function descrever(i: ItemHistorico): { titulo: string; detalhe?: string; icone: typeof History; tom: string } {
  if (i.origem === 'visita') {
    const d = descreverEvento({ kind: i.tipo, payload: i.payload });
    const daVisita = i.visita ? `Visita de ${formatarData(i.visita.data_visita)}${i.visita.empreendimento ? ` · ${i.visita.empreendimento}` : ''}` : undefined;
    return { titulo: d.titulo, detalhe: [d.detalhe, daVisita].filter(Boolean).join(' · ') || undefined, icone: CalendarDays, tom: 'bg-primary' };
  }
  if (i.origem === 'atividade') {
    const quando = i.para ? formatarDataHora(i.para) : '';
    return {
      titulo: `${i.tipo === 'manual' ? 'Lembrete' : 'Atividade agendada'}: ${i.titulo ?? '—'}`,
      detalhe: `${quando}${i.status === 'concluida' ? ' · concluída' : ''}`,
      icone: CalendarClock, tom: i.status === 'concluida' ? 'bg-emerald-500' : 'bg-amber-500',
    };
  }
  if (i.tipo === 'nota') return { titulo: 'Nota', detalhe: i.observacao ?? undefined, icone: StickyNote, tom: 'bg-secondary' };
  if (i.tipo === 'criado') return { titulo: 'Lead cadastrado', detalhe: i.observacao ?? undefined, icone: UserRound, tom: 'bg-slate-400' };
  if (i.campo) return { titulo: `${i.campo}: ${i.de ?? '—'} → ${i.para ?? '—'}`, detalhe: i.observacao ?? undefined, icone: History, tom: 'bg-slate-400' };
  return { titulo: i.observacao ?? i.tipo, icone: History, tom: 'bg-slate-400' };
}

/**
 * Histórico completo do cliente: alterações do lead, notas, eventos de todas as visitas e atividades agendadas.
 * Permite adicionar uma nota, que entra no topo do histórico.
 */
export function HistoricoLead({ leadId, notasAntigas }: { leadId: string; notasAntigas?: string | null }) {
  const qc = useQueryClient();
  const { data: itens = [], isLoading } = useHistoricoLead(leadId);
  const { data: equipe = [] } = useEquipe();
  const nomes = useMemo(() => new Map(equipe.map((u) => [u.user_id, u.nome])), [equipe]);
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [todos, setTodos] = useState(false);

  const adicionar = async () => {
    const texto = nota.trim();
    if (texto.length < 2) return;
    setSalvando(true);
    const { error } = await supabase.rpc('lead_adicionar_nota', { p_lead_id: leadId, p_texto: texto });
    setSalvando(false);
    if (error) { toast.error(error.message || 'Não foi possível salvar a nota'); return; }
    setNota('');
    toast.success('Nota adicionada ao histórico');
    qc.invalidateQueries({ queryKey: ['comercial', 'historico-lead', leadId] });
    qc.invalidateQueries({ queryKey: ['comercial', 'lead', leadId] });
  };

  const visiveis = todos ? itens : itens.slice(0, 12);

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
        <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={2000}
          placeholder="Escreva uma nota sobre o cliente (ligação, combinado, objeção…)" aria-label="Nova nota"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void adicionar(); } }} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">A nota fica no histórico com data e o seu nome.</span>
          <Button size="sm" onClick={adicionar} disabled={salvando || nota.trim().length < 2}>
            {salvando ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />} Adicionar nota
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
      ) : !itens.length && !notasAntigas ? (
        <p className="py-3 text-center text-sm text-muted-foreground">Ainda não há atividades registradas para este cliente.</p>
      ) : (
        <ol className="relative space-y-3 border-l pl-5">
          {visiveis.map((i) => {
            const d = descrever(i);
            return (
              <li key={i.id} className="relative">
                <span className={cn('absolute -left-[26px] top-1 flex h-3 w-3 rounded-full border-2 border-background', d.tom)} aria-hidden />
                <p className="flex items-start gap-1.5 text-sm font-medium"><d.icone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />{d.titulo}</p>
                {d.detalhe && <p className="whitespace-pre-line text-sm text-muted-foreground">{d.detalhe}</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">{formatarDataHora(i.quando)}{i.ator_id && ` · ${nomes.get(i.ator_id) ?? 'equipe'}`}</p>
              </li>
            );
          })}
          {notasAntigas && (todos || itens.length <= 12) && (
            <li className="relative">
              <span className="absolute -left-[26px] top-1 flex h-3 w-3 rounded-full border-2 border-background bg-secondary" aria-hidden />
              <p className="flex items-center gap-1.5 text-sm font-medium"><StickyNote className="h-3.5 w-3.5 text-muted-foreground" />Notas anteriores do card</p>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{notasAntigas}</p>
            </li>
          )}
        </ol>
      )}
      {itens.length > 12 && (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setTodos((t) => !t)}>
          {todos ? 'Mostrar menos' : `Ver histórico completo (${itens.length})`}
        </Button>
      )}
    </div>
  );
}

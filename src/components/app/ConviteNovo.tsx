import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarDays, Clock, Loader2, MapPin, Sparkles, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { cc } from '@/hooks/conversas/dados';
import { useAgora } from '@/hooks/conversas/useAgora';
import { tocarAviso } from '@/lib/conversas/push';
import { mensagemErro } from '@/lib/conversas/servidor';
import type { Convite } from '@/lib/conversas/tipos';

const dataLonga = (d: string, h: string) => {
  const dt = new Date(`${d}T${h.slice(0, 5)}:00-03:00`);
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', weekday: 'long', day: '2-digit', month: 'long' }).format(dt);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} às ${h.slice(0, 5)}`;
};

/** Tela cheia "Cliente novo": aceitar ou recusar antes do prazo (estilo app de corrida). */
export function ConviteNovo({ convites, aoAceitar }: { convites: Convite[]; aoAceitar: (conversaId: string | null) => void }) {
  const qc = useQueryClient();
  const agora = useAgora(1000);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const avisados = useRef(new Set<string>());
  const botaoAceitar = useRef<HTMLButtonElement>(null);
  const validos = useMemo(() => convites.filter((c) => new Date(c.prazo_em).getTime() > agora), [convites, agora]);
  const c = validos[0];

  useEffect(() => {
    if (c && !avisados.current.has(c.convite_id)) {
      avisados.current.add(c.convite_id);
      tocarAviso(true);
      // Fecha menus/gavetas abertos (Radix/Vaul bloqueiam toques fora deles) e leva o foco para "Aceitar"
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      setTimeout(() => botaoAceitar.current?.focus(), 150);
    }
  }, [c]);
  useEffect(() => { setRecusando(false); setMotivo(''); }, [c?.convite_id]);

  const responder = useMutation({
    mutationFn: async (aceitar: boolean) => {
      const convite = c!;
      const { error } = await supabase.rpc('corretor_responder_convite', { p_convite: convite.convite_id, p_aceitar: aceitar, p_observacao: motivo.trim() || null });
      if (error) throw error;
      // Some da tela na hora (não dá para responder duas vezes)
      qc.setQueryData<Convite[]>(cc.convites, (a) => (a ?? []).filter((x) => x.convite_id !== convite.convite_id));
      if (!aceitar) return { aceitar, conversaId: null as string | null, aviso: null as string | null };
      // Abre (ou cria) a conversa com o cliente pelo número da MeMude
      const { data: visita } = await supabase.from('visitas').select('lead_id').eq('id', convite.visita_id).maybeSingle();
      if (!visita?.lead_id) return { aceitar, conversaId: null, aviso: null };
      const { data: conversaId, error: e2 } = await supabase.rpc('conversa_iniciar', { p_lead: visita.lead_id });
      return { aceitar, conversaId: e2 ? null : String(conversaId), aviso: e2 ? mensagemErro(e2) : null };
    },
    onSuccess: ({ aceitar, conversaId, aviso }) => {
      qc.invalidateQueries({ queryKey: cc.raiz });
      if (aceitar) {
        navigator.vibrate?.(60);
        if (conversaId) toast.success('Cliente é seu! Já pode conversar.');
        else toast.success('Cliente é seu! A visita está na sua agenda.', { description: aviso ?? undefined });
        aoAceitar(conversaId);
      } else {
        toast('Convite recusado. A SDR escolhe outro corretor.');
      }
    },
    onError: (e) => { toast.error(mensagemErro(e)); qc.invalidateQueries({ queryKey: cc.convites }); },
  });

  if (!c) return null;
  const total = Math.max(1, new Date(c.prazo_em).getTime() - new Date(c.enviado_em).getTime());
  const resta = Math.max(0, new Date(c.prazo_em).getTime() - agora);
  const pct = resta / total;
  const min = Math.floor(resta / 60_000);
  const seg = Math.floor((resta % 60_000) / 1000);
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="convite-titulo"
      className="pointer-events-auto fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[hsl(252_51%_30%)] via-[hsl(252_51%_38%)] to-[hsl(300_45%_35%)] text-white animate-in fade-in duration-300">
      <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
          {validos.length > 1 ? `${validos.length} clientes esperando` : 'Novo cliente para você'}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-4 text-center">
        <div className="relative mb-4 h-24 w-24 shrink-0 [@media(min-height:700px)]:mb-6 [@media(min-height:700px)]:h-32 [@media(min-height:700px)]:w-32">
          <span className="absolute inset-0 animate-ping rounded-full bg-white/10" aria-hidden />
          <svg viewBox="0 0 100 100" className="relative h-full w-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="6" />
            <circle cx="50" cy="50" r={R} fill="none" stroke={pct < 0.25 ? '#fb7185' : '#fff'} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums">{min}:{String(seg).padStart(2, '0')}</span>
            <span className="text-[11px] uppercase tracking-wide opacity-80">para aceitar</span>
          </span>
        </div>
        <h1 id="convite-titulo" className="line-clamp-2 break-words text-2xl font-bold leading-tight [@media(min-height:700px)]:text-3xl">{c.lead_nome}</h1>
        <p className="mt-1 text-white/80">quer visitar um imóvel com você</p>

        <div className="mt-4 w-full max-w-sm space-y-2.5 [@media(min-height:700px)]:mt-6 rounded-2xl bg-white/10 p-4 text-left text-[15px] backdrop-blur">
          {c.empreendimento && <p className="flex items-center gap-3"><Building2 className="h-5 w-5 shrink-0 opacity-80" />{c.empreendimento}</p>}
          <p className="flex items-center gap-3"><CalendarDays className="h-5 w-5 shrink-0 opacity-80" />{dataLonga(c.data_visita, c.horario_visita)}</p>
          {(c.local_nome || c.bairro) && <p className="flex items-center gap-3"><MapPin className="h-5 w-5 shrink-0 opacity-80" />{[c.local_nome, c.bairro].filter(Boolean).join(' · ')}</p>}
          {c.renda && <p className="flex items-center gap-3"><Wallet className="h-5 w-5 shrink-0 opacity-80" />Renda {c.renda}</p>}
          {c.perfil && <p className="flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 opacity-80" /><span className="line-clamp-3">{c.perfil}</span></p>}
          {c.fonte && <p className="flex items-center gap-3 text-sm opacity-80"><Clock className="h-4 w-4 shrink-0" />Veio por {c.fonte}</p>}
        </div>
      </div>

      <div className="shrink-0 space-y-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
        {recusando ? (
          <div className="space-y-2 rounded-2xl bg-card p-3 text-card-foreground">
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={200} autoFocus placeholder="Por que não pode? (ex.: já tenho visita nesse horário)" className="text-base" />
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setRecusando(false)}><X className="h-4 w-4" /> Voltar</Button>
              <Button variant="destructive" className="flex-1" disabled={responder.isPending} onClick={() => responder.mutate(false)}>
                {responder.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Recusar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button ref={botaoAceitar} size="lg" disabled={responder.isPending} onClick={() => responder.mutate(true)}
              className="h-16 w-full rounded-2xl bg-white text-lg font-bold text-primary shadow-2xl hover:bg-white/90 active:scale-[0.98]">
              {responder.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Aceitar cliente'}
            </Button>
            <Button variant="ghost" size="lg" disabled={responder.isPending} onClick={() => setRecusando(true)}
              className="h-12 w-full rounded-2xl text-white/90 hover:bg-white/10 hover:text-white">
              Não posso atender
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

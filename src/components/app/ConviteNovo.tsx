import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarDays, Clock, Loader2, MapPin, Sparkles, Volume2, VolumeX, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { cc } from '@/hooks/conversas/dados';
import { useAgora } from '@/hooks/conversas/useAgora';
import { tocarAviso } from '@/lib/conversas/push';
import { mensagemErro } from '@/lib/conversas/servidor';
import type { Convite } from '@/lib/conversas/tipos';
import { Simbolo } from './Marca';

const dataLonga = (d: string, h: string) => {
  const dt = new Date(`${d}T${h.slice(0, 5)}:00-03:00`);
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', weekday: 'long', day: '2-digit', month: 'long' }).format(dt);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} às ${h.slice(0, 5)}`;
};

/** Ícone da lista do convite: quadrado rosa-claro com ícone rosa (padrão do cartão "Material de vendas"). */
function Item({ icone: Icone }: { icone: typeof Clock }) {
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#FDE8EF] text-[#D41F58]" aria-hidden><Icone className="h-4 w-4" /></span>;
}

/** Tela cheia "Cliente novo": aceitar ou recusar antes do prazo (estilo app de corrida). */
export function ConviteNovo({ convites, aoAceitar, abrirId, aoFecharAberto }: {
  convites: Convite[]; aoAceitar: (conversaId: string | null) => void;
  /** Convite aberto de propósito (pela tela Hoje ou pela notificação), mesmo com o prazo esgotado. */
  abrirId?: string | null; aoFecharAberto?: () => void;
}) {
  const qc = useQueryClient();
  const agora = useAgora(1000);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const avisados = useRef(new Set<string>());
  const tela = useRef<HTMLDivElement>(null);
  const [fixado, setFixado] = useState<string | null>(null);
  const [dispensados, setDispensados] = useState<Set<string>>(() => new Set());
  // No prazo aparecem sozinhos; depois do prazo só se a pessoa abrir (ou se já estava decidindo na tela)
  const validos = useMemo(() => convites.filter((x) => (!dispensados.has(x.convite_id) || x.convite_id === abrirId) && (
    new Date(x.prazo_em).getTime() > agora || x.convite_id === abrirId || x.convite_id === fixado)), [convites, agora, abrirId, fixado, dispensados]);
  const c = validos.find((x) => x.convite_id === abrirId) ?? validos.find((x) => x.convite_id === fixado) ?? validos[0];
  useEffect(() => { setFixado(c?.convite_id ?? null); }, [c?.convite_id]);
  const fechar = () => {
    if (c) setDispensados((d) => new Set(d).add(c.convite_id));
    aoFecharAberto?.();
  };

  useEffect(() => {
    if (c && !avisados.current.has(c.convite_id)) {
      avisados.current.add(c.convite_id);
      // Convite reaberto depois do prazo (pela Agenda) não toca de novo
      if (new Date(c.prazo_em).getTime() > Date.now()) tocarAviso(true);
      // Fecha menus/gavetas abertos (Radix/Vaul bloqueiam toques fora deles) e leva o foco para "Aceitar"
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
  }, [c]);
  // Foco no aviso (não no botão): uma tecla Enter/Espaço que a pessoa já vinha digitando não aceita sem querer.
  // Vale também quando o convite é reaberto pela tela Hoje.
  useEffect(() => {
    if (!c?.convite_id) return;
    const t = setTimeout(() => tela.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [c?.convite_id]);
  const [mudo, setMudo] = useState(false);
  // Com a tela de chamado aberta, o app por trás fica inerte (teclado e leitor de tela não saem dela)
  const aberto = !!c;
  useEffect(() => {
    if (!aberto) return;
    const fundo = [...document.querySelectorAll<HTMLElement>('[data-sob-convite]')];
    fundo.forEach((el) => el.setAttribute('inert', ''));
    return () => fundo.forEach((el) => el.removeAttribute('inert'));
  }, [aberto]);
  useEffect(() => { setRecusando(false); setMotivo(''); setMudo(false); }, [c?.convite_id]);

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
      aoFecharAberto?.();
      if (aceitar) {
        navigator.vibrate?.(60);
        if (conversaId) toast.success('Cliente é seu. Já pode conversar.');
        else toast.success('Cliente é seu. A visita está na sua agenda.', { description: aviso ?? undefined });
        aoAceitar(conversaId);
      } else {
        toast('Convite recusado. A SDR escolhe outro corretor.');
      }
    },
    onError: (e) => { toast.error(mensagemErro(e)); qc.invalidateQueries({ queryKey: cc.convites }); },
  });

  // Toca como chamada: a cada 3 s no primeiro meio minuto, depois a cada 20 s, até responder, silenciar ou o prazo acabar
  const noPrazo = !!c && new Date(c.prazo_em).getTime() > agora;
  const tocando = noPrazo && !recusando && !responder.isPending && !mudo;
  useEffect(() => {
    if (!tocando) return;
    const inicio = Date.now();
    let t = 0;
    const ciclo = () => {
      if (document.visibilityState === 'visible') tocarAviso(true);
      t = window.setTimeout(ciclo, Date.now() - inicio < 30_000 ? 3_000 : 20_000);
    };
    t = window.setTimeout(ciclo, 3_000);
    return () => { window.clearTimeout(t); navigator.vibrate?.(0); };
  }, [tocando, c?.convite_id]);

  if (!c) return null;
  const total = Math.max(1, new Date(c.prazo_em).getTime() - new Date(c.enviado_em).getTime());
  const resta = Math.max(0, new Date(c.prazo_em).getTime() - agora);
  const pct = resta / total;
  const min = Math.floor(resta / 60_000);
  const seg = Math.floor((resta % 60_000) / 1000);
  const esgotado = resta === 0;
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <div ref={tela} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="convite-titulo"
      className="pointer-events-auto fixed inset-0 z-[60] flex flex-col bg-mm-roxo text-white outline-none animate-in fade-in duration-300">
      <div className="flex items-center gap-2.5 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white" aria-hidden><Simbolo className="h-6" /></span>
        <span className="mr-auto rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">
          {esgotado ? 'Prazo esgotado' : validos.length > 1 ? `${validos.length} clientes esperando` : 'Novo cliente para você'}
        </span>
        {!esgotado && (
          <button type="button" onClick={() => setMudo((m) => !m)} aria-pressed={mudo}
            aria-label={mudo ? 'Ligar o som do chamado' : 'Silenciar o chamado'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            {mudo ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        )}
        {esgotado && (
          <button type="button" onClick={fechar} aria-label="Fechar convite"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 py-4 text-center">
        {/* mt-auto/mb-auto centralizam sem cortar o topo quando o conteúdo não cabe (iPhone pequeno) */}
        <div className="relative mb-4 mt-auto h-24 w-24 shrink-0 [@media(min-height:700px)]:mb-6 [@media(min-height:700px)]:h-32 [@media(min-height:700px)]:w-32">
          {!esgotado && <span className="absolute inset-0 animate-ping rounded-full bg-white/10" aria-hidden />}
          <svg viewBox="0 0 100 100" className="relative h-full w-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="6" />
            <circle cx="50" cy="50" r={R} fill="none" stroke={pct < 0.25 ? '#E92662' : '#fff'} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            {esgotado ? (
              <span className="px-2 text-xs font-bold leading-tight">Ainda pode aceitar</span>
            ) : (
              <>
                <span className="text-3xl font-extrabold tabular-nums">{min}:{String(seg).padStart(2, '0')}</span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-mm-sobre-roxo">para aceitar</span>
              </>
            )}
          </span>
        </div>
        <h1 id="convite-titulo" className="line-clamp-2 break-words text-[28px] font-extrabold leading-tight tracking-[-0.02em] [@media(min-height:700px)]:text-[32px]">{c.lead_nome}</h1>
        <p className="mt-1 text-mm-sobre-roxo">{esgotado ? 'O prazo passou, mas a visita ainda está com você até a SDR escolher outro corretor.' : 'quer visitar um imóvel com você'}</p>

        <div className="mb-auto mt-4 w-full max-w-sm space-y-2.5 rounded-2xl bg-white p-4 text-left text-[15px] font-semibold text-[#1E1640] [@media(min-height:700px)]:mt-6">
          {c.empreendimento && <p className="flex items-center gap-3 font-extrabold"><Item icone={Building2} />{c.empreendimento}</p>}
          <p className="flex items-center gap-3"><Item icone={CalendarDays} />{dataLonga(c.data_visita, c.horario_visita)}</p>
          {(c.local_nome || c.bairro) && <p className="flex items-center gap-3"><Item icone={MapPin} />{[c.local_nome, c.bairro].filter(Boolean).join(' · ')}</p>}
          {c.renda && <p className="flex items-center gap-3"><Item icone={Wallet} />Renda {c.renda}</p>}
          {c.perfil && <p className="flex items-start gap-3"><Item icone={Sparkles} /><span className="line-clamp-3 font-normal">{c.perfil}</span></p>}
          {c.fonte && <p className="flex items-center gap-3 text-sm font-normal text-[#6B6385]"><Item icone={Clock} />Veio por {c.fonte}</p>}
        </div>
      </div>

      <div className="shrink-0 space-y-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
        {recusando ? (
          <div className="tema-memude space-y-2 rounded-[22px] bg-card p-3 text-card-foreground">
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={200} autoFocus placeholder="Por que não pode? (ex.: já tenho visita nesse horário)" className="text-base" />
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setRecusando(false)}><X className="h-4 w-4" /> Voltar</Button>
              <Button variant="acao" className="flex-1" disabled={responder.isPending} onClick={() => responder.mutate(false)}>
                {responder.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Recusar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Dois botões grandes, fáceis de tocar com uma mão */}
            <Button size="lg" variant="acao" disabled={responder.isPending} onClick={() => responder.mutate(true)}
              className="h-16 w-full rounded-full text-xl font-extrabold active:scale-[0.98]">
              {responder.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Aceitar'}
            </Button>
            <Button variant="outline" size="lg" disabled={responder.isPending} onClick={() => setRecusando(true)}
              className="h-16 w-full rounded-full border-2 border-white/70 bg-transparent text-xl font-extrabold text-white hover:bg-white/10 hover:text-white active:scale-[0.98]">
              Não aceitar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

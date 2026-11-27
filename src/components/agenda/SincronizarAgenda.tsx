import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Check, Copy, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const BASE = 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/agenda-ics';
const msgErro = (e: unknown) => (e as { message?: string })?.message || 'Não foi possível concluir. Tente de novo.';

/** Uma visita para pôr na agenda na hora (sem esperar o Google atualizar a assinatura). */
export interface VisitaAgenda { id: string; titulo: string; data: string; hora: string; local?: string | null; detalhes?: string | null }

/** Link do Google Agenda para criar um evento já preenchido (horário de Fortaleza, 1 hora). */
export function linkGoogleEvento(v: VisitaAgenda): string {
  const ini = new Date(`${v.data}T${v.hora.slice(0, 5)}:00-03:00`);
  const fim = new Date(ini.getTime() + 60 * 60_000);
  const z = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: v.titulo, dates: `${z(ini)}/${z(fim)}`, ctz: 'America/Fortaleza' });
  if (v.local) p.set('location', v.local);
  if (v.detalhes) p.set('details', v.detalhes);
  return `https://calendar.google.com/calendar/render?${p}`;
}

function useMeuLink() {
  return useQuery({
    queryKey: ['agenda', 'meu-link'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minha_agenda_link', { p_trocar: false });
      if (error) throw error;
      return String(data);
    },
  });
}

const iconeGoogle = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><rect x="3" y="4" width="18" height="17" rx="3" fill="#fff" stroke="#4285F4" strokeWidth="2" /><rect x="3" y="4" width="18" height="5" rx="2" fill="#4285F4" /><text x="12" y="18.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#4285F4">31</text></svg>
);

/**
 * Conteúdo de "Sincronizar agenda": assinar no Google Agenda / iPhone / Outlook (atualiza sozinho)
 * e, para quem tem pressa, pôr cada visita na agenda na hora.
 */
export function SincronizarAgenda({ visitas = [], app = false }: { visitas?: VisitaAgenda[]; app?: boolean }) {
  const qc = useQueryClient();
  const { data: token, isLoading, isError, refetch } = useMeuLink();
  const [copiado, setCopiado] = useState(false);
  const [confirmarTroca, setConfirmarTroca] = useState(false);
  const trocar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('minha_agenda_link', { p_trocar: true });
      if (error) throw error;
      return String(data);
    },
    onSuccess: (t) => { qc.setQueryData(['agenda', 'meu-link'], t); setConfirmarTroca(false); toast.success('Link trocado. Assine de novo na sua agenda.'); },
    onError: (e) => toast.error(msgErro(e)),
  });

  const https = token ? `${BASE}?t=${token}` : '';
  const webcal = https.replace(/^https:/, 'webcal:');
  const copiar = async () => {
    try { await navigator.clipboard.writeText(https); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { toast.error('Não consegui copiar. Segure o dedo no link para copiar.'); }
  };
  const botao = cn('flex w-full items-center gap-3 rounded-2xl border border-mm-borda-suave bg-card p-3.5 text-left font-bold transition hover:bg-muted active:scale-[0.99]',
    app ? 'text-[15px]' : 'text-sm');

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (isError || !token) {
    return <div className="py-6 text-center text-sm"><p>Não foi possível gerar seu link.</p><Button variant="outline" className="mt-3" onClick={() => refetch()}>Tentar de novo</Button></div>;
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className={cn('font-bold', app ? 'text-[15px]' : 'text-sm')}>Assinar minha agenda</h3>
        <p className="text-[13px] text-muted-foreground">
          Suas visitas aparecem sozinhas na agenda do celular e somem se forem canceladas. É só fazer uma vez.
        </p>
        <a className={botao} href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer">
          {iconeGoogle} Google Agenda
        </a>
        <a className={botao} href={webcal}>
          <CalendarPlus className="h-5 w-5 text-[#FF3B30]" aria-hidden /> iPhone e Mac (Calendário)
        </a>
        <a className={botao} href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent('MeMude')}`} target="_blank" rel="noopener noreferrer">
          <CalendarPlus className="h-5 w-5 text-[#0078D4]" aria-hidden /> Outlook
        </a>
        <div className="flex items-center gap-2 rounded-2xl bg-muted p-2 pl-3">
          <code className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{https}</code>
          <Button size="sm" variant="outline" onClick={copiar} className="shrink-0">
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiado ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Outras agendas: cole o link em “Adicionar agenda por URL”. O Google confere o link algumas vezes por dia; o iPhone e o Outlook, a cada hora.
          O link é só seu: não compartilhe.
        </p>
      </section>

      {visitas.length > 0 && (
        <section className="space-y-2">
          <h3 className={cn('font-bold', app ? 'text-[15px]' : 'text-sm')}>Pôr na agenda agora</h3>
          <ul className="space-y-2">
            {visitas.map((v) => (
              <li key={v.id} className="flex items-center gap-3 rounded-2xl border border-mm-borda-suave p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{v.titulo}</span>
                  <span className="block text-[12px] text-muted-foreground">{v.data.split('-').reverse().slice(0, 2).join('/')} às {v.hora.slice(0, 5)}</span>
                </span>
                <Button size="sm" variant="outline" asChild>
                  <a href={linkGoogleEvento(v)} target="_blank" rel="noopener noreferrer">{iconeGoogle} Adicionar</a>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="border-t border-mm-borda-suave pt-3">
        {confirmarTroca ? (
          <div className="space-y-2 text-[13px]">
            <p>O link atual para de funcionar e você precisa assinar de novo. Use se o link foi parar com outra pessoa.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmarTroca(false)}>Cancelar</Button>
              <Button size="sm" variant="destructive" disabled={trocar.isPending} onClick={() => trocar.mutate()}>
                {trocar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Trocar link
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmarTroca(true)} className="text-[13px] font-semibold text-muted-foreground underline-offset-2 hover:underline">
            Trocar link
          </button>
        )}
      </div>
    </div>
  );
}

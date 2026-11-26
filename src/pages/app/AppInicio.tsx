import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, Building2, CalendarDays, Check, ChevronRight, MessageCircle, MessagesSquare, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Topo } from '@/components/app/Topo';
import { Atalho, Bloco, CartaoNumero, FalhaCarregar, TituloSecao } from '@/components/app/ui';
import { ListaVisitas } from '@/components/app/ListaVisitas';
import { useAuth } from '@/hooks/useAuth';
import { useConvites } from '@/hooks/conversas/useConvites';
import { useAgora } from '@/hooks/conversas/useAgora';
import { usePush } from '@/hooks/conversas/usePush';
import { useAtividades, useConcluirAtividade, useMinhasVisitas } from '@/hooks/conversas/app';
import { diaRotulo, hojeISO, horaDe, isoDoInstante, periodoDoDia, plural } from '@/lib/conversas/agenda';
import { minutosEsperando, nomeDaConversa } from '@/lib/conversas/formato';
import type { ConversaItem } from '@/lib/conversas/tipos';

const TRES_DIAS = 3 * 86_400_000;
const minutosDoDia = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

type Prioridade = {
  chave: string; tipo: string; estado: string; urgente: boolean; titulo: string; detalhe: string;
  ordem: number; conversa?: string; atividade?: string; irPara?: string;
};

/** Início do app: o que precisa de você agora, no padrão do app MeMude Corretor. */
export default function AppInicio({ conversas, carregando, erro, tentar }: {
  conversas: ConversaItem[]; carregando?: boolean; erro?: boolean; tentar?: () => void;
}) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const agora = useAgora(30_000);
  const push = usePush();
  const { data: convites = [] } = useConvites(false);
  const { data: atividades = [], isLoading: carregandoAtiv } = useAtividades();
  const { data: visitas = [], isLoading: carregandoVis, isError: erroVis, refetch: recarregarVis } = useMinhasVisitas();
  const concluir = useConcluirAtividade();

  const hoje = hojeISO();
  const esperando = useMemo(() => conversas.filter((c) => c.aguardando_desde)
    .sort((a, b) => a.aguardando_desde!.localeCompare(b.aguardando_desde!)), [conversas]);
  const parados = conversas.filter((c) => !c.aguardando_desde && c.ultima_mensagem_em && agora - new Date(c.ultima_mensagem_em).getTime() > TRES_DIAS
    && !['vendido', 'perdido'].includes(c.etapa)).length;
  const visitasHoje = useMemo(() => visitas.filter((v) => v.data_visita === hoje), [visitas, hoje]);
  const naoLidas = conversas.filter((c) => c.nao_lidas > 0).length;

  // Prioridades por urgência: cliente esperando, atividade vencida ou de hoje, visita de hoje
  const prioridades = useMemo<Prioridade[]>(() => {
    // Ordem: até 3 clientes esperando (os mais antigos), atividades atrasadas (a que venceu primeiro),
    // depois o que é de hoje pelo horário. Cada tipo garante espaço, então nenhum some quando o outro enche.
    const conversasItens: Prioridade[] = [];
    const atrasadas: (Prioridade & { vence: number })[] = [];
    const doDia: Prioridade[] = [];
    esperando.slice(0, 3).forEach((c) => {
      const min = minutosEsperando(c.aguardando_desde, agora) ?? 0;
      conversasItens.push({
        chave: `c-${c.id}`, tipo: 'Conversa', estado: min < 60 ? `esperando ${min} min` : `esperando ${Math.floor(min / 60)} h`,
        urgente: min >= 15, titulo: nomeDaConversa(c), detalhe: c.ultima_previa ?? 'Mensagem nova', ordem: -min, conversa: c.id,
      });
    });
    atividades.filter((a) => isoDoInstante(a.disponivel_em) <= hoje).forEach((a) => {
      const vence = new Date(a.vence_em).getTime();
      const diaVence = isoDoInstante(a.vence_em);
      const base = {
        chave: `a-${a.id}`, tipo: 'Atividade', titulo: a.titulo, detalhe: a.lead_nome ?? 'Sem cliente ligado',
        conversa: a.conversa_id ?? undefined, atividade: a.id,
      };
      if (vence < agora) atrasadas.push({ ...base, estado: 'atrasada', urgente: true, ordem: 0, vence });
      else doDia.push({ ...base, urgente: false, ordem: diaVence === hoje ? minutosDoDia(horaDe(a.vence_em)) : 1440,
        estado: `até ${diaVence === hoje ? 'hoje' : diaRotulo(diaVence).toLowerCase()} ${horaDe(a.vence_em)}` });
    });
    // Visita de hoje que ainda não passou (até 1 h depois do início), sem as que esperam aceite (essas ficam no destaque)
    visitasHoje.filter((v) => v.status !== 'aguardando_corretor'
      && minutosDoDia(String(v.horario_visita)) + 60 >= minutosDoDia(horaDe(new Date(agora).toISOString()))).forEach((v) => {
      doDia.push({
        chave: `v-${v.id}`, tipo: 'Visita', estado: String(v.horario_visita).slice(0, 5), urgente: false,
        titulo: (v.leads as { nome?: string } | null)?.nome ?? 'Cliente', detalhe: (v.empreendimentos as { nome?: string } | null)?.nome ?? 'Empreendimento',
        ordem: minutosDoDia(String(v.horario_visita)), irPara: '/app/agenda',
      });
    });
    atrasadas.sort((a, b) => a.vence - b.vence);
    doDia.sort((a, b) => a.ordem - b.ordem);
    return [...conversasItens, ...atrasadas, ...doDia].slice(0, 6);
  }, [esperando, atividades, visitasHoje, agora, hoje]);

  const convite = convites[0];
  const nome = profile?.first_name;

  return (
    <>
      {/* No Início o topo rola junto (como no app de referência): sobra mais tela para o que importa */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Topo marca titulo={`${periodoDoDia()}${nome ? `, ${nome}` : ''}!`} subtitulo="Seus clientes da MeMude no mesmo lugar." />
        <div className="space-y-6 px-5 pb-6 pt-1">
          {/* Destaque roxo: o que fazer agora */}
          <section className="rounded-[22px] bg-mm-roxo p-5 text-white">
            {convite ? (
              <>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#FDE8EF]">Cliente esperando você</p>
                <p className="mt-1 text-[22px] font-extrabold leading-tight tracking-[-0.02em]">{convite.lead_nome}</p>
                <p className="mt-1 text-sm text-mm-sobre-roxo">{[convite.empreendimento, convite.bairro].filter(Boolean).join(' · ') || 'Visita para aceitar'}</p>
                <Button variant="acao" className="mt-4 h-11 px-5" onClick={() => navigate({ search: `?convite=${convite.convite_id}` })}>
                  Ver e aceitar
                </Button>
              </>
            ) : esperando.length ? (
              <>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#FDE8EF]">Responda agora</p>
                <p className="mt-1 text-[22px] font-extrabold leading-tight tracking-[-0.02em]">{plural(esperando.length, 'cliente esperando', 'clientes esperando')} resposta</p>
                <p className="mt-1 text-sm text-mm-sobre-roxo">Responder em até 15 minutos evita alerta para o closer.</p>
                <Button variant="acao" className="mt-4 h-11 px-5" onClick={() => navigate('/app/conversas?filtro=aguardando')}>Responder</Button>
              </>
            ) : (
              <>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#FDE8EF]">Tudo em dia</p>
                <p className="mt-1 text-[22px] font-extrabold leading-tight tracking-[-0.02em]">Nenhum cliente esperando</p>
                <p className="mt-1 text-sm text-mm-sobre-roxo">Quando a MeMude mandar um cliente, o app toca e mostra aqui.</p>
                <Button variant="outline" className="mt-4 h-11 border-white/40 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => navigate('/app/conversas')}>Ver conversas</Button>
              </>
            )}
          </section>

          {(push.estado === 'inativo' || push.estado === 'instalar') && (
            <div className="flex items-center gap-3 rounded-2xl border border-mm-borda-rosa bg-mm-rosa-palido p-3">
              <BellRing className="h-5 w-5 shrink-0 text-mm-acao" aria-hidden />
              <p className="flex-1 text-sm font-semibold leading-snug">
                {push.estado === 'instalar' ? 'Instale o app (Compartilhar → Adicionar à Tela de Início) para receber o cliente novo.' : 'Ative as notificações para o app tocar quando chegar cliente novo.'}
              </p>
              {push.estado === 'inativo' && <Button size="sm" variant="acao" onClick={push.ativar} disabled={push.ocupado}>Ativar</Button>}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <CartaoNumero valor={carregando ? '–' : esperando.length} rotulo="esperando resposta" alerta={esperando.length > 0}
              aoTocar={() => navigate('/app/conversas?filtro=aguardando')} />
            <CartaoNumero valor={carregandoVis ? '–' : visitasHoje.length} rotulo="visitas hoje" aoTocar={() => navigate('/app/agenda')} />
            <CartaoNumero valor={carregando ? '–' : parados} rotulo="parados 3 dias+" alerta={parados > 0} aoTocar={() => navigate('/app/clientes?filtro=parados')} />
          </div>

          <nav aria-label="Atalhos" className="grid grid-cols-4 gap-1">
            <Atalho icone={MessagesSquare} rotulo="Conversas" tom="rosa" para="/app/conversas" contador={naoLidas} />
            <Atalho icone={CalendarDays} rotulo="Agenda" tom="lilas" para="/app/agenda" />
            <Atalho icone={Users} rotulo="Clientes" tom="rosa" para="/app/clientes" />
            <Atalho icone={Building2} rotulo="Imóveis" tom="lilas" para="/app/imoveis" />
          </nav>

          {erro && !conversas.length && <FalhaCarregar aoTentar={() => tentar?.()} />}

          <Bloco titulo="Prioridades de hoje" extra="por urgência" semPadding>
            {carregando || carregandoAtiv ? (
              <div className="space-y-2 px-4 pb-4">{[0, 1].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
            ) : !prioridades.length ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Nada urgente agora. Bom momento para retomar quem está parado.</p>
            ) : (
              <ul className="divide-y divide-mm-borda-suave">
                {prioridades.map((p) => (
                  <li key={p.chave} className="flex items-center gap-3 px-4 py-3">
                    {p.atividade ? (
                      <button type="button" onClick={() => concluir.mutate(p.atividade!)} disabled={concluir.isPending}
                        aria-label={`Concluir ${p.titulo}`}
                        className="group flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-mm-campo transition hover:border-primary">
                        <Check className="h-3.5 w-3.5 text-primary opacity-0 transition group-hover:opacity-100" aria-hidden />
                      </button>
                    ) : (
                      <span className={cn('mx-2.5 h-2 w-2 shrink-0 rounded-full', p.urgente ? 'bg-mm-acao' : 'bg-primary')} aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-primary">
                        {p.tipo} <span className={cn('normal-case tracking-normal', p.urgente ? 'text-mm-rosa-texto' : 'font-semibold text-muted-foreground')}>{p.estado}</span>
                      </p>
                      <p className="truncate text-[15px] font-bold">{p.titulo}</p>
                      <p className="truncate text-[13px] text-muted-foreground">{p.detalhe}</p>
                    </div>
                    {p.conversa && (
                      <button type="button" onClick={() => navigate(`/app/c/${p.conversa}`)} aria-label={`Abrir conversa com ${p.titulo}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-primary transition active:scale-95">
                        <MessageCircle className="h-5 w-5" aria-hidden />
                      </button>
                    )}
                    {!p.conversa && p.irPara && (
                      <button type="button" onClick={() => navigate(p.irPara!)} aria-label={`Ver ${p.titulo} na agenda`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition active:scale-95">
                        <ChevronRight className="h-5 w-5" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Bloco>

          <section className="space-y-3">
            <TituloSecao titulo="Próximas visitas" acao="Ver agenda" para="/app/agenda" />
            {carregandoVis ? <Skeleton className="h-20 w-full rounded-2xl" /> : erroVis && !visitas.length ? (
              <FalhaCarregar aoTentar={() => recarregarVis()} />
            ) : !visitas.length ? (
              <p className="rounded-2xl bg-mm-lilas p-4 text-sm font-semibold text-primary">Nenhuma visita nos próximos 7 dias.</p>
            ) : <ListaVisitas visitas={visitas.slice(0, 3)} />}
          </section>
        </div>
      </div>
    </>
  );
}

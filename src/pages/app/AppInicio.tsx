import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, BellRing, Check, ChevronRight, Loader2, MapPin, MessageCircle, Navigation, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { FalhaCarregar } from '@/components/app/ui';
import { Marca } from '@/components/app/Marca';
import { CartaoChamado, FotoEmpreendimento, quandoCurto } from '@/components/app/Chamado';
import { AvatarContato, Temperatura } from '@/components/conversas/pecas';
import { useAuth } from '@/hooks/useAuth';
import { useConvites } from '@/hooks/conversas/useConvites';
import { useAgora } from '@/hooks/conversas/useAgora';
import { usePush } from '@/hooks/conversas/usePush';
import { useIniciarConversa } from '@/hooks/conversas/dados';
import { useAtividades, useConcluirAtividade, useMinhasVisitas, useVisitasParaContar, type MinhaVisita, type VisitaParaContar } from '@/hooks/conversas/app';
import { ComoFoiVisita } from '@/components/app/ComoFoiVisita';
import { diaRotulo, hojeISO, horaDe, isoDoInstante, periodoDoDia, plural } from '@/lib/conversas/agenda';
import { minutosEsperando, nivelEspera, nomeDaConversa } from '@/lib/conversas/formato';
import type { ConversaItem } from '@/lib/conversas/tipos';

const UM_DIA = 86_400_000;
const nomeLead = (v: MinhaVisita) => (v.leads as { nome?: string } | null)?.nome ?? 'Cliente';
const emp = (v: MinhaVisita) => v.empreendimentos as { nome?: string; imagem_url?: string | null } | null;
const inicioDa = (v: MinhaVisita) => new Date(`${v.data_visita}T${String(v.horario_visita).slice(0, 5)}:00-03:00`).getTime();

function faltaPara(ms: number) {
  if (ms <= 0) return 'agora';
  const min = Math.round(ms / 60_000);
  if (min < 60) return `em ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `em ${h} h` : `em ${Math.round(h / 24)} dias`;
}

const dataDeHoje = () => {
  const t = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Título de seção da tela Início */
function Secao({ titulo, extra, children, acao }: { titulo: string; extra?: string; children: React.ReactNode; acao?: { rotulo: string; aoTocar: () => void } }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2 px-5">
        <h2 className="text-[17px] font-extrabold tracking-[-0.01em]">{titulo}</h2>
        {extra && <span className="text-[13px] text-muted-foreground">{extra}</span>}
        {acao && <button type="button" onClick={acao.aoTocar} className="ml-auto text-[13px] font-bold text-primary">{acao.rotulo}</button>}
      </div>
      {children}
    </section>
  );
}

/**
 * Início do app do corretor: pessoas primeiro.
 * Quem chama agora, a próxima visita com a foto do imóvel, quem está esperando resposta,
 * quem já visitou e precisa de um próximo passo, e o que fazer hoje.
 */
export default function AppInicio({ conversas, carregando, erro, tentar }: {
  conversas: ConversaItem[]; carregando?: boolean; erro?: boolean; tentar?: () => void;
}) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const agora = useAgora(30_000);
  const agoraSeg = useAgora(1000);
  const push = usePush();
  const iniciar = useIniciarConversa();
  const { data: convites = [] } = useConvites(false);
  const { data: atividades = [], isLoading: carregandoAtiv } = useAtividades();
  const { data: visitas = [], isLoading: carregandoVis, isError: erroVis, refetch: recarregarVis } = useMinhasVisitas();
  const concluir = useConcluirAtividade();
  const { data: paraContar = [] } = useVisitasParaContar();
  const [contando, setContando] = useState<VisitaParaContar | null>(null);
  const { data: nota } = useQuery({
    queryKey: ['conversas', 'minha-nota', profile?.id],
    enabled: !!profile?.id,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('corretores').select('nota_media').eq('profile_id', profile!.id).is('deleted_at', null).maybeSingle();
      return data?.nota_media ? Number(data.nota_media) : null;
    },
  });

  const hoje = hojeISO();
  const conversaDoLead = useMemo(() => new Map(conversas.filter((c) => c.lead_id).map((c) => [c.lead_id, c.id])), [conversas]);
  const esperando = useMemo(() => conversas.filter((c) => c.aguardando_desde)
    .sort((a, b) => a.aguardando_desde!.localeCompare(b.aguardando_desde!)), [conversas]);
  // Quem já visitou e está sem conversa há mais de 1 dia: é aqui que a venda se perde
  const posVisita = useMemo(() => conversas.filter((c) => c.etapa === 'visitou' && !c.aguardando_desde
    && (!c.ultima_mensagem_em || agora - new Date(c.ultima_mensagem_em).getTime() > UM_DIA))
    .sort((a, b) => (a.ultima_mensagem_em ?? '').localeCompare(b.ultima_mensagem_em ?? '')).slice(0, 3), [conversas, agora]);
  const futuras = useMemo(() => visitas.filter((v) => v.status !== 'aguardando_corretor' && inicioDa(v) + 60 * 60_000 > agora), [visitas, agora]);
  const proxima = futuras[0];
  const depois = futuras.slice(1, 6);
  const tarefas = useMemo(() => atividades.filter((a) => isoDoInstante(a.disponivel_em) <= hoje)
    .sort((a, b) => a.vence_em.localeCompare(b.vence_em)).slice(0, 5), [atividades, hoje]);

  const abrirConversa = (leadId: string | null) => {
    if (!leadId) return;
    const conv = conversaDoLead.get(leadId);
    if (conv) navigate(`/app/c/${conv}`);
    else iniciar.mutate({ lead: leadId }, { onSuccess: (id) => navigate(`/app/c/${String(id)}`) });
  };
  const mapa = (v: MinhaVisita) => {
    const destino = [v.local_nome, v.meeting_address, v.meeting_neighborhood, 'Fortaleza'].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}`;
  };

  const convite = convites[0];
  const avisos = esperando.length + convites.length;
  const nome = profile?.first_name;
  const foto = (profile as { avatar_url?: string | null } | null)?.avatar_url;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
      {/* Cabeçalho da marca: me mude | CONNECT e o sino com o que espera por você */}
      <div className="flex items-center justify-between px-5 pb-1 pt-[max(0.9rem,env(safe-area-inset-top))]">
        <Marca rotulo="Connect" />
        <button type="button" onClick={() => navigate('/app/conversas?filtro=aguardando')}
          aria-label={avisos ? `${avisos} cliente(s) esperando você` : 'Avisos'}
          className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-mm-borda-suave bg-card text-primary shadow-sm transition active:scale-95">
          <Bell className="h-5 w-5" aria-hidden />
          {avisos > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-mm-acao px-1 text-[11px] font-extrabold text-white">{avisos > 9 ? '9+' : avisos}</span>}
        </button>
      </div>

      {/* Saudação com o rosto de quem está usando */}
      <header className="flex items-center gap-3 px-5 pb-4 pt-3">
        <Link to="/app/perfil" aria-label="Meu perfil e foto" className="shrink-0 rounded-full">
          <AvatarContato nome={[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Corretor'} chave={profile?.user_id} foto={foto} tamanho="lg" className="ring-2 ring-mm-lilas" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[22px] font-extrabold leading-tight tracking-[-0.02em]">{periodoDoDia()}{nome ? `, ${nome}` : ''}</p>
          <p className="text-[13px] text-muted-foreground">{dataDeHoje()}</p>
        </div>
        {nota != null && (
          <button type="button" onClick={() => navigate('/app/perfil')} aria-label={`Sua nota com os clientes: ${nota.toFixed(1)}`}
            className="flex shrink-0 items-center gap-1 rounded-full bg-mm-lilas px-3 py-1.5 text-sm font-extrabold text-primary">
            <Star className="h-4 w-4 fill-current" aria-hidden /> {nota.toFixed(1).replace('.', ',')}
          </button>
        )}
      </header>

      <div className="space-y-7">
        {/* Chamado chegando: o cartão "ao vivo" */}
        {convite && (
          <div className="px-5">
            <CartaoChamado convite={convite} agora={agoraSeg} quantos={convites.length}
              aoAbrir={() => navigate({ search: `?convite=${convite.convite_id}` })} />
          </div>
        )}

        {(push.estado === 'inativo' || push.estado === 'instalar') && (
          <div className="mx-5 flex items-center gap-3 rounded-2xl border border-mm-borda-rosa bg-mm-rosa-palido p-3">
            <BellRing className="h-5 w-5 shrink-0 text-mm-acao" aria-hidden />
            <p className="flex-1 text-sm font-semibold leading-snug">
              {push.estado === 'instalar' ? 'Instale o app (Compartilhar → Adicionar à Tela de Início) para o chamado tocar no seu celular.' : 'Ative as notificações para o chamado tocar no seu celular.'}
            </p>
            {push.estado === 'inativo' && <Button size="sm" variant="acao" onClick={push.ativar} disabled={push.ocupado}>Ativar</Button>}
          </div>
        )}

        {erro && !conversas.length && <div className="px-5"><FalhaCarregar aoTentar={() => tentar?.()} /></div>}

        {/* Visita que já aconteceu: o corretor conta como foi e o cliente segue o caminho certo */}
        {paraContar.length > 0 && (
          <Secao titulo="Como foi a visita?" extra={plural(paraContar.length, 'visita', 'visitas')}>
            <ul className="space-y-2 px-5">
              {paraContar.map((v) => {
                const e = v.empreendimentos as { nome?: string; imagem_url?: string | null } | null;
                const cliente = (v.leads as { nome?: string } | null)?.nome ?? 'Cliente';
                return (
                  <li key={v.id} className="flex items-center gap-3 rounded-2xl border border-mm-borda-rosa bg-mm-rosa-palido p-3">
                    <FotoEmpreendimento url={e?.imagem_url} nome={e?.nome} className="h-12 w-12 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold">{cliente}</p>
                      <p className="truncate text-[13px] text-muted-foreground">{e?.nome ?? 'Empreendimento'} · {quandoCurto(v.data_visita, String(v.horario_visita))}</p>
                    </div>
                    <Button variant="acao" size="sm" className="h-10 shrink-0 px-4" onClick={() => setContando(v)}>Contar</Button>
                  </li>
                );
              })}
            </ul>
          </Secao>
        )}

        {/* Próxima visita, com a foto do imóvel */}
        <Secao titulo="Sua próxima visita">
          <div className="px-5">
            {carregandoVis ? <Skeleton className="aspect-[16/10] w-full rounded-[24px]" /> : erroVis && !visitas.length ? (
              <FalhaCarregar aoTentar={() => recarregarVis()} />
            ) : !proxima ? (
              <div className="overflow-hidden rounded-[24px] bg-gradient-to-br from-[#422F91] to-[#6A4FD0] p-5 text-white">
                <p className="text-lg font-extrabold">Nenhuma visita marcada</p>
                <p className="mt-1 text-sm text-white/80">Quando a MeMude tiver um cliente para você, o celular toca e a visita aparece aqui.</p>
              </div>
            ) : (
              <article className="overflow-hidden rounded-[24px] border border-mm-borda-suave bg-card shadow-[0_16px_36px_-24px_rgba(66,47,145,0.45)]">
                <div className="relative aspect-[16/9] w-full">
                  <FotoEmpreendimento url={emp(proxima)?.imagem_url} nome={emp(proxima)?.nome} className="absolute inset-0 h-full w-full" />
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[12px] font-extrabold text-[#1E1640]">
                    {proxima.data_visita === hoje ? 'Hoje' : diaRotulo(proxima.data_visita)} · {String(proxima.horario_visita).slice(0, 5)}
                  </span>
                  <span className="absolute right-3 top-3 rounded-full bg-mm-acao px-3 py-1 text-[12px] font-extrabold text-white">{faltaPara(inicioDa(proxima) - agora)}</span>
                  <div className="absolute inset-x-4 bottom-3 text-white">
                    <p className="truncate text-lg font-extrabold leading-tight">{emp(proxima)?.nome ?? 'Empreendimento'}</p>
                    <p className="flex items-center gap-1 truncate text-sm text-white/85">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />{[proxima.local_nome, proxima.meeting_neighborhood].filter(Boolean).join(' · ') || 'Local a confirmar'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4">
                  <AvatarContato nome={nomeLead(proxima)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold">{nomeLead(proxima)}</p>
                    <p className="text-[13px] text-muted-foreground">vai visitar com você</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                  <Button variant="outline" asChild className="h-11">
                    <a href={mapa(proxima)} target="_blank" rel="noreferrer noopener"><Navigation className="h-4 w-4" /> Como chegar</a>
                  </Button>
                  <Button variant="acao" className="h-11" disabled={iniciar.isPending} onClick={() => abrirConversa(proxima.lead_id)}>
                    {iniciar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Conversar
                  </Button>
                </div>
              </article>
            )}
          </div>
        </Secao>

        {/* Quem está esperando resposta: rostos, como nos stories */}
        {esperando.length > 0 && (
          <Secao titulo="Esperando você" extra={plural(esperando.length, 'cliente', 'clientes')}
            acao={{ rotulo: 'Ver todos', aoTocar: () => navigate('/app/conversas?filtro=aguardando') }}>
            <ul className="flex gap-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {esperando.slice(0, 10).map((c) => {
                const min = minutosEsperando(c.aguardando_desde, agora) ?? 0;
                const nivel = nivelEspera(min);
                return (
                  <li key={c.id} className="shrink-0">
                    <button type="button" onClick={() => navigate(`/app/c/${c.id}`)} className="flex w-[68px] flex-col items-center gap-1.5"
                      aria-label={`Responder ${nomeDaConversa(c)}, esperando há ${min} minutos`}>
                      <span className={cn('rounded-full p-[3px]', nivel === 'atrasado' ? 'bg-mm-acao' : nivel === 'atencao' ? 'bg-mm-alerta' : 'bg-mm-sucesso')}>
                        <AvatarContato nome={nomeDaConversa(c)} chave={c.id} foto={c.foto_url} tamanho="lg" className="ring-2 ring-background" />
                      </span>
                      <span className="w-full truncate text-center text-[12px] font-bold">{nomeDaConversa(c).split(' ')[0]}</span>
                      <span className={cn('-mt-1 text-[11px] font-semibold', nivel === 'atrasado' ? 'text-mm-rosa-texto' : 'text-muted-foreground')}>
                        {min < 60 ? `${min} min` : `${Math.floor(min / 60)} h`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Secao>
        )}

        {/* Depois da visita: o próximo passo é seu */}
        {posVisita.length > 0 && (
          <Secao titulo="Visitaram e esperam o próximo passo">
            <ul className="space-y-2 px-5">
              {posVisita.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => navigate(`/app/c/${c.id}`)}
                    className="flex w-full items-start gap-3 rounded-2xl border border-mm-borda-suave bg-card p-3.5 text-left transition active:scale-[0.99]">
                    <AvatarContato nome={nomeDaConversa(c)} chave={c.id} foto={c.foto_url} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5"><span className="truncate text-[15px] font-bold">{nomeDaConversa(c)}</span><Temperatura valor={c.temperatura} /></span>
                      <span className="line-clamp-2 text-[13px] text-muted-foreground">{c.resumo_ia ?? c.ultima_previa ?? 'Visitou o imóvel. Que tal retomar?'}</span>
                      <span className="mt-1 inline-block text-[12px] font-bold text-mm-rosa-texto">
                        Sem conversa há {Math.max(1, Math.floor((agora - new Date(c.ultima_mensagem_em ?? agora).getTime()) / UM_DIA))} dia(s)
                      </span>
                    </span>
                    <ChevronRight className="mt-3 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {/* O que fazer hoje */}
        <Secao titulo="Para fazer hoje" extra={tarefas.length ? plural(tarefas.length, 'item', 'itens') : undefined}>
          <div className="px-5">
            {carregandoAtiv ? <Skeleton className="h-16 w-full rounded-2xl" /> : !tarefas.length ? (
              <p className="rounded-2xl bg-mm-lilas p-4 text-sm font-semibold text-primary">Nada pendente. Bom momento para mandar um oi para quem visitou.</p>
            ) : (
              <ul className="divide-y divide-mm-borda-suave overflow-hidden rounded-2xl border border-mm-borda-suave bg-card">
                {tarefas.map((a) => {
                  const atrasada = new Date(a.vence_em).getTime() < agora;
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <button type="button" onClick={() => concluir.mutate(a.id)} disabled={concluir.isPending} aria-label={`Concluir ${a.titulo}`}
                        className="group flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-mm-campo transition hover:border-primary">
                        <Check className="h-3.5 w-3.5 text-primary opacity-0 transition group-hover:opacity-100" aria-hidden />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-bold">{a.titulo}</p>
                        <p className={cn('truncate text-[13px]', atrasada ? 'font-semibold text-mm-rosa-texto' : 'text-muted-foreground')}>
                          {atrasada ? 'Atrasada' : `Até ${horaDe(a.vence_em)}`}{a.lead_nome ? ` · ${a.lead_nome}` : ''}
                        </p>
                      </div>
                      {a.conversa_id && (
                        <button type="button" onClick={() => navigate(`/app/c/${a.conversa_id}`)} aria-label={`Abrir conversa de ${a.titulo}`}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary transition active:scale-95">
                          <MessageCircle className="h-5 w-5" aria-hidden />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Secao>

        {/* Próximas visitas em cartões com foto */}
        {depois.length > 0 && (
          <Secao titulo="Próximas visitas" acao={{ rotulo: 'Agenda', aoTocar: () => navigate('/app/agenda') }}>
            <ul className="flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {depois.map((v) => (
                <li key={v.id} className="w-[220px] shrink-0">
                  <button type="button" onClick={() => abrirConversa(v.lead_id)} className="block w-full overflow-hidden rounded-2xl border border-mm-borda-suave bg-card text-left">
                    <div className="relative h-28 w-full">
                      <FotoEmpreendimento url={emp(v)?.imagem_url} nome={emp(v)?.nome} className="absolute inset-0 h-full w-full" />
                      <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-extrabold text-[#1E1640]">
                        {quandoCurto(v.data_visita, String(v.horario_visita))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 p-3">
                      <AvatarContato nome={nomeLead(v)} tamanho="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-bold">{nomeLead(v)}</span>
                        <span className="block truncate text-[12px] text-muted-foreground">{emp(v)?.nome ?? 'Empreendimento'}</span>
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {carregando && !conversas.length && <div className="px-5"><Skeleton className="h-16 w-full rounded-2xl" /></div>}
      </div>
      <ComoFoiVisita visita={contando} aberto={!!contando} aoFechar={() => setContando(null)} />
    </div>
  );
}

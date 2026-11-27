import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { moeda } from '@/lib/comercial/periodo';
import type { Contagem, DadosApresentacao, Numeros } from './dados';

// Paleta da apresentação (mesma do sistema)
const ROXO = '#2b1d6e';
const ROSA = '#e92662';
const LILAS = '#c9c1ea';

const pct1 = (v: number, total: number) => (total ? `${((v / total) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '—');
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const mesCurto = (chave: string) => MESES[Number(chave.slice(5, 7)) - 1];
const dataBR = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "Ricardo Machado de Lima Junior" → "Ricardo Lima" (pula Junior, Filho, Neto, Sobrinho). */
function nomeCurto(nome: string) {
  const p = nome.trim().split(/\s+/);
  if (p.length <= 2 || /^sem\s/i.test(nome.trim())) return nome.trim();
  const sufixos = ['junior', 'júnior', 'filho', 'neto', 'sobrinho', 'jr', 'jr.'];
  let ult = p[p.length - 1];
  if (sufixos.includes(ult.toLowerCase()) && p.length > 2) ult = p[p.length - 2];
  return `${p[0]} ${ult}`;
}

const tituloCaso = (s: string) => {
  const t = s.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// ---------- peças comuns ----------
function Rotulo({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('mb-3 text-sm font-bold uppercase tracking-[0.12em] text-primary-dark', className)}>{children}</h3>;
}

function Nota({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-sm text-muted-foreground">{children}</p>;
}

function Vazio({ texto }: { texto: string }) {
  return <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-dashed text-lg text-muted-foreground">{texto}</div>;
}

/** Barra dupla: fundo lilás = agendadas, rosa = realizadas. */
function BarraDupla({ rotulo, c, max }: { rotulo: string; c: Contagem; max: number }) {
  const largura = max ? (c.agendadas / max) * 100 : 0;
  const real = c.agendadas ? (c.realizadas / c.agendadas) * 100 : 0;
  return (
    <li className="grid grid-cols-[10rem_1fr_9.5rem] items-center gap-3">
      <span className="truncate text-right text-base font-medium" title={rotulo}>{rotulo}</span>
      <div className="h-8 rounded-lg bg-muted">
        <div className="relative h-8 overflow-hidden rounded-lg" style={{ width: `${Math.max(largura, 3)}%`, background: LILAS }}>
          <div className="h-full rounded-lg" style={{ width: `${real}%`, background: ROSA }} />
        </div>
      </div>
      <span className="whitespace-nowrap text-sm tabular-nums"><b className="text-base">{c.agendadas}</b> agend. · <b className="text-base text-secondary">{c.realizadas}</b> realiz.</span>
    </li>
  );
}

function LegendaDupla() {
  return (
    <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: LILAS }} />Agendadas</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: ROSA }} />Realizadas</span>
    </div>
  );
}

function Tabela({ cabecalho, children, rodape, alinhar }: {
  cabecalho: string[]; children: React.ReactNode; rodape?: React.ReactNode; alinhar?: ('left' | 'right' | 'center')[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border shadow-sm">
      <table className="w-full border-collapse text-base">
        <thead>
          <tr style={{ background: ROXO }}>
            {cabecalho.map((c, i) => (
              <th key={c} className={cn('px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white', `text-${alinhar?.[i] ?? 'left'}`)}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
        {rodape && <tfoot>{rodape}</tfoot>}
      </table>
    </div>
  );
}

// ---------- 1) Contratos assinados ----------
export function SlideContratos({ d }: { d: DadosApresentacao }) {
  if (!d.contratos.length) return <Vazio texto="Nenhum contrato assinado no período" />;
  const soma = (k: 'vgv' | 'comissao_liquida' | 'valor_memude') => d.contratos.reduce((s, c) => s + Number(c[k] ?? 0), 0);
  return (
    <div>
      <Tabela cabecalho={['Cliente', 'Empreendimento', 'Corretor', 'Recebimento', 'Origem', 'VGV', 'Comissão líquida', 'Valor MeMude']}
        alinhar={['left', 'left', 'left', 'center', 'center', 'right', 'right', 'right']}
        rodape={(
          <tr style={{ background: ROXO }} className="text-white">
            <td colSpan={5} className="px-4 py-3.5 text-center font-bold uppercase">Total · {d.contratos.length} {d.contratos.length === 1 ? 'contrato' : 'contratos'}</td>
            <td className="px-4 py-3.5 text-right font-bold tabular-nums">{moeda(soma('vgv'))}</td>
            <td className="px-4 py-3.5 text-right font-bold tabular-nums">{moeda(soma('comissao_liquida'))}</td>
            <td className="px-4 py-3.5 text-right font-bold tabular-nums">{moeda(soma('valor_memude'))}</td>
          </tr>
        )}>
        {d.contratos.map((c, i) => (
          <tr key={i} className="bg-card">
            <td className="px-4 py-4 font-semibold">{c.cliente ?? '—'}</td>
            <td className="px-4 py-4">{c.empreendimento ?? '—'}</td>
            <td className="px-4 py-4">{nomeCurto(c.corretor)}</td>
            <td className="px-4 py-4 text-center tabular-nums">{dataBR(c.recebimento)}</td>
            <td className="px-4 py-4 text-center">{c.origem}{c.entrada && <span className="block text-xs text-muted-foreground">lead de {mesCurto(c.entrada)}/{c.entrada.slice(0, 4)}</span>}</td>
            <td className="px-4 py-4 text-right tabular-nums">{moeda(c.vgv)}</td>
            <td className="px-4 py-4 text-right tabular-nums">{moeda(c.comissao_liquida)}</td>
            <td className="px-4 py-4 text-right font-bold tabular-nums text-secondary">{moeda(c.valor_memude)}</td>
          </tr>
        ))}
      </Tabela>
      <Nota>Vendas pela data da venda. Valor MeMude = parte da comissão líquida que fica com a MeMude.</Nota>
    </div>
  );
}

// ---------- 2) Origem de leads e vendas por canal ----------
export function SlideCanais({ d, atual, anterior }: { d: DadosApresentacao; atual: Numeros; anterior: Numeros }) {
  const totalLeads = d.canais.reduce((s, c) => s + c.leads, 0);
  const totalVgv = d.canais.reduce((s, c) => s + Number(c.vgv), 0);
  const max = Math.max(...d.canais.map((c) => c.leads), 1);
  if (!d.canais.length) return <Vazio texto="Nenhum lead no período" />;
  return (
    <div>
      <Tabela cabecalho={['Canal', 'Leads', 'Qualificados', 'Vendas', 'VGV']} alinhar={['left', 'left', 'center', 'center', 'right']}>
        {d.canais.map((c) => (
          <tr key={c.fonte} className="bg-card">
            <td className="px-4 py-3.5 text-lg font-extrabold uppercase text-primary-dark">{c.fonte}</td>
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-3 w-48 rounded-full bg-muted"><div className="h-3 rounded-full" style={{ width: `${(c.leads / max) * 100}%`, background: ROSA }} /></div>
                <span className="tabular-nums"><b>{c.leads}</b> <span className="text-muted-foreground">({pct1(c.leads, totalLeads)})</span></span>
              </div>
            </td>
            <td className="px-4 py-3.5 text-center tabular-nums"><b>{c.qualificados}</b> <span className="text-muted-foreground">({pct1(c.qualificados, c.leads)})</span></td>
            <td className="px-4 py-3.5 text-center tabular-nums">{c.vendas ? <b>{c.vendas} {c.vendas === 1 ? 'venda' : 'vendas'}</b> : <span className="text-muted-foreground">—</span>}</td>
            <td className="px-4 py-3.5 text-right tabular-nums">
              {Number(c.vgv) ? <><b>{moeda(c.vgv)}</b><span className="block text-xs text-muted-foreground">{pct1(Number(c.vgv), totalVgv)} do VGV</span></> : <span className="text-muted-foreground">—</span>}
            </td>
          </tr>
        ))}
      </Tabela>
      <Nota>
        Qualificação geral {pct1(atual.qualificados, atual.leads)} no período (período anterior: {pct1(anterior.qualificados, anterior.leads)}).
        Qualificado = em conversa, interessado, investidor ou mais avançado, ou com visita. Sem renda, não interessado, corretor, inválido, já comprou e não no momento nunca contam.
      </Nota>
    </div>
  );
}

// ---------- 3) Status dos leads ----------
const GRUPOS: { nome: string; cor: string; status: string[] }[] = [
  { nome: 'Qualificado / em atendimento', cor: ROXO, status: ['em conversa', 'interessado', 'investidor', 'visita agendada', 'visitou', 'documentacao', 'doc aprovada', 'negociacao', 'aguardando assinatura', 'vendido', 'vendido!'] },
  { nome: 'Sem resposta', cor: ROSA, status: ['novo', 'sem interacao', 'sem resposta', 'follow', 'follow up'] },
  { nome: 'Descartado / perda', cor: '#8a3c9e', status: ['nao interessado', 'sem renda', 'corretor', 'invalido', 'nao no momento', 'ja comprou', 'perdido', 'desistiu'] },
];
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function SlideStatus({ d }: { d: DadosApresentacao }) {
  const total = d.status_leads.reduce((s, x) => s + x.total, 0);
  if (!total) return <Vazio texto="Nenhum lead no período" />;
  const grupos = GRUPOS.map((g) => ({ ...g, total: d.status_leads.filter((x) => g.status.includes(norm(x.status))).reduce((s, x) => s + x.total, 0) }));
  const outros = total - grupos.reduce((s, g) => s + g.total, 0);
  if (outros > 0) grupos.push({ nome: 'Outros', cor: '#94a3b8', status: [], total: outros });
  const rotulo = (s: string) => (norm(s) === 'novo' ? 'Novo / sem resposta' : tituloCaso(s));
  const metade = Math.ceil(d.status_leads.length / 2);
  return (
    <div className="space-y-8">
      <div className="flex h-36 overflow-hidden rounded-2xl shadow-sm">
        {grupos.filter((g) => g.total).map((g) => (
          <div key={g.nome} className="flex min-w-[9rem] flex-col items-center justify-center px-4 text-center text-white" style={{ width: `${(g.total / total) * 100}%`, background: g.cor }}>
            <span className="text-base font-medium">{g.nome}</span>
            <span className="text-3xl font-extrabold tabular-nums">{g.total}</span>
            <span className="text-sm opacity-90">{pct1(g.total, total)}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-16">
        {[d.status_leads.slice(0, metade), d.status_leads.slice(metade)].map((col, i) => (
          <ul key={i} className="space-y-2.5">
            {col.map((x) => (
              <li key={x.status} className="flex items-baseline justify-between border-b border-dashed pb-2 text-xl">
                <span>{rotulo(x.status)}</span>
                <span className="tabular-nums"><b>{x.total}</b> <span className="text-base text-muted-foreground">({pct1(x.total, total)})</span></span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

// ---------- 4) Desempenho por corretor ----------
export function SlideCorretores({ d }: { d: DadosApresentacao }) {
  const vendas = new Map(d.corretores_vendas.map((c) => [c.corretor, c]));
  const visitas = new Map(d.corretores_visitas.map((c) => [c.corretor, c]));
  const nomes = [...new Set([...d.corretores_vendas.map((c) => c.corretor), ...d.corretores_visitas.map((c) => c.corretor)])]
    .filter((n) => n !== 'Sem corretor definido' && n !== 'Sem corretor')
    .sort((a, b) => Number(vendas.get(b)?.vgv ?? 0) - Number(vendas.get(a)?.vgv ?? 0) || (visitas.get(b)?.realizadas ?? 0) - (visitas.get(a)?.realizadas ?? 0));
  const vgvTotal = d.corretores_vendas.reduce((s, c) => s + Number(c.vgv), 0);
  const v = d.visitas;
  return (
    <div className="grid grid-cols-[1fr_17rem] gap-6">
      <Tabela cabecalho={['Corretor', 'Vendas', 'VGV', 'Comissão MeMude', 'Visitas']} alinhar={['left', 'center', 'left', 'right', 'center']}>
        {nomes.map((n) => {
          const s = vendas.get(n); const vi = visitas.get(n);
          return (
            <tr key={n} className="bg-card">
              <td className="px-4 py-3 text-lg font-extrabold uppercase text-primary-dark">{nomeCurto(n)}</td>
              <td className="px-4 py-3 text-center text-lg tabular-nums">{s?.vendas ?? 0}</td>
              <td className="px-4 py-3">
                {s ? (
                  <div>
                    <span className="tabular-nums">{moeda(s.vgv)} <span className="text-secondary">({pct1(Number(s.vgv), vgvTotal)})</span></span>
                    <div className="mt-1 h-2.5 w-48 rounded-full bg-muted"><div className="h-2.5 rounded-full" style={{ width: `${vgvTotal ? (Number(s.vgv) / vgvTotal) * 100 : 0}%`, background: ROSA }} /></div>
                  </div>
                ) : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{s ? <b className="text-secondary">{moeda(s.comissao_memude)}</b> : <span className="text-muted-foreground">—</span>}</td>
              <td className="px-4 py-3 text-center tabular-nums">{vi ? <><b>{vi.agendadas}</b> agend. · <b className="text-secondary">{vi.realizadas}</b> realiz.</> : '—'}</td>
            </tr>
          );
        })}
      </Tabela>
      <div className="flex flex-col justify-center gap-4 rounded-2xl p-6 text-center text-white shadow-sm" style={{ background: ROXO }}>
        <p className="text-lg font-extrabold uppercase leading-tight">Esforço da equipe<br />(total geral)</p>
        <div><p className="text-5xl font-black tabular-nums">{v.agendadas}</p><p className="text-sm opacity-80">visitas agendadas</p></div>
        <div><p className="text-5xl font-black tabular-nums" style={{ color: '#ff8fb3' }}>{v.realizadas}</p><p className="text-sm opacity-80">realizadas</p></div>
        <p className="rounded-lg bg-white/10 py-2 text-base"><b>{pct1(v.realizadas, v.agendadas)}</b> de comparecimento</p>
      </div>
    </div>
  );
}

// ---------- 5) Visitas: resultado e origem ----------
export function SlideVisitasResultado({ d }: { d: DadosApresentacao }) {
  const v = d.visitas;
  const naoAconteceram = d.nao_aconteceram.reduce((s, x) => s + x.total, 0);
  const maxMotivo = Math.max(...d.nao_aconteceram.map((x) => x.total), 1);
  const linhas = (lista: ({ nome: string } & Contagem)[]) => lista.map((x) => (
    <tr key={x.nome} className="bg-card">
      <td className="px-4 py-3 font-medium">{x.nome}</td>
      <td className="px-4 py-3 text-center tabular-nums">{x.agendadas}</td>
      <td className="px-4 py-3 text-center tabular-nums">{x.realizadas}</td>
      <td className="px-4 py-3 text-right font-bold tabular-nums text-secondary">{pct1(x.realizadas, x.agendadas)}</td>
    </tr>
  ));
  return (
    <div className="grid grid-cols-2 gap-10">
      <div>
        <div className="grid grid-cols-3 gap-4">
          {[[v.agendadas, 'Agendadas'], [v.realizadas, 'Realizadas'], [pct1(v.realizadas, v.agendadas), 'Comparecimento']].map(([valor, rot]) => (
            <div key={String(rot)} className="rounded-2xl border-t-4 bg-muted/60 p-5 text-center" style={{ borderTopColor: ROSA }}>
              <p className="text-5xl font-black tabular-nums text-secondary">{valor}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{rot}</p>
            </div>
          ))}
        </div>
        <Rotulo className="mt-8">{naoAconteceram ? `As ${naoAconteceram} que não aconteceram` : 'Todas as visitas aconteceram ou estão por acontecer'}</Rotulo>
        <ul className="space-y-2.5">
          {d.nao_aconteceram.map((x) => (
            <li key={x.motivo} className="grid grid-cols-[11rem_1fr] items-center gap-3">
              <span className="text-right text-base">{x.motivo}</span>
              <div className="h-8 rounded-lg bg-muted">
                <div className="flex h-8 items-center justify-end rounded-lg px-3 text-sm font-bold text-white" style={{ width: `${Math.max((x.total / maxMotivo) * 100, 8)}%`, background: ROSA }}>{x.total}</div>
              </div>
            </li>
          ))}
        </ul>
        {d.realizadas_rotulos.length > 0 && (
          <Nota>Situação das {v.realizadas} realizadas: {d.realizadas_rotulos.map((r) => `${r.rotulo} ${r.total}`).join(' · ')}.</Nota>
        )}
        {v.futuras > 0 && <Nota>{v.futuras} {v.futuras === 1 ? 'visita ainda vai acontecer' : 'visitas ainda vão acontecer'} no período.</Nota>}
      </div>
      <div>
        <Rotulo>Comparecimento por origem e formato</Rotulo>
        <Tabela cabecalho={['', 'Agend.', 'Realiz.', 'Compar.']} alinhar={['left', 'center', 'center', 'right']}>
          {linhas(d.comparecimento_origem.map((x) => ({ ...x, nome: x.fonte })))}
          <tr><td colSpan={4} className="p-0"><div className="h-1" style={{ background: ROXO }} /></td></tr>
          {linhas(d.comparecimento_formato.map((x) => ({ ...x, nome: x.formato })))}
        </Tabela>
      </div>
    </div>
  );
}

// ---------- 6) Visitas: evolução ----------
export function SlideVisitasEvolucao({ d }: { d: DadosApresentacao }) {
  const dados = d.evolucao.map((m) => ({ mes: mesCurto(m.mes), agendadas: m.agendadas, realizadas: m.realizadas }));
  const acum = d.evolucao.reduce((s, m) => ({ a: s.a + m.agendadas, r: s.r + m.realizadas }), { a: 0, r: 0 });
  const n = d.evolucao.length || 1;
  const ult = d.evolucao[d.evolucao.length - 1];
  const pen = d.evolucao[d.evolucao.length - 2];
  const varia = (a: number, b: number) => (b ? `${a >= b ? '+' : ''}${(((a - b) / b) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—');
  const maxSem = Math.max(...d.semanas.map((s) => s.agendadas), 1);
  return (
    <div className="grid grid-cols-[1.15fr_1fr] gap-10">
      <div>
        <Rotulo>Agendadas × realizadas por mês</Rotulo>
        <LegendaDupla />
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 26, right: 4, left: 4, bottom: 0 }} barGap={6}>
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 18, fontWeight: 800, fill: ROXO }} />
              <Bar dataKey="agendadas" fill={LILAS} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="agendadas" position="top" style={{ fontSize: 15, fontWeight: 700, fill: '#6b6880' }} />
              </Bar>
              <Bar dataKey="realizadas" fill={ROSA} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="realizadas" position="top" style={{ fontSize: 15, fontWeight: 700, fill: ROSA }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Nota>
          Acumulado: {acum.a} agendadas e {acum.r} realizadas ({pct1(acum.r, acum.a)}) · média de {(acum.a / n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} e {(acum.r / n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por mês.
          {ult && pen && ` ${mesCurto(ult.mes)} × ${mesCurto(pen.mes)}: agendadas ${varia(ult.agendadas, pen.agendadas)} e realizadas ${varia(ult.realizadas, pen.realizadas)}.`}
        </Nota>
      </div>
      <div>
        <Rotulo>Taxa de comparecimento</Rotulo>
        <div className="grid grid-cols-6 gap-2">
          {d.evolucao.map((m, i) => {
            const atual = i === d.evolucao.length - 1;
            return (
              <div key={m.mes} className="rounded-xl border-t-4 bg-muted/60 px-1 py-3 text-center" style={{ borderTopColor: atual ? ROSA : LILAS }}>
                <p className={cn('text-xl font-black tabular-nums', atual ? 'text-secondary' : 'text-primary-dark')}>{pct1(m.realizadas, m.agendadas)}</p>
                <p className="text-xs text-muted-foreground">{mesCurto(m.mes)}</p>
              </div>
            );
          })}
        </div>
        <Rotulo className="mt-8">Visitas por semana do período</Rotulo>
        <LegendaDupla />
        <ul className="space-y-2.5">
          {d.semanas.map((s, i) => (
            <BarraDupla key={s.inicio} rotulo={`Sem. ${i + 1} (${diaMes(s.inicio)}–${diaMes(s.fim)})`} c={s} max={maxSem} />
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------- 7) Visitas: corretores e empreendimentos ----------
export function SlideVisitasRanking({ d }: { d: DadosApresentacao }) {
  const maxC = Math.max(...d.corretores_visitas.map((c) => c.agendadas), 1);
  const maxE = Math.max(...d.empreendimentos_visitas.map((c) => c.agendadas), 1);
  if (!d.corretores_visitas.length) return <Vazio texto="Nenhuma visita no período" />;
  return (
    <div className="grid grid-cols-2 gap-12">
      <div>
        <Rotulo>Por corretor</Rotulo>
        <LegendaDupla />
        <ul className="space-y-2.5">{d.corretores_visitas.map((c) => <BarraDupla key={c.corretor} rotulo={nomeCurto(c.corretor)} c={c} max={maxC} />)}</ul>
      </div>
      <div>
        <Rotulo>Empreendimentos mais visitados</Rotulo>
        <LegendaDupla />
        <ul className="space-y-2.5">{d.empreendimentos_visitas.map((e) => <BarraDupla key={e.empreendimento} rotulo={e.empreendimento} c={e} max={maxE} />)}</ul>
      </div>
    </div>
  );
}

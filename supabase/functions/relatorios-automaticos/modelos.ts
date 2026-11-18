import { br, classe, diaISO, type LeadR, type VisitaR } from './dados.ts';

const ROSA = '#e92662';
const ROSA_CLARO = '#fdeef3';
const ROXO = '#422f91';
const ROXO_CLARO = '#f1effa';
const TEXTO = '#1a1a2e';
const LOGO = 'https://www.memude.com.br/wp-content/themes/memudev2/assets/images/Logo-1.png';
const F = 'font-family:Arial,sans-serif;';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function contar<T>(lista: T[], chave: (x: T) => string) {
  const r: Record<string, number> = {};
  for (const x of lista) { const k = chave(x) || '—'; r[k] = (r[k] ?? 0) + 1; }
  return r;
}

function diff(a: number, b: number) {
  const d = a - b;
  if (d > 0) return `<span style="color:#16a34a;font-size:11px;${F}font-weight:600;">▲ +${d} vs ontem</span>`;
  if (d < 0) return `<span style="color:#dc2626;font-size:11px;${F}font-weight:600;">▼ ${d} vs ontem</span>`;
  return `<span style="color:#999;font-size:11px;${F}">= igual a ontem</span>`;
}

const selo = (bg: string, cor: string, txt: string) =>
  `<span style="background:${bg};color:${cor};font-size:11px;padding:3px 10px;border-radius:20px;${F}font-weight:600;">${txt}</span>`;

const th = (t: string, alinha = 'left') =>
  `<th style="padding:9px 14px;text-align:${alinha};font-size:11px;color:#999;text-transform:uppercase;${F}font-weight:600;border-bottom:2px solid #f0f0f0;">${t}</th>`;
const td = (t: string, extra = '') => `<td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;${F}font-size:13px;color:#333;${extra}">${t}</td>`;

function tabela(dados: Record<string, number>, total: number) {
  const entradas = Object.entries(dados).sort((a, b) => b[1] - a[1]);
  if (!entradas.length) return `<p style="color:#999;padding:12px;text-align:center;${F}">Nenhum registro</p>`;
  const max = Math.max(...entradas.map((e) => e[1]));
  const linhas = entradas.map(([k, v]) => `<tr>${td(esc(k))}${td(String(v), `text-align:center;font-weight:700;color:${TEXTO};`)}
    <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;width:130px;"><div style="background:#f0f0f0;border-radius:4px;height:7px;">
    <div style="background:${ROSA};border-radius:4px;height:7px;width:${Math.round((v / max) * 100)}%;"></div></div></td>
    ${td(`${total ? ((v / total) * 100).toFixed(1) : '0.0'}%`, 'text-align:right;font-size:12px;color:#999;')}</tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#fafafa;">${th('Nome')}${th('Qtd', 'center')}${th('Barra')}${th('%', 'right')}</tr></thead>
    <tbody>${linhas}</tbody><tfoot><tr style="background:#fafafa;"><td style="padding:9px 14px;font-weight:700;${F}font-size:13px;">Total</td>
    <td style="padding:9px 14px;text-align:center;font-weight:700;${F}font-size:13px;">${total}</td><td></td>
    <td style="padding:9px 14px;text-align:right;font-weight:700;${F}font-size:13px;">100%</td></tr></tfoot></table>`;
}

function corStatus(s: string) {
  const c = classe(s);
  if (c === 'venda') return '#16a34a';
  if (c === 'furo' || /desist/i.test(s)) return '#dc2626';
  if (c === 'realizada' || /document/i.test(s)) return ROXO;
  if (c === 'agendada') return ROSA;
  return '#d97706';
}

function cabecalho(rotulo: string, titulo: string, periodo: string) {
  return `<tr><td style="background:#fff;padding:28px 32px 24px;text-align:center;border-bottom:3px solid ${ROSA};">
    <img src="${LOGO}" alt="Portal MeMude" style="height:38px;display:block;margin:0 auto 18px;" />
    <p style="color:#999;font-size:10px;margin:0 0 6px;letter-spacing:2px;text-transform:uppercase;${F}font-weight:600;">${rotulo}</p>
    <h1 style="color:${TEXTO};font-size:22px;margin:0 0 8px;font-weight:700;${F}">${titulo}</h1>
    ${selo(ROSA_CLARO, ROSA, periodo)}</td></tr>`;
}

const divisor = `<tr><td style="padding:24px 32px 0;"><div style="border-top:1px solid #f0f0f0;"></div></td></tr>`;

function envelope(conteudo: string, rodape: string) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f7f7f7;${F}"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:32px 0;"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">
${conteudo}
<tr><td style="padding:32px;"><div style="border-top:1px solid #f0f0f0;padding-top:24px;text-align:center;">
<img src="${LOGO}" alt="MeMude" style="height:28px;opacity:0.4;display:block;margin:0 auto 12px;" />
<p style="color:#bbb;font-size:11px;margin:0;${F}">${rodape}</p></div></td></tr>
</table></td></tr></table></body></html>`;
}

function secao(titulo: string, subtitulo: string, conteudo: string, badge = '') {
  return `<tr><td style="padding:24px 32px 0;"><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;"><tr>
    <td><h2 style="color:${TEXTO};font-size:15px;margin:0;${F}font-weight:700;">${titulo}</h2>
    <p style="color:#999;font-size:12px;margin:4px 0 0;${F}">${subtitulo}</p></td>${badge ? `<td align="right" valign="top">${badge}</td>` : ''}</tr></table>
    ${conteudo}</td></tr>${divisor}`;
}

// ===================== Boletim diário =====================
export function boletimDiario(leads: LeadR[], visitas: VisitaR[], meta: number) {
  const hoje = diaISO(0);
  const ontem = diaISO(-1);
  const proximos = Array.from({ length: 7 }, (_, i) => diaISO(i + 1));
  const leadsHoje = leads.filter((l) => l.data === hoje);
  const leadsOntem = leads.filter((l) => l.data === ontem);
  const visitasHoje = visitas.filter((v) => v.data === hoje);
  const visitasOntem = visitas.filter((v) => v.data === ontem);
  const proximas = visitas.filter((v) => proximos.includes(v.data) && classe(v.status) === 'agendada').sort((a, b) => a.data.localeCompare(b.data));

  const porFonte = contar(leadsHoje, (l) => l.fonte || 'Outros');
  const porStatus = contar(leadsHoje, (l) => l.status || 'Sem status');
  const porCorretor = contar(visitasHoje, (v) => v.corretor || 'Não informado');
  const realizadas = visitasHoje.filter((v) => classe(v.status) === 'realizada').length;
  const vendas = visitasHoje.filter((v) => classe(v.status) === 'venda').length;
  const furos = visitasHoje.filter((v) => classe(v.status) === 'furo').length;
  const agendadas = visitasHoje.filter((v) => classe(v.status) === 'agendada').length;
  const bateu = visitasHoje.length >= meta;

  const kpi = (rot: string, cor: string, bg: string, borda: string, n: number, extra: string) =>
    `<td width="48%" style="background:${bg};border-radius:12px;padding:20px;text-align:center;border:1px solid ${borda};">
      <p style="color:${cor};font-size:10px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;${F}font-weight:600;">${rot}</p>
      <p style="color:${TEXTO};font-size:42px;font-weight:700;margin:0 0 6px;${F}">${n}</p>${extra}</td>`;
  const mini = (rot: string, cor: string, bg: string, n: number) =>
    `<td width="23%" style="background:${bg};border-radius:10px;padding:14px;text-align:center;">
      <p style="color:${cor};font-size:10px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;${F}font-weight:600;">${rot}</p>
      <p style="color:${TEXTO};font-size:26px;font-weight:700;margin:0;${F}">${n}</p></td>`;

  const tabelaVisitas = !visitasHoje.length
    ? `<p style="color:#999;padding:20px;text-align:center;${F}font-size:13px;">Nenhuma visita registrada hoje</p>`
    : `<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#fafafa;">${th('Cliente')}${th('Imóvel')}${th('Corretor')}${th('Status')}</tr></thead><tbody>
      ${visitasHoje.map((v) => `<tr>${td(esc(v.cliente || '-'))}${td(esc(v.imovel || '-'), 'color:#555;')}${td(esc(v.corretor || '-'), 'color:#555;')}
      <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;"><span style="background:${corStatus(v.status)};color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;${F}white-space:nowrap;">${esc(v.status || '-')}</span></td></tr>`).join('')}
      </tbody></table>`;
  const tabelaProximas = !proximas.length
    ? `<p style="color:#999;padding:20px;text-align:center;${F}font-size:13px;">Nenhuma visita agendada nos próximos 7 dias</p>`
    : `<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#fafafa;">${th('Data')}${th('Cliente')}${th('Imóvel')}${th('Corretor')}</tr></thead><tbody>
      ${proximas.map((v) => `<tr>${td(br(v.data), `color:${ROSA};font-weight:600;`)}${td(esc(v.cliente || '-'))}${td(esc(v.imovel || '-'), 'color:#555;')}${td(esc(v.corretor || '-'), 'color:#555;')}</tr>`).join('')}
      </tbody></table>`;

  const corpo = `${cabecalho('Relatório Diário', 'Resumo Operacional', br(hoje))}
  <tr><td style="padding:28px 32px 0;"><table width="100%" cellpadding="0" cellspacing="0"><tr>
    ${kpi('Total de Leads', ROSA, ROSA_CLARO, '#fbd5e1', leadsHoje.length, diff(leadsHoje.length, leadsOntem.length))}<td width="4%"></td>
    ${kpi('Visitas Hoje', ROXO, ROXO_CLARO, '#ddd8f2', visitasHoje.length, diff(visitasHoje.length, visitasOntem.length))}
  </tr></table></td></tr>
  <tr><td style="padding:12px 32px 0;text-align:center;">${bateu ? selo('#f0fdf4', '#16a34a', `✓ Meta batida (${visitasHoje.length}/${meta})`) : selo('#fef2f2', '#dc2626', `✗ Abaixo da meta (${visitasHoje.length}/${meta})`)}</td></tr>
  ${divisor}
  ${secao('Leads por origem', 'Distribuição por canal de aquisição', tabela(porFonte, leadsHoje.length), selo(ROSA_CLARO, ROSA, `${leadsHoje.length} total`))}
  ${secao('Leads por status', 'Situação atual dos leads do dia', tabela(porStatus, leadsHoje.length))}
  ${secao('Agenda do dia', '', `${visitasHoje.length ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr>
      ${mini('Agendadas', ROSA, ROSA_CLARO, agendadas)}<td width="2%"></td>${mini('Realizadas', ROXO, ROXO_CLARO, realizadas)}<td width="2%"></td>
      ${mini('Furos', '#dc2626', '#fef2f2', furos)}<td width="2%"></td>${mini('Vendas', '#16a34a', '#f0fdf4', vendas)}</tr></table>` : ''}${tabelaVisitas}`,
    selo(ROXO_CLARO, ROXO, `${visitasHoje.length} visitas`))}
  ${visitasHoje.length ? secao('Visitas por corretor', 'Ranking de atendimentos', tabela(porCorretor, visitasHoje.length)) : ''}
  ${secao('Próximas visitas', 'Visitas agendadas nos próximos 7 dias', tabelaProximas, selo(ROSA_CLARO, ROSA, `${proximas.length} agendadas`))}`;

  const linhas = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  • ${k}: ${v}`).join('\n');
  const dt = (a: number, b: number) => { const d = a - b; return d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : '= igual'; };
  const whatsapp = `📊 *MeMude | Boletim Diário*\n📅 *${br(hoje)}*\n\n━━━━━━━━━━━━━━━\n📥 *LEADS*\nTotal: *${leadsHoje.length}* (${dt(leadsHoje.length, leadsOntem.length)} vs ontem)\n\n*Por origem:*\n${linhas(porFonte) || '  Sem dados'}\n\n*Por status:*\n${linhas(porStatus) || '  Sem dados'}\n\n━━━━━━━━━━━━━━━\n🏠 *VISITAS*\nTotal: *${visitasHoje.length}* (${dt(visitasHoje.length, visitasOntem.length)} vs ontem)\n${bateu ? `✅ Meta batida (${visitasHoje.length}/${meta})` : `❌ Abaixo da meta (${visitasHoje.length}/${meta})`}\n\n✅ Realizadas: ${realizadas}\n🏆 Vendas: ${vendas}\n❌ Furos: ${furos}\n📆 Agendadas: ${agendadas}\n\n━━━━━━━━━━━━━━━\n📅 *PRÓXIMAS VISITAS (7 dias)*\n${proximas.map((v) => `  📅 ${br(v.data)} | ${v.cliente || '-'} | ${v.imovel || '-'} | ${v.corretor || '-'}`).join('\n') || '  Nenhuma agendada'}\n\n_Enviado automaticamente • Portal MeMude_`;

  return {
    referencia: hoje,
    assunto: `MeMude | Boletim Diário | ${br(hoje)}`,
    html: envelope(corpo, 'Enviado automaticamente • Portal MeMude • MeMude Connect'),
    whatsapp,
    resumo: { leads: leadsHoje.length, visitas: visitasHoje.length, realizadas, vendas, furos, agendadas, proximas: proximas.length },
  };
}

// ===================== Relatório semanal =====================
const grafico = (config: unknown, w: number, h: number) =>
  `<img src="https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}&w=${w}&h=${h}&bkg=white&v=4" width="${w}" style="display:block;max-width:100%;height:auto;" alt="Gráfico" />`;

function agrupar(o: Record<string, number>, minPct = 3) {
  const total = Object.values(o).reduce((s, v) => s + v, 0);
  const r: Record<string, number> = {};
  let outros = 0;
  for (const [k, v] of Object.entries(o).sort((a, b) => b[1] - a[1])) {
    if (total && (v / total) * 100 >= minPct) r[k] = v; else outros += v;
  }
  if (outros) r['Outros'] = outros;
  return r;
}

const eixos = { y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { color: '#aaa', font: { size: 11 } } }, x: { grid: { display: false }, ticks: { color: '#666', font: { size: 11 } } } };

export function relatorioSemanal(leads: LeadR[], visitas: VisitaR[]) {
  const hoje = diaISO(0);
  const dias = Array.from({ length: 7 }, (_, i) => diaISO(i - 6));
  const inicio = dias[0];
  const leadsSemana = leads.filter((l) => dias.includes(l.data));
  const visitasSemana = visitas.filter((v) => dias.includes(v.data));
  const nomeDia = (iso: string) => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(`${iso}T12:00:00Z`).getUTCDay()] + ` ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const porDia = Object.fromEntries(dias.map((d) => [nomeDia(d), leadsSemana.filter((l) => l.data === d).length]));
  const porFonte = contar(leadsSemana, (l) => l.fonte || 'Outros');
  const porStatus = agrupar(contar(leadsSemana, (l) => l.status || 'Sem status'));
  const porCorretor = contar(visitasSemana, (v) => v.corretor || 'Não informado');
  const visitaStatus = agrupar(contar(visitasSemana, (v) => v.status || 'Sem status'));
  const vendas = visitasSemana.filter((v) => classe(v.status) === 'venda').length;
  const furos = visitasSemana.filter((v) => classe(v.status) === 'furo').length;
  const conversao = leadsSemana.length ? ((visitasSemana.length / leadsSemana.length) * 100).toFixed(1) : '0.0';
  const melhor = Object.entries(porDia).sort((a, b) => b[1] - a[1])[0] ?? ['-', 0];
  const ord = (o: Record<string, number>, n = 99) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  const cores = [ROSA, ROXO, '#16a34a', '#d97706', '#0891b2', '#7c3aed', '#dc2626', '#059669', '#ea580c'];

  const linha = grafico({ type: 'line', data: { labels: Object.keys(porDia), datasets: [{ data: Object.values(porDia), borderColor: ROSA, backgroundColor: 'rgba(233,38,98,0.08)', borderWidth: 2.5, pointBackgroundColor: ROSA, pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 6, fill: true, tension: 0.35 }] }, options: { plugins: { legend: { display: false } }, scales: eixos } }, 540, 220);
  const fontes = ord(porFonte, 7);
  const barra = grafico({ type: 'bar', data: { labels: fontes.map((f) => f[0]), datasets: [{ data: fontes.map((f) => f[1]), backgroundColor: ROSA, borderRadius: 6, borderSkipped: false }] }, options: { plugins: { legend: { display: false } }, scales: eixos } }, 540, 220);
  const pizza = (o: Record<string, number>) => { const e = ord(o); return grafico({ type: 'doughnut', data: { labels: e.map((x) => x[0]), datasets: [{ data: e.map((x) => x[1]), backgroundColor: cores.slice(0, e.length), borderWidth: 2.5, borderColor: '#fff' }] }, options: { plugins: { legend: { position: 'right', labels: { color: '#555', font: { size: 12 }, padding: 14, boxWidth: 14 } } }, cutout: '55%' } }, 520, 280); };
  const corr = ord(porCorretor, 8);
  const barraH = grafico({ type: 'bar', data: { labels: corr.map((c) => c[0]), datasets: [{ data: corr.map((c) => c[1]), backgroundColor: ROXO, borderRadius: 5, borderSkipped: false }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: eixos.y, y: { grid: { display: false }, ticks: { color: '#555', font: { size: 12 } } } } } }, 540, Math.max(160, corr.length * 48));

  const kpi = (rot: string, cor: string, bg: string, borda: string, n: string, sub: string) =>
    `<td width="22%" style="background:${bg};border-radius:12px;padding:16px;text-align:center;border:1px solid ${borda};">
      <p style="color:${cor};font-size:9px;text-transform:uppercase;letter-spacing:1px;margin:0 0 5px;${F}font-weight:600;">${rot}</p>
      <p style="color:${TEXTO};font-size:30px;font-weight:700;margin:0;${F}">${n}</p>
      <p style="color:#aaa;font-size:10px;margin:4px 0 0;${F}">${sub}</p></td>`;

  const corpo = `${cabecalho('Relatório Semanal', 'Resumo da Semana', `${br(inicio)} — ${br(hoje)}`)}
  <tr><td style="padding:28px 32px 0;"><table width="100%" cellpadding="0" cellspacing="0"><tr>
    ${kpi('Total Leads', ROSA, ROSA_CLARO, '#fbd5e1', String(leadsSemana.length), `~${(leadsSemana.length / 7).toFixed(1)}/dia`)}<td width="2%"></td>
    ${kpi('Visitas', ROXO, ROXO_CLARO, '#ddd8f2', String(visitasSemana.length), `~${(visitasSemana.length / 7).toFixed(1)}/dia`)}<td width="2%"></td>
    ${kpi('Vendas', '#16a34a', '#f0fdf4', '#dcfce7', String(vendas), `${furos} furos`)}<td width="2%"></td>
    ${kpi('Conversão', '#ca8a04', '#fefce8', '#fef08a', `${conversao}%`, 'lead → visita')}
  </tr></table></td></tr>
  <tr><td style="padding:16px 32px 0;"><div style="background:${ROXO_CLARO};border-radius:10px;padding:14px 18px;border-left:4px solid ${ROXO};">
    <p style="margin:0;${F}font-size:13px;color:${TEXTO};">🏆 <strong>Melhor dia da semana:</strong> <span style="color:${ROXO};font-weight:700;">${melhor[0]}</span> com <span style="color:${ROXO};font-weight:700;">${melhor[1]} leads</span></p>
  </div></td></tr>${divisor}
  ${secao('Evolução de leads na semana', 'Volume diário — últimos 7 dias', linha, selo(ROSA_CLARO, ROSA, `${leadsSemana.length} total`))}
  ${secao('Leads por canal de origem', 'Quais fontes trouxeram mais leads na semana', barra)}
  ${secao('Distribuição de status dos leads', 'Grupos abaixo de 3% somados em Outros', pizza(porStatus))}
  ${secao('Performance por corretor', 'Ranking de visitas na semana', barraH, selo(ROXO_CLARO, ROXO, `${visitasSemana.length} visitas`))}
  ${secao('Resultado das visitas', 'Como as visitas da semana se encerraram', pizza(visitaStatus))}`;

  return {
    referencia: hoje,
    assunto: `MeMude | Relatório Semanal | ${br(inicio)} - ${br(hoje)}`,
    html: envelope(corpo, `Enviado automaticamente • Portal MeMude • MeMude Connect · ${br(inicio)} — ${br(hoje)}`),
    whatsapp: null as string | null,
    resumo: { leads: leadsSemana.length, visitas: visitasSemana.length, vendas, furos, conversao },
  };
}

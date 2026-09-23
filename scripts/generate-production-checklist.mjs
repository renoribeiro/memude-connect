import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const inventoryPath = path.join(root, 'docs', 'production-ui-inventory.json');
const outputPath = path.join(root, 'docs', 'CHECKLIST_CERTIFICACAO_PRODUCAO_2026-08-13.md');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

const actionTags = new Set([
  'Button', 'button', 'Link', 'NavLink', 'a', 'form', 'Input', 'Textarea', 'Select',
  'SelectTrigger', 'Checkbox', 'Switch', 'TabsTrigger', 'DropdownMenuItem',
  'DialogTrigger', 'AlertDialogAction', 'AlertDialogCancel', 'CollapsibleTrigger', 'CommandItem',
]);

const commonLabels = [
  '<Button>', '<button>', '<DropdownMenuItem>', '<Switch>', '<Checkbox>',
];

function cleanLabel(control) {
  const label = String(control.label || '').trim();
  if (!label || commonLabels.includes(label)) {
    const action = control.attributes?.['aria-label'] || control.attributes?.title
      || control.attributes?.placeholder || control.attributes?.name;
    if (action) return String(action).replace(/\s+/g, ' ').trim();
    return `${control.tag} na linha ${control.line}`;
  }
  return label.replace(/\s+/g, ' ').trim();
}

function classify(control) {
  const attrs = control.attributes || {};
  if (control.tag === 'form') return 'submissão de formulário';
  if (['Input', 'Textarea', 'Select', 'SelectTrigger', 'Checkbox', 'Switch'].includes(control.tag)) return 'entrada/seleção';
  if (attrs.href || attrs.to || ['Link', 'NavLink', 'a'].includes(control.tag)) return 'navegação/link';
  return 'ação/botão';
}

function uniqueControls(files) {
  const seen = new Set();
  const result = [];
  for (const file of files) {
    for (const control of file.controls || []) {
      if (!actionTags.has(control.tag)) continue;
      const label = cleanLabel(control);
      const key = `${file.file}:${control.line}:${control.tag}:${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...control, file: file.file, label });
    }
  }
  return result;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

const routeSections = inventory.routes.map((route, routeIndex) => {
  const controls = uniqueControls(route.files);
  const tables = unique(route.files.flatMap((file) => file.tables || []));
  const functions = unique(route.files.flatMap((file) => file.functions || []));
  const rpcs = unique(route.files.flatMap((file) => file.rpcs || []));
  const rows = controls.map((control, index) => {
    const attrs = control.attributes || {};
    const expected = attrs.disabled === true || attrs.disabled === 'true'
      ? 'Deve permanecer indisponível com motivo explícito e sem sugerir funcionalidade pronta.'
      : classify(control) === 'navegação/link'
        ? 'Abre o destino correto, sem 404, erro de console ou perda indevida de contexto.'
        : classify(control) === 'submissão de formulário'
          ? 'Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela.'
          : classify(control) === 'entrada/seleção'
            ? 'Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo.'
            : 'Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro.';
    return `| [ ] ${routeIndex + 1}.${index + 1} | ${classify(control)} | ${control.label.replaceAll('|', '\\|')} | ${control.file}:${control.line} | ${expected} |`;
  }).join('\n');

  const dependencies = [
    tables.length ? `Tabelas: \`${tables.join('`, `')}\`` : '',
    functions.length ? `Edge Functions: \`${functions.join('`, `')}\`` : '',
    rpcs.length ? `RPCs: \`${rpcs.join('`, `')}\`` : '',
  ].filter(Boolean).join('  \n');

  return `## ${routeIndex + 1}. ${route.path} — ${route.component || 'redirecionamento'}\n\n`+
    `- Acesso esperado: **${route.access}**\n`+
    `${route.redirectTo ? `- Redireciona para: \`${route.redirectTo}\` (herda a mesma proteção de acesso)\n` : ''}`+
    `- Arquivo de entrada: \`${route.entry || 'definido diretamente em App.tsx'}\`\n`+
    `- Dependências identificadas: ${dependencies || 'nenhuma dependência de dados direta'}\n`+
    `- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada\n\n`+
    `| Item | Tipo | Controle/função | Origem | Critério de aprovação |\n`+
    `|---|---|---|---|---|\n`+
    `${rows || '| [ ] | rota | Renderização e acesso | App.tsx | Redireciona/renderiza exatamente conforme a regra de acesso. |'}\n\n`+
    `### Validações obrigatórias da página\n\n`+
    `- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.\n`+
    `- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.\n`+
    `- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.\n`+
    `- [ ] Layout validado em desktop e viewport móvel.\n`+
    `- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.\n`+
    `- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.\n`+
    `- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).\n`;
}).join('\n---\n\n');

const markdown = `# Checklist de certificação de produção — MeMude Connect\n\n`+
  `**Data-base:** 13 de agosto de 2026  \n`+
  `**Inventário:** ${inventory.routeCount} rotas; extraído estaticamente dos componentes alcançáveis por cada página.  \n`+
  `**Regra de execução:** um item só recebe aprovação após teste com evidência. Ao falhar: registrar achado → diagnosticar causa → definir plano → implementar → revisar → retestar → somente então avançar.\n\n`+
  `## Legenda\n\n`+
  `- [ ] Não testado\n`+
  `- [x] Aprovado com evidência no relatório\n`+
  `- **BLOQUEADO**: depende de credencial, serviço externo ou decisão do responsável\n`+
  `- **FALHOU**: comportamento divergente; deve passar pelo ciclo de correção\n\n`+
  `## Gates globais\n\n`+
  `- [ ] Repositório e produção apontam para o mesmo commit.\n`+
  `- [ ] Typecheck, lint e scanner de segredos aprovados.\n`+
  `- [ ] Testes unitários e de build/rotas aprovados.\n`+
  `- [ ] Build de produção e auditoria de dependências aprovados.\n`+
  `- [ ] Migrações locais e remotas reconciliadas.\n`+
  `- [ ] Todas as tabelas expostas possuem RLS e grants mínimos.\n`+
  `- [ ] Edge Functions têm consumidor e autenticação documentados e testados negativamente.\n`+
  `- [ ] Filas, crons, webhooks e integrações sem itens travados ou falhas consecutivas.\n`+
  `- [ ] Backup, restauração e rollback ensaiados em ambiente não produtivo.\n`+
  `- [ ] Testes E2E autenticados aprovados com contas sintéticas de admin, corretor e cliente.\n`+
  `- [ ] Navegadores Chrome/Edge/Safari e viewport móvel cobertos.\n`+
  `- [ ] Observabilidade, alertas e runbooks operacionais ativos.\n\n`+
  `${routeSections}\n\n`+
  `## Jornadas transversais e integrações\n\n`+
  `- [ ] Auth: login, logout, recuperação, redefinição, sessão expirada e bloqueio por papel.\n`+
  `- [ ] Leads: criação, edição, qualificação, lixeira, restauração, distribuição e CRM.\n`+
  `- [ ] Corretores: convite, cadastro, aprovação, suspensão, reativação, exclusão e escopo próprio.\n`+
  `- [ ] Visitas: criação, conflito de horário, confirmação, lembrete, realização, cancelamento, reagendamento e lixeira.\n`+
  `- [ ] Vendas: registro, edição, comissão, comprovante privado e sincronização financeira.\n`+
  `- [ ] WhatsApp: envio, fila, entrega, webhook, duplicidade, assinatura inválida, timeout e fallback.\n`+
  `- [ ] IA: agente, conversa, qualificação, follow-up, handoff humano e indisponibilidade do provedor.\n`+
  `- [ ] WordPress: teste de conexão, sincronização incremental/completa, erro remoto e idempotência.\n`+
  `- [ ] Relatórios: geração, filtros, impressão, CSV/JSON/XLSX e agendamento.\n`+
  `- [ ] Segurança: IDOR/BOLA, XSS, upload malicioso, rate limit, CORS, RLS e ausência de PII em logs.\n`+
  `- [ ] Operação: carga, concorrência, retry, dead-letter, cron, backup, restore e rollback.\n`;

fs.writeFileSync(outputPath, markdown, 'utf8');
console.log(`Checklist gerado: ${path.relative(root, outputPath)}`);

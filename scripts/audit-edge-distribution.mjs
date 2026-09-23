import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const files = {
  distributeLead: 'supabase/functions/distribute-lead/index.ts',
  timeoutChecker: 'supabase/functions/distribution-timeout-checker/index.ts',
  distributionLogic: 'supabase/functions/_shared/distribution-logic.ts',
  evolutionSender: 'supabase/functions/evolution-send-whatsapp-v2/index.ts',
  visitTimeoutChecker: 'supabase/functions/visit-distribution-timeout-checker/index.ts',
  webhookHandler: 'supabase/functions/distribution-webhook-handler/index.ts',
  responseAnalyzer: 'supabase/functions/_shared/distribution-response.ts',
};

const sources = Object.fromEntries(
  Object.entries(files).map(([key, relativePath]) => [
    key,
    fs.readFileSync(path.join(root, relativePath), 'utf8'),
  ]),
);

const failures = [];
for (const [key, source] of Object.entries(sources)) {
  const parsed = ts.createSourceFile(files[key], source, ts.ScriptTarget.Latest, true);
  for (const diagnostic of parsed.parseDiagnostics) {
    failures.push(`${files[key]}: sintaxe inválida (${diagnostic.messageText})`);
  }
}

const requirePattern = (key, pattern, message) => {
  if (!pattern.test(sources[key])) failures.push(`${files[key]}: ${message}`);
};
const forbidPattern = (key, pattern, message) => {
  if (pattern.test(sources[key])) failures.push(`${files[key]}: ${message}`);
};

requirePattern('distributeLead', /\.insert\(\{[\s\S]*?queue_id:\s*queueId[\s\S]*?lead_id:\s*lead\.id/, 'a tentativa inicial deve guardar queue_id');
requirePattern('timeoutChecker', /force_advance_lead_id/, 'o avanço após recusa/falha deve ser suportado');
requirePattern('timeoutChecker', /\.insert\(\{[\s\S]*?queue_id:\s*queueId[\s\S]*?lead_id:\s*leadId/, 'tentativas subsequentes devem guardar queue_id');
requirePattern('timeoutChecker', /\.eq\('current_attempt',\s*currentAttempt\)/, 'o avanço da fila deve ter controle otimista de concorrência');
requirePattern('evolutionSender', /remoteJid\.includes\('@lid'\)/, 'o envio deve persistir o mapeamento de LID retornado pela Evolution');
requirePattern('visitTimeoutChecker', /force_advance_visita_id/, 'o avanço de visita após recusa/falha deve ser suportado');
requirePattern('visitTimeoutChecker', /\.insert\(\{[\s\S]*?queue_id:\s*queueId[\s\S]*?visita_id:\s*visitaId/, 'tentativas subsequentes de visita devem guardar queue_id');
requirePattern('visitTimeoutChecker', /\.eq\('current_attempt',\s*currentAttempt\)/, 'o avanço da fila de visita deve ter controle otimista de concorrência');
requirePattern('webhookHandler', /analyzeDistributionResponse/, 'o webhook deve usar o analisador central de respostas');
requirePattern('responseAnalyzer', /'accept lead'/, 'o analisador deve reconhecer o ID do botão de aceite');
requirePattern('responseAnalyzer', /'reject lead'/, 'o analisador deve reconhecer o ID do botão de recusa');
forbidPattern('responseAnalyzer', /text\.includes\(/, 'não pode classificar intenção por fragmentos de palavras');
forbidPattern('distributionLogic', /from\('distribution_attempts'\)[\s\S]{0,180}status:\s*'rejected'/, 'tentativas de lead rejeitadas devem usar o status válido responded');
forbidPattern('distributionLogic', /current_attempt:\s*99/, 'não pode usar sentinela 99 para processar recusas');
forbidPattern('distributionLogic', /Buscando QUALQUER tentativa pendente|handle(?:Visit|Lead)AttemptByLidFallback/, 'não pode associar LID desconhecido a uma tentativa global');
forbidPattern('distributionLogic', /status:\s*['"]em_contato['"]/, 'deve usar somente valores válidos do enum lead_status');

const analyzerModule = ts.transpileModule(sources.responseAnalyzer, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const analyzerUrl = `data:text/javascript;base64,${Buffer.from(analyzerModule).toString('base64')}`;
const { analyzeDistributionResponse } = await import(analyzerUrl);
const responseCases = [
  ['SIM', 'accepted'],
  ['accept_lead', 'accepted'],
  ['accept_visit', 'accepted'],
  ['NÃO', 'rejected'],
  ['reject_lead', 'rejected'],
  ['reject_visit', 'rejected'],
  ['não posso', 'rejected'],
  ['simplesmente depois', 'unclear'],
  ['estou no trânsito', 'unclear'],
  ['bom dia', 'unclear'],
];
for (const [message, expected] of responseCases) {
  const actual = analyzeDistributionResponse(message).type;
  if (actual !== expected) {
    failures.push(`${files.responseAnalyzer}: "${message}" deveria ser ${expected}, retornou ${actual}`);
  }
}

if (failures.length > 0) {
  console.error('Auditoria do fluxo de distribuição reprovada:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Auditoria do fluxo de distribuição aprovada.');

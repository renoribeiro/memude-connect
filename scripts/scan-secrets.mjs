import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const listed = spawnSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
);
if (listed.status !== 0) {
  console.error(listed.stderr || 'Não foi possível listar os arquivos.');
  process.exit(1);
}

const ignoredPrefixes = [
  'docs/',
  'scratch/',
  '.agent/',
];
const ignoredFiles = new Set([
  'src/integrations/supabase/client.ts', // chave publishable/anon é pública por desenho
  'package-lock.json',
  'scripts/scan-secrets.mjs',
]);
const textExtensions =
  /\.(?:ts|tsx|js|jsx|mjs|cjs|sql|toml|ya?ml|json|md|txt|env|example)$/i;
const findings = [];

function inspectJwt(file, lineNumber, line) {
  for (const token of line.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g)) {
    try {
      const payload = JSON.parse(
        Buffer.from(token[0].split('.')[1], 'base64url').toString('utf8'),
      );
      if (payload.role === 'service_role') {
        findings.push(`${file}:${lineNumber}: JWT service_role versionado`);
      }
    } catch {
      // Tokens não JWT são tratados pelas demais regras.
    }
  }
}

for (const file of listed.stdout.split(/\r?\n/).filter(Boolean)) {
  const normalized = file.replaceAll('\\', '/');
  if (
    ignoredFiles.has(normalized)
    || ignoredPrefixes.some((prefix) => normalized.startsWith(prefix))
    || !textExtensions.test(normalized)
  ) {
    continue;
  }

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  content.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    inspectJwt(normalized, lineNumber, line);
    if (/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|YOUR_SERVICE_ROLE_KEY|memude-cron-secret/i.test(line)) {
      findings.push(`${normalized}:${lineNumber}: credencial/placeholder proibido`);
    }

    const assignment = line.match(
      /\b(secret|password|passwd|token|api[_-]?key)\b\s*[:=]\s*['"]([^'"]{24,})['"]/i,
    );
    if (
      assignment
      && !/Deno\.env|process\.env|import\.meta\.env|placeholder|example|redacted/i.test(line)
    ) {
      findings.push(
        `${normalized}:${lineNumber}: possível segredo literal em ${assignment[1]}`,
      );
    }
  });
}

if (findings.length > 0) {
  console.error(`Possíveis segredos encontrados:\n${[...new Set(findings)].join('\n')}`);
  process.exit(1);
}

console.log('Varredura aprovada: nenhum segredo versionado foi detectado.');

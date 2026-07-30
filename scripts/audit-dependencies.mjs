import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const exceptions = new Map([
  [
    'GHSA-qwww-vcr4-c8h2',
    {
      owner: 'Engenharia MeMude',
      expiresAt: '2026-10-31',
      reason:
        'Afeta exclusivamente React Server Components/Server Actions; esta aplicação é uma SPA Vite estática.',
    },
  ],
]);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name))
      ? [path]
      : [];
  });
}

function assertExceptionEvidence() {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  const forbiddenPackages = Object.keys(dependencies).filter((name) =>
    name === 'react-server-dom-webpack'
    || name.startsWith('@react-router/')
  );
  const forbiddenImport = sourceFiles('src').find((file) =>
    /react-router(?:-dom)?\/(?:server|rsc)|react-server-dom|ServerRouter|createStaticHandler/.test(
      readFileSync(file, 'utf8'),
    )
  );
  if (forbiddenPackages.length > 0 || forbiddenImport) {
    throw new Error(
      `A exceção de React Router deixou de ser válida: ${
        forbiddenPackages.join(', ') || forbiddenImport
      }`,
    );
  }
}

for (const [id, exception] of exceptions) {
  if (new Date(`${exception.expiresAt}T23:59:59Z`) < new Date()) {
    console.error(`Exceção expirada: ${id} (${exception.owner})`);
    process.exit(1);
  }
}
assertExceptionEvidence();

const audit = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error(
    audit.stderr || 'Não foi possível interpretar o resultado do npm audit.',
  );
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
function advisoryIds(packageName, visited = new Set()) {
  if (visited.has(packageName)) return new Set();
  visited.add(packageName);
  const vulnerability = vulnerabilities[packageName];
  if (!vulnerability) return new Set();

  const ids = new Set();
  for (const item of vulnerability.via ?? []) {
    if (typeof item === 'string') {
      for (const id of advisoryIds(item, visited)) ids.add(id);
    } else if (item?.url) {
      ids.add(item.url.split('/').at(-1));
    }
  }
  return ids;
}

const blocking = [];
const accepted = [];
for (const [packageName, vulnerability] of Object.entries(vulnerabilities)) {
  if (!['high', 'critical'].includes(vulnerability.severity)) continue;
  const ids = [...advisoryIds(packageName)];
  const isExplicitlyAccepted = ids.length > 0
    && ids.every((id) => exceptions.has(id));

  if (isExplicitlyAccepted) {
    accepted.push(`${packageName}: ${ids.join(', ')}`);
  } else {
    blocking.push(
      `${packageName}: ${vulnerability.severity} (${ids.join(', ') || 'sem advisory identificável'})`,
    );
  }
}

if (blocking.length > 0) {
  console.error(`Vulnerabilidades bloqueantes:\n${blocking.join('\n')}`);
  process.exit(1);
}

if (accepted.length > 0) {
  console.warn(`Exceções temporárias verificadas:\n${accepted.join('\n')}`);
}
console.log(
  'Auditoria aprovada: nenhuma vulnerabilidade alta ou crítica aplicável.',
);

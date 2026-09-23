import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const appSource = fs.readFileSync(path.join(srcRoot, 'App.tsx'), 'utf8');

const lazyImports = new Map(
  [...appSource.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\(["'](.+?)["']\)\)/g)]
    .map((match) => [match[1], match[2]]),
);

const routeMatches = [...appSource.matchAll(/<Route\s+path=["']([^"']+)["']\s+element=\{([\s\S]*?)\}\s*\/>/g)];

function resolveSourceFile(importer, specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/')
    ? path.join(srcRoot, specifier.slice(2))
    : path.resolve(path.dirname(importer), specifier);
  const candidates = [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

function parseFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  return {
    source,
    ast: ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS),
  };
}

function collectDependencies(entry) {
  const visited = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    const { ast } = parseFile(file);
    for (const statement of ast.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const resolved = resolveSourceFile(file, statement.moduleSpecifier.text);
      if (!resolved || resolved.includes(`${path.sep}components${path.sep}ui${path.sep}`)) continue;
      if (resolved.includes(`${path.sep}integrations${path.sep}supabase${path.sep}types.ts`)) continue;
      queue.push(resolved);
    }
  }
  return [...visited].sort();
}

const interactiveTags = new Set([
  'Button', 'button', 'Link', 'NavLink', 'a', 'form', 'Input', 'Textarea', 'Select',
  'SelectTrigger', 'SelectItem', 'Checkbox', 'Switch', 'TabsTrigger', 'DropdownMenuItem',
  'DialogTrigger', 'AlertDialogAction', 'AlertDialogCancel', 'CollapsibleTrigger', 'CommandItem',
]);

function nodeName(node) {
  if (ts.isIdentifier(node)) return node.text;
  return node.getText();
}

function compact(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function extractAttributes(node, sourceFile) {
  const attributes = {};
  for (const attribute of node.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue;
    const name = attribute.name.getText(sourceFile);
    if (!attribute.initializer) {
      attributes[name] = true;
    } else if (ts.isStringLiteral(attribute.initializer)) {
      attributes[name] = compact(attribute.initializer.text);
    } else if (ts.isJsxExpression(attribute.initializer)) {
      attributes[name] = compact(attribute.initializer.expression?.getText(sourceFile) ?? '');
    }
  }
  return attributes;
}

function extractLabel(node, sourceFile, attributes) {
  for (const key of ['aria-label', 'title', 'placeholder', 'value', 'name']) {
    if (typeof attributes[key] === 'string' && attributes[key]) return attributes[key];
  }
  if (!ts.isJsxElement(node.parent)) return '';
  const text = node.parent.children.map((child) => {
    if (ts.isJsxText(child)) return child.text;
    if (ts.isJsxExpression(child) && child.expression) return `{${child.expression.getText(sourceFile)}}`;
    return '';
  }).join(' ');
  return compact(text);
}

function collectFileInventory(file) {
  const { source, ast } = parseFile(file);
  const controls = [];
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = nodeName(node.tagName);
      if (interactiveTags.has(tag)) {
        const attributes = extractAttributes(node, ast);
        const position = ast.getLineAndCharacterOfPosition(node.getStart(ast));
        controls.push({
          tag,
          label: extractLabel(node, ast, attributes),
          line: position.line + 1,
          attributes: Object.fromEntries(
            Object.entries(attributes).filter(([key]) => [
              'onClick', 'onSubmit', 'onChange', 'href', 'to', 'type', 'disabled', 'aria-label',
              'title', 'placeholder', 'value', 'name',
            ].includes(key)),
          ),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);

  const tables = [...source.matchAll(/\.from\(["']([^"']+)["']\)/g)].map((match) => match[1]);
  const functions = [...source.matchAll(/\.functions\.invoke\(["']([^"']+)["']/g)].map((match) => match[1]);
  const rpcs = [...source.matchAll(/\.rpc\(["']([^"']+)["']/g)].map((match) => match[1]);
  return { controls, tables, functions, rpcs };
}

function routeComponent(elementSource) {
  const candidates = [...elementSource.matchAll(/<(\w+)(?:\s|\/|>)/g)]
    .map((match) => match[1])
    .filter((name) => lazyImports.has(name));
  return candidates.at(-1) ?? null;
}

const routes = routeMatches.map((match) => {
  const routePath = match[1];
  const element = match[2];
  const component = routeComponent(element);
  const importPath = component ? lazyImports.get(component) : null;
  const absoluteEntry = importPath ? resolveSourceFile(path.join(srcRoot, 'App.tsx'), importPath) : null;
  const dependencies = absoluteEntry ? collectDependencies(absoluteEntry) : [];
  const files = dependencies.map((file) => {
    const inventory = collectFileInventory(file);
    return {
      file: path.relative(root, file).replaceAll('\\', '/'),
      ...inventory,
    };
  }).filter((item) => item.controls.length || item.tables.length || item.functions.length || item.rpcs.length);

  return {
    path: routePath,
    component,
    redirectTo: element.match(/<Navigate\s+to=["']([^"']+)["']/)?.[1] ?? null,
    access: element.includes('requireAdmin') ? 'admin' : element.includes('requireCorretor') ? 'corretor' : element.includes('ProtectedRoute') ? 'autenticado' : 'público',
    entry: absoluteEntry ? path.relative(root, absoluteEntry).replaceAll('\\', '/') : null,
    files,
  };
});

for (const route of routes) {
  if (!route.redirectTo) continue;
  const target = routes.find((candidate) => candidate.path === route.redirectTo);
  if (target) route.access = target.access;
}

const report = {
  generatedAt: new Date().toISOString(),
  routeCount: routes.length,
  routes,
};

const destination = path.join(root, 'docs', 'production-ui-inventory.json');
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Inventário gerado: ${path.relative(root, destination)} (${routes.length} rotas)`);

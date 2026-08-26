import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const sourceFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (absolute.includes(`${path.sep}components${path.sep}ui`)) continue;
      walk(absolute);
    } else if (/\.(tsx|ts)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
      sourceFiles.push(absolute);
    }
  }
}

walk(srcRoot);

const noAction = [];
const forbiddenMarkers = [];
const triggerTags = new Set([
  'AlertDialogTrigger', 'DialogTrigger', 'DropdownMenuTrigger', 'PopoverTrigger',
  'SheetTrigger', 'CollapsibleTrigger', 'TooltipTrigger', 'Calendar',
]);

function tagName(tag) {
  return tag.getText();
}

function attributesOf(node) {
  return new Set(node.attributes.properties
    .filter(ts.isJsxAttribute)
    .map((attribute) => attribute.name.getText()));
}

function hasTriggerAncestor(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current)) {
      if (triggerTags.has(tagName(current.openingElement.tagName))) return true;
    }
    current = current.parent;
  }
  return false;
}

for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const markerPattern = /\b(simulat(?:e|ed|ing|ion)|demonstrativ[oa]|será implementad[oa] em breve)\b/gi;
  for (const match of content.matchAll(markerPattern)) {
    const line = content.slice(0, match.index).split('\n').length;
    forbiddenMarkers.push(`${relative}:${line}: ${match[0]}`);
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node.tagName);
      if (tag === 'Button' || tag === 'button') {
        const attrs = attributesOf(node);
        const actionable = ['onClick', 'onMouseDown', 'type', 'asChild', 'disabled', 'formAction'].some((name) => attrs.has(name));
        if (!actionable && !hasTriggerAncestor(node)) {
          const { line } = ast.getLineAndCharacterOfPosition(node.getStart(ast));
          noAction.push(`${relative}:${line + 1}: <${tag}> sem ação, submissão, link ou trigger`);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

if (forbiddenMarkers.length || noAction.length) {
  console.error('Auditoria de interface reprovada.');
  if (forbiddenMarkers.length) console.error(`\nMarcadores não produtivos:\n- ${forbiddenMarkers.join('\n- ')}`);
  if (noAction.length) console.error(`\nBotões sem ação detectável:\n- ${noAction.join('\n- ')}`);
  process.exit(1);
}

console.log(`Auditoria de interface aprovada: ${sourceFiles.length} arquivos sem simulações ou botões inertes detectáveis.`);

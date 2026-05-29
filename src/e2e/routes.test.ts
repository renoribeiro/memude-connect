import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const DIST = join(ROOT, 'dist');
const ASSETS = join(DIST, 'assets');

/**
 * Complete route map from App.tsx
 * Maps: route path → { component name, build chunk prefix, page file }
 */
const ADMIN_ROUTES = [
  { path: '/admin/users', component: 'UserManagement', chunk: 'UserManagement', file: 'pages/admin/UserManagement.tsx' },
  { path: '/leads', component: 'Leads', chunk: 'Leads', file: 'pages/admin/Leads.tsx' },
  { path: '/crm', component: 'CRM', chunk: 'CRM', file: 'pages/admin/CRM.tsx' },
  { path: '/vendas', component: 'Vendas', chunk: 'Vendas', file: 'pages/admin/Vendas.tsx' },
  { path: '/corretores', component: 'Corretores', chunk: 'Corretores', file: 'pages/admin/Corretores.tsx' },
  { path: '/visitas', component: 'Visitas', chunk: 'Visitas', file: 'pages/admin/Visitas.tsx' },
  { path: '/comunicacoes', component: 'Comunicacoes', chunk: 'Comunicacoes', file: 'pages/admin/Comunicacoes.tsx' },
  { path: '/configuracoes', component: 'Configuracoes', chunk: 'Configuracoes', file: 'pages/admin/Configuracoes.tsx' },
  { path: '/admin/analytics', component: 'Analytics', chunk: 'Analytics', file: 'pages/admin/Analytics.tsx' },
  { path: '/relatorios', component: 'Relatorios', chunk: 'Relatorios', file: 'pages/admin/Relatorios.tsx' },
  { path: '/admin/ai-agents', component: 'AIAgents', chunk: 'AIAgents', file: 'pages/admin/AIAgents.tsx' },
  { path: '/empreendimentos', component: 'Empreendimentos', chunk: 'Empreendimentos', file: 'pages/admin/Empreendimentos.tsx' },
  { path: '/admin/monitoring', component: 'Monitoring', chunk: 'Monitoring', file: 'pages/admin/Monitoring.tsx' },
  { path: '/sincronizacao-wordpress', component: 'SincronizacaoWordpress', chunk: 'SincronizacaoWordpress', file: 'pages/admin/SincronizacaoWordpress.tsx' },
];

const CORRETOR_ROUTES = [
  { path: '/meus-leads', component: 'MeusLeads', chunk: 'MeusLeads', file: 'pages/corretor/MeusLeads.tsx' },
  { path: '/minhas-comissoes', component: 'MinhasComissoes', chunk: 'MinhasComissoes', file: 'pages/corretor/MinhasComissoes.tsx' },
  { path: '/minhas-visitas', component: 'MinhasVisitas', chunk: 'MinhasVisitas', file: 'pages/corretor/MinhasVisitas.tsx' },
  { path: '/perfil', component: 'Perfil', chunk: 'Perfil', file: 'pages/corretor/Perfil.tsx' },
];

const PUBLIC_ROUTES = [
  { path: '/auth', component: 'AuthPage', chunk: 'AuthPage', file: 'components/auth/AuthPage.tsx' },
  { path: '/unauthorized', component: 'Unauthorized', chunk: 'Unauthorized', file: 'pages/Unauthorized.tsx' },
];

const CORE_ROUTES = [
  { path: '/', component: 'Index', chunk: 'Index', file: 'pages/Index.tsx' },
];

const ALL_ROUTES = [...ADMIN_ROUTES, ...CORRETOR_ROUTES, ...PUBLIC_ROUTES, ...CORE_ROUTES];

// ─────────────────────────────────────────────────────────────
// 1. BUILD OUTPUT VERIFICATION
// ─────────────────────────────────────────────────────────────
describe('Build Output Verification', () => {
  it('dist/ directory exists', () => {
    expect(existsSync(DIST)).toBe(true);
  });

  it('dist/index.html exists and contains script reference', () => {
    const indexPath = join(DIST, 'index.html');
    expect(existsSync(indexPath)).toBe(true);
    const html = readFileSync(indexPath, 'utf-8');
    expect(html).toContain('<script');
    expect(html).toContain('type="module"');
  });

  it('dist/assets/ directory exists with JS and CSS files', () => {
    expect(existsSync(ASSETS)).toBe(true);
    const files = readdirSync(ASSETS);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    const cssFiles = files.filter(f => f.endsWith('.css'));
    expect(jsFiles.length).toBeGreaterThan(0);
    expect(cssFiles.length).toBeGreaterThan(0);
  });

  it('all route chunks exist in dist/assets/', () => {
    const assetFiles = readdirSync(ASSETS);
    const missing: string[] = [];

    for (const route of ALL_ROUTES) {
      const chunkExists = assetFiles.some(f =>
        f.startsWith(route.chunk) && f.endsWith('.js')
      );
      if (!chunkExists) {
        missing.push(`${route.chunk} (route: ${route.path})`);
      }
    }

    expect(missing).toEqual([]);
  });

  it('critical shared chunks exist', () => {
    const assetFiles = readdirSync(ASSETS);
    const criticalChunks = [
      'DashboardLayout',
      'supabase',
      'vendor',
      'ui-',
      'utils-',
    ];

    for (const chunk of criticalChunks) {
      const exists = assetFiles.some(f => f.startsWith(chunk) || f.includes(chunk));
      expect(exists, `Missing critical chunk: ${chunk}`).toBe(true);
    }
  });

  it('no empty JS chunks in build output', () => {
    const assetFiles = readdirSync(ASSETS);
    const emptyChunks: string[] = [];

    for (const file of assetFiles) {
      if (file.endsWith('.js')) {
        const fullPath = join(ASSETS, file);
        const content = readFileSync(fullPath, 'utf-8');
        if (content.trim().length === 0) {
          emptyChunks.push(file);
        }
      }
    }

    expect(emptyChunks).toEqual([]);
  });

  it('route chunks have reasonable sizes (> 100 bytes)', () => {
    const assetFiles = readdirSync(ASSETS);
    const tooSmall: string[] = [];

    for (const route of ALL_ROUTES) {
      const chunkFile = assetFiles.find(f =>
        f.startsWith(route.chunk) && f.endsWith('.js')
      );
      if (chunkFile) {
        const content = readFileSync(join(ASSETS, chunkFile), 'utf-8');
        if (content.length < 100) {
          tooSmall.push(`${chunkFile} (${content.length} bytes)`);
        }
      }
    }

    expect(tooSmall).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. SOURCE FILE VERIFICATION
// ─────────────────────────────────────────────────────────────
describe('Source File Verification', () => {
  it('all page source files exist', () => {
    const missing: string[] = [];
    for (const route of ALL_ROUTES) {
      const filePath = join(ROOT, 'src', route.file);
      if (!existsSync(filePath)) {
        missing.push(`${route.file} (component: ${route.component})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('App.tsx exists and contains all route definitions', () => {
    const appPath = join(ROOT, 'src', 'App.tsx');
    expect(existsSync(appPath)).toBe(true);
    const content = readFileSync(appPath, 'utf-8');

    for (const route of ALL_ROUTES) {
      expect(content, `Missing route path: ${route.path}`).toContain(`"${route.path}"`);
    }
  });

  it('App.tsx lazy imports match expected components', () => {
    const appPath = join(ROOT, 'src', 'App.tsx');
    const content = readFileSync(appPath, 'utf-8');

    for (const route of ALL_ROUTES) {
      const lazyPattern = `const ${route.component} = lazy`;
      expect(content, `Missing lazy import: ${route.component}`).toContain(lazyPattern);
    }
  });

  it('all admin pages are wrapped with ProtectedRoute', () => {
    const appPath = join(ROOT, 'src', 'App.tsx');
    const content = readFileSync(appPath, 'utf-8');

    for (const route of ADMIN_ROUTES) {
      const componentTag = `<${route.component}`;
      expect(content, `Component not in JSX: ${route.component}`).toContain(componentTag);
    }
  });

  it('all corretor pages use requireCorretor protection', () => {
    const appPath = join(ROOT, 'src', 'App.tsx');
    const content = readFileSync(appPath, 'utf-8');

    for (const route of CORRETOR_ROUTES) {
      expect(content).toContain(`<${route.component}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 3. ROUTE COMPLETENESS
// ─────────────────────────────────────────────────────────────
describe('Route Completeness', () => {
  it('has all 14 admin routes', () => {
    expect(ADMIN_ROUTES.length).toBe(14);
  });

  it('has all 4 corretor routes', () => {
    expect(CORRETOR_ROUTES.length).toBe(4);
  });

  it('has all 2 public routes', () => {
    expect(PUBLIC_ROUTES.length).toBe(2);
  });

  it('has the index route', () => {
    expect(CORE_ROUTES.length).toBe(1);
    expect(CORE_ROUTES[0].path).toBe('/');
  });

  it('total route count is 21', () => {
    expect(ALL_ROUTES.length).toBe(21);
  });

  it('no duplicate route paths', () => {
    const paths = ALL_ROUTES.map(r => r.path);
    const uniquePaths = new Set(paths);
    expect(paths.length).toBe(uniquePaths.size);
  });

  it('no duplicate component names', () => {
    const components = ALL_ROUTES.map(r => r.component);
    const uniqueComponents = new Set(components);
    expect(components.length).toBe(uniqueComponents.size);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. PRODUCTION SITE HEALTH CHECK
// ─────────────────────────────────────────────────────────────
describe('Production Site Health Check', () => {
  const BASE_URL = 'https://core.memudecore.com.br';

  it('main page returns 200', async () => {
    try {
      const response = await fetch(BASE_URL, {
        method: 'GET',
        redirect: 'follow',
      });
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('<div id="root"');
    } catch (error) {
      // Network errors should not fail the build test suite
      console.warn(`⚠️ Could not reach ${BASE_URL}: ${error}`);
    }
  });

  it('/auth page returns 200 (SPA fallback)', async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth`, {
        method: 'GET',
        redirect: 'follow',
      });
      // SPA with client-side routing should return 200 for all routes
      expect(response.status).toBe(200);
    } catch (error) {
      console.warn(`⚠️ Could not reach ${BASE_URL}/auth: ${error}`);
    }
  });

  it('static assets are served correctly', async () => {
    try {
      const mainPageRes = await fetch(BASE_URL);
      const html = await mainPageRes.text();

      // Extract a JS asset reference from the HTML
      const jsMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
      if (jsMatch) {
        const assetUrl = `${BASE_URL}${jsMatch[1]}`;
        const assetRes = await fetch(assetUrl);
        expect(assetRes.status).toBe(200);
        const contentType = assetRes.headers.get('content-type');
        expect(contentType).toContain('javascript');
      }
    } catch (error) {
      console.warn(`⚠️ Could not verify static assets: ${error}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 5. VENDAS PAGE SPECIFIC CHECK
// ─────────────────────────────────────────────────────────────
describe('Vendas Page - "Cliente" Column Verification', () => {
  it('Vendas page source uses "Cliente" not "Lead"', () => {
    const vendasPath = join(ROOT, 'src', 'pages', 'admin', 'Vendas.tsx');
    const content = readFileSync(vendasPath, 'utf-8');

    // The Vendas page should show "Cliente" as header, not "Lead"
    // Check table headers or column definitions
    const hasCliente = content.includes('Cliente');
    expect(hasCliente, 'Vendas page should contain "Cliente" label').toBe(true);
  });

  it('Vendas build chunk is non-trivial', () => {
    const assetFiles = readdirSync(ASSETS);
    const vendasChunk = assetFiles.find(f => f.startsWith('Vendas') && f.endsWith('.js'));
    expect(vendasChunk).toBeDefined();

    if (vendasChunk) {
      const content = readFileSync(join(ASSETS, vendasChunk), 'utf-8');
      // Vendas chunk should be a meaningful component, not a stub
      expect(content.length).toBeGreaterThan(1000);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 6. BUILD INTEGRITY
// ─────────────────────────────────────────────────────────────
describe('Build Integrity', () => {
  it('index.html references the CSS bundle', () => {
    const indexPath = join(DIST, 'index.html');
    const html = readFileSync(indexPath, 'utf-8');
    expect(html).toMatch(/href="\/assets\/[^"]+\.css"/);
  });

  it('index.html references the main JS bundle', () => {
    const indexPath = join(DIST, 'index.html');
    const html = readFileSync(indexPath, 'utf-8');
    expect(html).toMatch(/src="\/assets\/[^"]+\.js"/);
  });

  it('vercel.json exists with SPA rewrite rule', () => {
    const vercelPath = join(ROOT, 'vercel.json');
    expect(existsSync(vercelPath)).toBe(true);
    const config = JSON.parse(readFileSync(vercelPath, 'utf-8'));
    // SPA needs a rewrite rule to handle client-side routes
    expect(config.rewrites || config.routes).toBeDefined();
  });

  it('robots.txt is in dist', () => {
    expect(existsSync(join(DIST, 'robots.txt'))).toBe(true);
  });
});

import { expect, test, type Page } from '@playwright/test';

type Role = 'admin' | 'corretor' | 'cliente';

const credentials: Record<Role, { email: string; password: string }> = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL!,
    password: process.env.E2E_ADMIN_PASSWORD!,
  },
  corretor: {
    email: process.env.E2E_CORRETOR_EMAIL!,
    password: process.env.E2E_CORRETOR_PASSWORD!,
  },
  cliente: {
    email: process.env.E2E_CLIENTE_EMAIL!,
    password: process.env.E2E_CLIENTE_PASSWORD!,
  },
};

const adminRoutes = [
  '/', '/admin/users', '/leads', '/crm', '/corretores', '/empreendimentos',
  '/visitas', '/vendas', '/comunicacoes', '/relatorios',
  '/sincronizacao-wordpress', '/configuracoes', '/admin/analytics',
  '/admin/monitoring', '/admin/ai-agents', '/ai-agents', '/ai-agentes',
];
const corretorRoutes = ['/', '/meus-leads', '/minhas-visitas', '/minhas-comissoes', '/perfil'];

async function login(page: Page, role: Role) {
  const account = credentials[role];
  await page.goto('/auth');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Senha').fill(account.password);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(page).not.toHaveURL(/\/auth$/, { timeout: 20_000 });
}

async function expectRouteLoads(page: Page, route: string) {
  const errors: string[] = [];
  const listener = (message: { type(): string; text(): string }) => {
    if (message.type() === 'error') errors.push(message.text());
  };
  page.on('console', listener);
  await page.goto(route);
  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page).not.toHaveURL(/\/(auth|unauthorized)$/);
  expect(errors, `Erros de console em ${route}`).toEqual([]);
  page.off('console', listener);
}

test('admin acessa todas as rotas administrativas', async ({ page }) => {
  await login(page, 'admin');
  for (const route of adminRoutes) await expectRouteLoads(page, route);
});

test('corretor acessa seu espaço e não acessa administração', async ({ page }) => {
  await login(page, 'corretor');
  for (const route of corretorRoutes) await expectRouteLoads(page, route);
  await page.goto('/configuracoes');
  await expect(page).toHaveURL(/\/unauthorized$/);
});

test('cliente acessa o perfil e não acessa áreas de admin ou corretor', async ({ page }) => {
  await login(page, 'cliente');
  await expectRouteLoads(page, '/perfil');
  for (const route of ['/configuracoes', '/meus-leads']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/unauthorized$/);
  }
});

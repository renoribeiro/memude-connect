import { expect, test } from '@playwright/test';

const email = process.env.E2E_ADMIN_EMAIL!;
const password = process.env.E2E_ADMIN_PASSWORD!;

test('administrador autentica e acessa configurações', async ({ page }) => {
  await page.goto('/auth');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();

  await expect(page).not.toHaveURL(/\/auth$/, { timeout: 20_000 });
  await page.goto('/configuracoes');
  await expect(page.getByRole('heading', { name: 'Configurações do Sistema' })).toBeVisible();
});

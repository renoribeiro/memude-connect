import { expect, test } from '@playwright/test';

test('exibe o login e os controles essenciais', async ({ page }) => {
  await page.goto('/auth');

  await expect(page.getByRole('heading', { name: 'Entrar na sua conta' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  const passwordInput = page.locator('input[name="password"]');
  await expect(passwordInput).toHaveAttribute('type', 'password');
  await expect(page.getByRole('button', { name: 'Esqueci minha senha' })).toBeVisible();

  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(passwordInput).toHaveAttribute('type', 'text');
});

test('rota administrativa exige autenticação', async ({ page }) => {
  await page.goto('/configuracoes');

  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole('button', { name: 'Entrar no Sistema' })).toBeVisible();
});

test('rota inexistente apresenta página 404', async ({ page }) => {
  await page.goto('/rota-que-nao-existe');

  await expect(page.getByText('404')).toBeVisible();
  await expect(page.getByRole('button', { name: /voltar ao início/i })).toBeVisible();
});

const required = [
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'E2E_CORRETOR_EMAIL',
  'E2E_CORRETOR_PASSWORD',
  'E2E_CLIENTE_EMAIL',
  'E2E_CLIENTE_PASSWORD',
];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(
    `Credenciais de certificação ausentes: ${missing.join(', ')}. `
      + 'Use exclusivamente contas sintéticas de staging e armazene-as no secret store.',
  );
  process.exit(1);
}

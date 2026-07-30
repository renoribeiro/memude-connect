const required = ['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(
    `Credenciais E2E ausentes: ${missing.join(', ')}. `
      + 'Use exclusivamente uma conta sintética de staging.',
  );
  process.exit(1);
}

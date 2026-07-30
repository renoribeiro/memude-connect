import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

interface SecretOptions {
  createIfMissing?: boolean;
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function getEvolutionWebhookSecret(
  supabase: SupabaseClient,
  { createIfMissing = false }: SecretOptions = {},
): Promise<string | null> {
  const environmentSecret = Deno.env.get('WEBHOOK_SECRET')?.trim();
  if (environmentSecret) return environmentSecret;

  const { data: stored, error: lookupError } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'evolution_webhook_secret')
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Não foi possível consultar a credencial do webhook: ${lookupError.message}`,
    );
  }

  const storedSecret = stored?.value?.trim();
  if (storedSecret && storedSecret.length >= 32) return storedSecret;
  if (!createIfMissing) return null;

  const generatedSecret = randomSecret();
  const { error: saveError } = await supabase
    .from('system_settings')
    .upsert({
      key: 'evolution_webhook_secret',
      value: generatedSecret,
      description: 'Credencial interna para autenticação dos webhooks da Evolution API',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (saveError) {
    throw new Error(
      `Não foi possível provisionar a credencial do webhook: ${saveError.message}`,
    );
  }

  return generatedSecret;
}

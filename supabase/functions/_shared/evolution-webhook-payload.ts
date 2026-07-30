export const EVOLUTION_WEBHOOK_EVENTS = [
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'CONNECTION_UPDATE',
] as const;

export function buildEvolutionWebhookPayload(
  webhookUrl: string,
  webhookSecret: string,
) {
  return {
    webhook: {
      enabled: true,
      url: webhookUrl,
      headers: {
        'x-webhook-secret': webhookSecret,
      },
      byEvents: false,
      base64: false,
      events: [...EVOLUTION_WEBHOOK_EVENTS],
    },
  };
}

import { describe, expect, it } from 'vitest';
import {
  buildEvolutionWebhookPayload,
  EVOLUTION_WEBHOOK_EVENTS,
} from '../../supabase/functions/_shared/evolution-webhook-payload';

describe('Evolution API V2 webhook payload', () => {
  it('uses the nested camelCase contract required by Evolution 2.3.7', () => {
    const payload = buildEvolutionWebhookPayload(
      'https://example.supabase.co/functions/v1/evolution-webhook-handler',
      'test-secret',
    );

    expect(payload).toEqual({
      webhook: {
        enabled: true,
        url: 'https://example.supabase.co/functions/v1/evolution-webhook-handler',
        headers: {
          'x-webhook-secret': 'test-secret',
        },
        byEvents: false,
        base64: false,
        events: [...EVOLUTION_WEBHOOK_EVENTS],
      },
    });
    expect(payload).not.toHaveProperty('webhook_by_events');
    expect(payload).not.toHaveProperty('webhook_base64');
  });

  it('keeps the shared secret out of the destination URL', () => {
    const payload = buildEvolutionWebhookPayload(
      'https://example.supabase.co/functions/v1/evolution-webhook-handler',
      'secret-that-must-only-be-a-header',
    );

    expect(payload.webhook.url).not.toContain('secret');
    expect(payload.webhook.headers['x-webhook-secret'])
      .toBe('secret-that-must-only-be-a-header');
  });
});

import { supabase } from '@/integrations/supabase/client';

const STORAGE_HOST = 'oxybasvtphosdmlmrfnb.supabase.co';
const STORAGE_MARKERS = [
  '/storage/v1/object/public/comprovantes/',
  '/storage/v1/object/sign/comprovantes/',
];

export interface ComprovanteItem {
  vendaId?: string | null;
  path: string;
}

export function normalizeComprovantePath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (/^https?:/i.test(candidate)) {
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' || url.hostname !== STORAGE_HOST) return null;
      const marker = STORAGE_MARKERS.find((item) => url.pathname.includes(item));
      if (!marker) return null;
      candidate = decodeURIComponent(url.pathname.split(marker)[1] || '');
    } catch {
      return null;
    }
  }

  if (
    candidate.length > 500
    || candidate.startsWith('/')
    || candidate.includes('..')
    || candidate.includes('\\')
  ) {
    return null;
  }
  return candidate;
}

export function comprovanteFileName(path: string, fallback: string): string {
  try {
    return decodeURIComponent(path).split('/').pop() || fallback;
  } catch {
    return path.split('/').pop() || fallback;
  }
}

export async function createComprovanteSignedUrls(
  items: ComprovanteItem[],
): Promise<Record<string, string>> {
  if (items.length === 0) return {};
  const urls: Record<string, string> = {};
  for (let index = 0; index < items.length; index += 100) {
    const { data, error } = await supabase.functions.invoke(
      'create-comprovante-signed-urls',
      { body: { items: items.slice(index, index + 100) } },
    );
    if (error) throw error;
    Object.assign(urls, (data?.urls || {}) as Record<string, string>);
  }
  return urls;
}

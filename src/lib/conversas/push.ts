import { supabase } from '@/integrations/supabase/client';
import { chamarFuncao } from './servidor';

export type EstadoPush = 'carregando' | 'indisponivel' | 'instalar' | 'negado' | 'inativo' | 'ativo';

const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const instalado = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);
}

export async function estadoPush(): Promise<EstadoPush> {
  // No iPhone o push só existe com o app instalado na tela de início
  if (ehIOS() && !instalado()) return 'instalar';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'indisponivel';
  if (Notification.permission === 'denied') return 'negado';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'ativo' : 'inativo';
}

function chaveParaBytes(b64: string): Uint8Array {
  const p = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(p + '='.repeat((4 - (p.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function ativarPush(): Promise<void> {
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('Para receber avisos de cliente novo, permita as notificações no navegador.');
  await registrarServiceWorker();
  const reg = await navigator.serviceWorker.ready;
  const { chave } = await chamarFuncao<{ chave: string }>('conversas-push', undefined, 'GET');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) });
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.rpc('push_inscrever', {
    p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;
}

/** Garante que a inscrição deste aparelho pertence a quem está logado agora (troca de usuário no mesmo celular). */
export async function revincularPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub || Notification.permission !== 'granted') return;
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await supabase.rpc('push_inscrever', {
    p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_user_agent: navigator.userAgent.slice(0, 300),
  });
}

export async function desativarPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.rpc('push_remover', { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

/** Bipe curto (sem arquivo de áudio): avisa mensagem nova com o app aberto. */
export function tocarAviso(forte = false) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notas = forte ? [880, 1175, 1568] : [988, 1319];
    notas.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.25);
    });
    setTimeout(() => ctx.close(), 1200);
    if (forte) navigator.vibrate?.([250, 100, 250, 100, 500]);
  } catch { /* sem áudio */ }
}

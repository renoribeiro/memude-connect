import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ativarPush, desativarPush, estadoPush, registrarServiceWorker, revincularPush, tocarAviso, type EstadoPush } from '@/lib/conversas/push';
import { mensagemErro } from '@/lib/conversas/servidor';

/** Estado das notificações deste aparelho + ações de ativar/desativar. */
export function usePush() {
  const [estado, setEstado] = useState<EstadoPush>('carregando');
  const [ocupado, setOcupado] = useState(false);
  const atualizar = useCallback(() => {
    estadoPush().then((e) => {
      setEstado(e);
      if (e === 'ativo') revincularPush().catch(() => undefined);
    }).catch(() => setEstado('indisponivel'));
  }, []);
  useEffect(() => { registrarServiceWorker().then(atualizar); }, [atualizar]);

  const ativar = async () => {
    setOcupado(true);
    try {
      await ativarPush();
      toast.success('Notificações ativadas neste aparelho');
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setOcupado(false);
      atualizar();
    }
  };
  const desativar = async () => {
    setOcupado(true);
    try {
      await desativarPush();
      toast.success('Notificações desativadas neste aparelho');
    } finally {
      setOcupado(false);
      atualizar();
    }
  };
  return { estado, ocupado, ativar, desativar };
}

/** Ouve o service worker: toca o som com o app aberto e abre a tela certa ao tocar na notificação. */
export function useMensagensDoServiceWorker(aoPush?: (d: { titulo?: string; corpo?: string; url?: string; tag?: string }) => void) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const ouvir = (ev: MessageEvent) => {
      const d = ev.data as { tipo?: string; url?: string; titulo?: string; corpo?: string; tag?: string };
      if (d?.tipo === 'navegar' && d.url) {
        const u = new URL(d.url);
        if (u.origin === window.location.origin) navigate(u.pathname + u.search);
      } else if (d?.tipo === 'push') {
        tocarAviso(Boolean(d.tag?.startsWith('convite-')));
        aoPush?.(d);
      }
    };
    navigator.serviceWorker.addEventListener('message', ouvir);
    return () => navigator.serviceWorker.removeEventListener('message', ouvir);
  }, [navigate, aoPush]);
}

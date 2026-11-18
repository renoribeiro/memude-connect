import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Abre o painel da visita de qualquer tela (?visita=<id>), preservando os demais parâmetros da URL. */
export function useAbrirVisita() {
  const [params, setParams] = useSearchParams();
  return useCallback((id: string) => {
    const p = new URLSearchParams(params);
    p.set('visita', id);
    setParams(p);
  }, [params, setParams]);
}

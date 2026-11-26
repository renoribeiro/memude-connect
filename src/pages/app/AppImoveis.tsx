import { TopoVoltar } from '@/components/app/ui';
import { ImoveisParaCliente } from '@/components/app/ImoveisParaCliente';

/** Catálogo da MeMude para mandar ao cliente (aberto pelo Início ou pelo chat). */
export default function AppImoveis() {
  return (
    <>
      <TopoVoltar titulo="Imóveis" subtitulo="Catálogo da MeMude · copie e cole na conversa" voltarPara="/app" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><ImoveisParaCliente /></div>
    </>
  );
}

import { Topo } from '@/components/app/Topo';
import { ImoveisParaCliente } from '@/components/app/ImoveisParaCliente';

export default function AppImoveis() {
  return (
    <>
      <Topo titulo="Imóveis" subtitulo="Catálogo da MeMude · toque para copiar e colar na conversa" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><ImoveisParaCliente /></div>
    </>
  );
}

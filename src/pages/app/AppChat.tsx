import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Building2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { ChatConversa } from '@/components/conversas/ChatConversa';
import { PainelCliente } from '@/components/conversas/PainelCliente';
import { ImoveisParaCliente } from '@/components/app/ImoveisParaCliente';
import { useConversa } from '@/hooks/conversas/dados';
import { useAuth } from '@/hooks/useAuth';
import { telefoneLegivel } from '@/lib/conversas/formato';

export default function AppChat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: conv, isLoading, isError } = useConversa(id ?? null);
  const [painel, setPainel] = useState<'ficha' | 'imoveis' | null>(null);

  // Conversa que não é (mais) do corretor some da lista: volta para o início
  if (!id || isError || (!isLoading && conv === null)) return <Navigate to="/app" replace />;
  const lead = conv?.leads as unknown as { nome?: string } | null;
  const numero = conv?.conv_numeros as unknown as { nome?: string; status?: string } | null;
  const nome = lead?.nome || conv?.nome_contato || telefoneLegivel(conv?.telefone);
  const voltar = () => (window.history.length > 1 ? navigate(-1) : navigate('/app'));

  return (
    <>
      <ChatConversa conversaId={id} nome={conv ? nome : '…'} telefone={conv?.telefone ?? ''} etapa={conv?.etapa ?? 'novo'}
        numeroNome={numero?.nome} numeroStatus={numero?.status} podeResponder={!conv || conv.dono_id === user?.id}
        compacto aoVoltar={voltar} aoAbrirFicha={() => setPainel('ficha')}
        acoes={(
          <div className="flex shrink-0">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => setPainel('imoveis')} aria-label="Imóveis para enviar">
              <Building2 className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => setPainel('ficha')} aria-label="Ficha do cliente">
              <Info className="h-5 w-5" />
            </Button>
          </div>
        )} />
      <Drawer open={!!painel} onOpenChange={(v) => !v && setPainel(null)}>
        <DrawerContent className="max-h-[88dvh]">
          <DrawerTitle className="sr-only">{painel === 'imoveis' ? 'Imóveis' : 'Ficha do cliente'}</DrawerTitle>
          <div className="overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {painel === 'ficha' && <PainelCliente conversaId={id} equipe={false} />}
            {painel === 'imoveis' && <ImoveisParaCliente conversaId={id} aoEnviar={() => setPainel(null)} />}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

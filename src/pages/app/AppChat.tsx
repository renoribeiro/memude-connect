import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlarmClockPlus, Building2, ChevronDown, Info, Sparkles } from 'lucide-react';
import { NovoLembrete } from '@/components/app/NovoLembrete';
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
  const { data: conv, isLoading, isError } = useConversa(id ?? null, 30_000);
  const [painel, setPainel] = useState<'ficha' | 'imoveis' | null>(null);
  const [lembrete, setLembrete] = useState(false);

  // Conversa que não é (mais) do corretor some da lista: volta para o início
  const location = useLocation();
  // Só sai do chat se a conversa não existe mais para o corretor (erro de rede momentâneo não expulsa)
  if (!id || (!isLoading && !isError && conv === null)) return <Navigate to="/app/conversas" replace />;
  const lead = conv?.leads as unknown as { nome?: string } | null;
  const numero = conv?.conv_numeros as unknown as { nome?: string; status?: string } | null;
  const nome = lead?.nome || conv?.nome_contato || telefoneLegivel(conv?.telefone);
  // Aberto direto pela notificação não há tela anterior no app: volta para Conversas
  const voltar = () => (location.key === 'default' ? navigate('/app/conversas') : navigate(-1));

  return (
    <>
      <ChatConversa key={id} conversaId={id} nome={conv ? nome : '…'} telefone={conv?.telefone ?? ''} etapa={conv?.etapa ?? 'novo'}
        numeroNome={numero?.nome} numeroStatus={numero?.status} podeResponder={!conv || conv.dono_id === user?.id} lerNoWhatsApp={!!conv && conv.dono_id === user?.id}
        compacto aoVoltar={voltar} aoAbrirFicha={() => setPainel('ficha')}
        topo={conv ? <ResumoAnterior conv={conv as unknown as ConvResumo} /> : undefined}
        acoes={(
          <div className="flex shrink-0">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => setLembrete(true)} aria-label="Criar lembrete para este cliente">
              <AlarmClockPlus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => setPainel('imoveis')} aria-label="Imóveis para enviar">
              <Building2 className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => setPainel('ficha')} aria-label="Ficha do cliente">
              <Info className="h-5 w-5" />
            </Button>
          </div>
        )} />
      <NovoLembrete aberto={lembrete} aoFechar={() => setLembrete(false)} conversaId={id} nomeCliente={conv ? nome : null} />
      <Drawer open={!!painel} onOpenChange={(v) => !v && setPainel(null)}>
        <DrawerContent className="tema-memude max-h-[88dvh] bg-card">
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

const CAMPOS: [string, string][] = [['renda', 'Renda'], ['entrada_fgts', 'Entrada/FGTS'], ['prazo', 'Prazo'], ['finalidade', 'Finalidade'], ['regiao', 'Região']];
type ConvResumo = { resumo_ia: string | null; ia_falta?: string | null; leads?: { qualificacao?: Record<string, unknown> | null } | null };

/** O corretor não vê o atendimento da SDR (privacidade): recebe o resumo da IA e o que já se sabe do cliente. */
function ResumoAnterior({ conv }: { conv: ConvResumo }) {
  const q = conv.leads?.qualificacao ?? {};
  const campos = CAMPOS.filter(([k]) => typeof q[k] === 'string' && q[k]);
  return (
    <details open className="group mx-auto mb-3 max-w-md rounded-2xl border border-mm-borda-suave bg-card p-3.5 text-left shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-extrabold text-primary">
        <Sparkles className="h-4 w-4" aria-hidden /> Resumo do atendimento antes de você
        <ChevronDown className="ml-auto h-4 w-4 transition group-open:rotate-180" aria-hidden />
      </summary>
      <p className="mt-2 text-[14px] leading-relaxed">{conv.resumo_ia ?? 'A IA ainda não resumiu esta conversa. Use a ficha do cliente para ver o que já se sabe.'}</p>
      {conv.ia_falta && <p className="mt-1.5 text-[13px]"><strong>Próximo passo:</strong> {conv.ia_falta}</p>}
      {campos.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {campos.map(([k, rotulo]) => (
            <span key={k} className="rounded-full bg-mm-lilas px-2.5 py-1 text-[12px] font-semibold text-primary">{rotulo}: {String(q[k])}</span>
          ))}
        </div>
      )}
      <p className="mt-2.5 text-[11px] text-muted-foreground">Por privacidade, a conversa da equipe com o cliente antes de você não aparece aqui.</p>
    </details>
  );
}

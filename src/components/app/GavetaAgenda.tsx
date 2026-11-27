import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { SincronizarAgenda, type VisitaAgenda } from '@/components/agenda/SincronizarAgenda';
import { useMinhasVisitas } from '@/hooks/conversas/app';

/** App do corretor: gaveta "Sincronizar agenda" (Google Agenda, iPhone, Outlook). */
export function GavetaAgenda({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { data: visitas = [] } = useMinhasVisitas();
  const lista: VisitaAgenda[] = visitas
    .filter((v) => v.status === 'agendada' || v.status === 'confirmada')
    .map((v) => {
      const cliente = (v.leads as { nome?: string } | null)?.nome ?? 'Cliente';
      const emp = (v.empreendimentos as { nome?: string } | null)?.nome;
      return {
        id: v.id, data: v.data_visita, hora: String(v.horario_visita),
        titulo: `Visita · ${cliente.split(' ')[0]}${emp ? ` · ${emp}` : ''}`,
        local: v.meeting_address || v.local_nome || emp || null,
        detalhes: `Cliente: ${cliente}${emp ? `\nEmpreendimento: ${emp}` : ''}\nAbrir no app: https://core.memudecore.com.br/app/agenda`,
      };
    });
  return (
    <Drawer open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DrawerContent className="tema-memude max-h-[92dvh] bg-card">
        <div className="overflow-y-auto px-5 pb-6 pt-2">
          <DrawerTitle className="text-xl">Sincronizar agenda</DrawerTitle>
          <DrawerDescription className="mb-4 mt-1 text-[14px]">Veja suas visitas e lembretes na agenda que você já usa.</DrawerDescription>
          <SincronizarAgenda visitas={lista} app />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

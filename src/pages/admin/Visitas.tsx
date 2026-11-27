import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, CalendarSync, Clock, MapPin, Plus, Star, User } from "lucide-react";
import { SincronizarAgenda } from "@/components/agenda/SincronizarAgenda";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VisitaModal } from "@/components/modals/VisitaModal";
import { VisitaActions } from "@/components/actions/VisitaActions";
import { VisitaDetails } from "@/components/modals/VisitaDetails";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate, isSameLocalDay } from "@/utils/dateHelpers";
import { SeletorMeses } from "@/components/comercial/SeletorMeses";
import { ResumoVisitasMes, rotuloVisita } from "@/components/visitas/ResumoVisitasMes";
import { descreverMeses, mes, mesAtual } from "@/lib/comercial/periodo";

interface Visita {
  id: string;
  visit_code?: string;
  lead_id: string;
  data_visita: string;
  horario_visita: string;
  status: string;
  avaliacao_lead?: number;
  comentarios_lead?: string;
  feedback_corretor?: string;
  deleted_at?: string | null;
  planilha_extra?: unknown;
  leads: { nome: string; telefone: string } | null;
  corretores?: { profiles: { first_name: string; last_name: string } | null } | null;
  empreendimentos?: { nome: string } | null;
}

const COR_STATUS: Record<string, string> = {
  aguardando_corretor: "bg-amber-50 text-amber-800 ring-amber-600/20",
  agendada: "bg-primary/10 text-primary ring-primary/20",
  confirmada: "bg-primary/10 text-primary ring-primary/20",
  realizada: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  no_show: "bg-rose-50 text-rose-700 ring-rose-600/20",
  cancelada: "bg-slate-100 text-slate-600 ring-slate-500/20",
  reagendada: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

/** Tela de visitas: resumo do período e a lista completa, da mais recente para a mais antiga. */
export default function Visitas() {
  const { profile } = useAuth();
  const [meses, setMeses] = useState<string[]>(() => [mesAtual()]);
  const [modalAberto, setModalAberto] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [visitaId, setVisitaId] = useState<string | undefined>();
  const [sincronizar, setSincronizar] = useState(false);

  const ordenados = [...meses].sort();
  const de = mes(ordenados[0]).de;
  const ate = mes(ordenados[ordenados.length - 1]).ate;

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ["visitas", "periodo", de, ate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas")
        .select("*, leads(nome, telefone), corretores(profiles(first_name, last_name)), empreendimentos(nome)")
        .is("deleted_at", null)
        .gte("data_visita", de)
        .lte("data_visita", ate)
        .order("data_visita", { ascending: false })
        .order("horario_visita", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data as Visita[];
    },
  });

  // Meses podem não ser contínuos (ex.: setembro e novembro): fica só o que foi escolhido.
  const doPeriodo = useMemo(() => visitas.filter((v) => meses.includes(v.data_visita.slice(0, 7))), [visitas, meses]);

  if (!profile) return null;

  const hoje = new Date();
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
  const ehHoje = (d: string) => isSameLocalDay(d, hoje);
  const ehAmanha = (d: string) => isSameLocalDay(d, amanha);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Visitas</h1>
            <p className="text-muted-foreground">
              {descreverMeses(meses)} · hoje {doPeriodo.filter((v) => ehHoje(v.data_visita)).length}, amanhã {doPeriodo.filter((v) => ehAmanha(v.data_visita)).length}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SeletorMeses valor={meses} onChange={setMeses} />
            <Button variant="outline" onClick={() => setSincronizar(true)}>
              <CalendarSync className="mr-1.5 h-4 w-4" /> Sincronizar agenda
            </Button>
            <Button onClick={() => { setVisitaId(undefined); setModalAberto(true); }}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova visita
            </Button>
          </div>
        </div>

        <ResumoVisitasMes visitas={doPeriodo} periodo={descreverMeses(meses)} />

        <section className="rounded-xl border bg-card shadow-sm">
          <header className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-sm font-semibold">Visitas do período <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{doPeriodo.length}</span></h2>
            <span className="text-xs text-muted-foreground">Mais recentes primeiro</span>
          </header>
          {isLoading ? (
            <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : !doPeriodo.length ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhuma visita em {descreverMeses(meses)}.</p>
          ) : (
            <ul className="divide-y">
              {doPeriodo.map((v) => (
                <li key={v.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40">
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-xl font-bold leading-none tabular-nums text-primary">{v.data_visita.slice(8, 10)}</p>
                    <p className="mt-0.5 text-[11px] font-medium uppercase text-muted-foreground">
                      {format(parseLocalDate(v.data_visita), "MMM", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{v.leads?.nome || "Lead sem nome"}</h3>
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", COR_STATUS[v.status] ?? COR_STATUS.cancelada)}>
                        {rotuloVisita(v)}
                      </span>
                      {ehHoje(v.data_visita) && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Hoje</Badge>}
                      {ehAmanha(v.data_visita) && <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">Amanhã</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{format(parseLocalDate(v.data_visita), "EEE, dd/MM", { locale: ptBR })}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{v.horario_visita?.slice(0, 5)}</span>
                      {v.empreendimentos && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{v.empreendimentos.nome}</span>}
                      {v.corretores?.profiles && (
                        <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{v.corretores.profiles.first_name} {v.corretores.profiles.last_name}</span>
                      )}
                      {v.avaliacao_lead ? (
                        <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{v.avaliacao_lead}/5</span>
                      ) : null}
                    </div>
                  </div>
                  <VisitaActions
                    visitaId={v.id}
                    status={v.status}
                    leadId={v.lead_id || ""}
                    deletedAt={v.deleted_at}
                    onEdit={() => { setVisitaId(v.id); setModalAberto(true); }}
                    onView={() => { setVisitaId(v.id); setDetalheAberto(true); }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <VisitaModal isOpen={modalAberto} onClose={() => { setModalAberto(false); setVisitaId(undefined); }} visitaId={visitaId} />

        <Dialog open={detalheAberto} onOpenChange={setDetalheAberto}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Detalhes da visita</DialogTitle></DialogHeader>
            {visitaId && <VisitaDetails visitaId={visitaId} />}
          </DialogContent>
        </Dialog>

        <Dialog open={sincronizar} onOpenChange={setSincronizar}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader><DialogTitle>Sincronizar agenda</DialogTitle></DialogHeader>
            <p className="-mt-2 text-sm text-muted-foreground">Todas as visitas da equipe na sua agenda, com o nome do corretor. Atualiza sozinho.</p>
            <SincronizarAgenda />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

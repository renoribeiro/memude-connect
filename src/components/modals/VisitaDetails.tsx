import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, User, Phone, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/utils/dateHelpers";

interface VisitaDetailsProps {
  visitaId: string;
}

export function VisitaDetails({ visitaId }: { visitaId: string }) {
  const { data: visita, isLoading } = useQuery({
    queryKey: ['visita-details', visitaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitas')
        .select(`
          *,
          leads(nome, telefone, email),
          corretores(profiles(first_name, last_name), whatsapp, telefone),
          empreendimentos(nome, endereco)
        `)
        .eq('id', visitaId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="p-4 flex justify-center items-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  if (!visita) return <div className="p-4 text-center text-muted-foreground">Visita não encontrada</div>;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendada': return 'bg-blue-100 text-blue-800';
      case 'confirmada': return 'bg-green-100 text-green-800';
      case 'realizada': return 'bg-teal-100 text-teal-800';
      case 'cancelada': return 'bg-red-100 text-red-800';
      case 'reagendada': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'agendada': return 'Agendada';
      case 'confirmada': return 'Confirmada';
      case 'realizada': return 'Realizada';
      case 'cancelada': return 'Cancelada';
      case 'reagendada': return 'Reagendada';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Status</Label>
          <div>
            <Badge className={`mt-1 capitalize ${getStatusColor(visita.status)}`}>
              {getStatusLabel(visita.status)}
            </Badge>
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Data e Horário</Label>
          <div className="flex items-center gap-2 mt-1.5 text-sm text-foreground">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{format(parseLocalDate(visita.data_visita), "dd/MM/yyyy", { locale: ptBR })}</span>
            <Clock className="h-4 w-4 ml-2 text-muted-foreground" />
            <span>{visita.horario_visita}</span>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-muted-foreground">Lead (Cliente)</Label>
        <div className="mt-1 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-foreground">{visita.leads?.nome || "Lead Desconhecido"}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              <span>{visita.leads?.telefone || "—"}</span>
            </div>
            {visita.leads?.email && (
              <div className="flex items-center gap-1.5">
                <span>📧</span>
                <span>{visita.leads?.email}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-muted-foreground">Corretor</Label>
        <div className="mt-1 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-foreground">
              {visita.corretores?.profiles?.first_name || "Sem"} {visita.corretores?.profiles?.last_name || "Nome"}
            </span>
          </div>
          {(visita.corretores?.whatsapp || visita.corretores?.telefone) && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              <span>{visita.corretores.whatsapp || visita.corretores.telefone}</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-muted-foreground">Empreendimento</Label>
        <div className="mt-1 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-foreground">{visita.empreendimentos?.nome || "Empreendimento Desconhecido"}</span>
          </div>
          {visita.empreendimentos?.endereco && (
            <p className="text-sm text-muted-foreground">{visita.empreendimentos?.endereco}</p>
          )}
        </div>
      </div>

      {visita.feedback_corretor && (
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Feedback do Corretor</Label>
          <p className="mt-1 p-3 bg-muted/50 rounded-lg text-sm text-foreground border whitespace-pre-wrap">{visita.feedback_corretor}</p>
        </div>
      )}

      {visita.comentarios_lead && (
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Comentários do Lead</Label>
          <p className="mt-1 p-3 bg-muted/50 rounded-lg text-sm text-foreground border whitespace-pre-wrap">{visita.comentarios_lead}</p>
        </div>
      )}

      {visita.avaliacao_lead && (
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Avaliação do Lead</Label>
          <div className="mt-1 flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <span key={i} className={`text-lg ${i < visita.avaliacao_lead ? 'text-yellow-400' : 'text-gray-300'}`}>
                ⭐
              </span>
            ))}
            <span className="ml-2 text-sm text-muted-foreground">({visita.avaliacao_lead}/5)</span>
          </div>
        </div>
      )}
    </div>
  );
}

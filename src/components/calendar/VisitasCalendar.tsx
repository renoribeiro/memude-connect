import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, MapPin, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarLoadingSkeleton } from "@/components/ui/loading-states";
import { parseLocalDate, isSameLocalDay } from "@/utils/dateHelpers";

interface Visita {
  id: string;
  data_visita: string;
  horario_visita: string;
  status: string;
  lead: {
    nome: string;
    telefone: string;
  };
  corretor: {
    first_name: string;
    last_name: string;
  };
  empreendimento: {
    nome: string;
  };
}

const statusVariants = {
  agendada: "secondary",
  confirmada: "default",
  realizada: "success",
  cancelada: "destructive",
  reagendada: "warning"
} as const;

const statusLabels = {
  agendada: "Agendada",
  confirmada: "Confirmada", 
  realizada: "Realizada",
  cancelada: "Cancelada",
  reagendada: "Reagendada"
};

export default function VisitasCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ['visitas-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitas')
        .select(`
          id,
          data_visita,
          horario_visita,
          status,
          leads(nome, telefone),
          corretores(
            profiles(first_name, last_name)
          ),
          empreendimentos(nome)
        `)
        .is('deleted_at', null)
        .order('data_visita', { ascending: true })
        .order('horario_visita', { ascending: true });

      if (error) throw error;
      return data?.map(item => ({
        id: item.id,
        data_visita: item.data_visita,
        horario_visita: item.horario_visita,
        status: item.status,
        lead: item.leads,
        corretor: item.corretores?.profiles,
        empreendimento: item.empreendimentos
      })) as Visita[] || [];
    }
  });

  const getVisitasForDate = (date: Date) => {
    return visitas.filter(visita => 
      isSameLocalDay(visita.data_visita, date)
    );
  };

  const modifiers = {
    hasVisitas: (date: Date) => getVisitasForDate(date).length > 0
  };

  // Estilo customizado para o indicador (bolinha)
  const modifiersStyles = {
    hasVisitas: {
      position: 'relative',
    } as React.CSSProperties
  };

  const selectedDateVisitas = getVisitasForDate(selectedDate);

  if (isLoading) {
    return <CalendarLoadingSkeleton />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      <Card className="lg:col-span-2 hover-scale transition-all duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Calendário de Visitas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-6">
            <style>{`
              .rdp-day_hasVisitas::after {
                content: '';
                position: absolute;
                bottom: 2px;
                left: 50%;
                transform: translateX(-50%);
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: #ec4899; /* Pink-500 */
              }
            `}</style>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              modifiers={modifiers}
              modifiersClassNames={{
                hasVisitas: 'rdp-day_hasVisitas'
              }}
              locale={ptBR}
              className="rounded-md border mx-auto w-full"
            />
          </CardContent>
        </Card>

      <Card className="hover-scale transition-all duration-200">
        <CardHeader>
          <CardTitle className="animate-fade-in">
            Visitas - {format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDateVisitas.length === 0 ? (
            <div className="text-muted-foreground text-center py-8 animate-fade-in">
              <CalendarDays className="mx-auto h-12 w-12 mb-2 opacity-50" />
              <p>Nenhuma visita agendada para este dia</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateVisitas.map((visita, index) => (
                <Popover key={visita.id}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left h-auto p-3 hover-scale transition-all duration-200"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {visita.horario_visita.substring(0, 5)}
                          </span>
                          <Badge variant={statusVariants[visita.status as keyof typeof statusVariants]}>
                            {statusLabels[visita.status as keyof typeof statusLabels]}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {visita.lead.nome}
                        </span>
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 animate-fade-in">
                        <User className="w-4 h-4" />
                        <span className="font-medium">{visita.lead.nome}</span>
                      </div>
                      <div className="flex items-center gap-2 animate-fade-in">
                        <Clock className="w-4 h-4" />
                        <span>{visita.horario_visita.substring(0, 5)}</span>
                      </div>
                      <div className="flex items-center gap-2 animate-fade-in">
                        <MapPin className="w-4 h-4" />
                        <span>{visita.empreendimento?.nome || 'Empreendimento não informado'}</span>
                      </div>
                      <div className="text-sm text-muted-foreground animate-fade-in">
                        Corretor: {visita.corretor ? `${visita.corretor.first_name} ${visita.corretor.last_name}` : 'Não atribuído'}
                      </div>
                      <div className="text-sm text-muted-foreground animate-fade-in">
                        Telefone: {visita.lead.telefone}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Star, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { normalizeTime } from '@/utils/dateHelpers';

const visitaSchema = z.object({
  lead_id: z.string().min(1, "Lead é obrigatório"),
  corretor_id: z.string().optional(),
  empreendimento_id: z.string().optional(),
  data_visita: z.date(),
  horario_visita: z.string().min(1, "Horário é obrigatório"),
  status: z.enum(['agendada', 'confirmada', 'realizada', 'cancelada', 'reagendada']),
  avaliacao_lead: z.number().min(0).max(5).optional(),
  comentarios_lead: z.string().optional(),
  feedback_corretor: z.string().optional(),
  auto_assign_corretor: z.boolean().optional(),
}).refine((data) => {
  // Quando status é 'realizada', os campos de avaliação são obrigatórios
  if (data.status === 'realizada') {
    return data.avaliacao_lead !== undefined && 
           data.avaliacao_lead > 0 &&
           data.comentarios_lead !== undefined && 
           data.comentarios_lead.trim().length > 0;
  }
  return true;
}, {
  message: "Quando a visita está realizada, avaliação e comentários são obrigatórios",
  path: ["avaliacao_lead"],
});

export type VisitaFormData = z.infer<typeof visitaSchema>;

interface VisitaFormProps {
  initialData?: Partial<VisitaFormData>;
  onSubmit: (data: VisitaFormData) => void;
  isLoading?: boolean;
  leads: Array<{ id: string; nome: string; telefone: string }>;
  corretores: Array<{ id: string; profiles: { first_name: string; last_name: string } }>;
  empreendimentos: Array<{ id: string; nome: string }>;
  onAddNewLead?: () => void;
}

export function VisitaForm({ 
  initialData, 
  onSubmit, 
  isLoading = false, 
  leads = [], 
  corretores = [], 
  empreendimentos = [],
  onAddNewLead
}: VisitaFormProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    initialData?.data_visita ? new Date(initialData.data_visita) : undefined
  );
  const [rating, setRating] = useState(initialData?.avaliacao_lead || 0);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<VisitaFormData>({
    resolver: zodResolver(visitaSchema),
    defaultValues: {
      status: 'agendada',
      auto_assign_corretor: false,
      avaliacao_lead: 0,
      comentarios_lead: '',
      feedback_corretor: '',
      ...initialData,
      data_visita: initialData?.data_visita ? new Date(initialData.data_visita) : undefined,
    }
  });

  const status = watch('status');
  const autoAssign = watch('auto_assign_corretor');

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      console.log('📝 [VisitaForm] Recebendo initialData:', initialData);
      const formData = {
        lead_id: initialData.lead_id || '',
        corretor_id: initialData.corretor_id || '',
        empreendimento_id: initialData.empreendimento_id || '',
        status: initialData.status || 'agendada',
        data_visita: initialData?.data_visita ? new Date(initialData.data_visita) : undefined,
        horario_visita: normalizeTime(initialData.horario_visita),
        auto_assign_corretor: initialData.auto_assign_corretor || false,
        avaliacao_lead: initialData.avaliacao_lead || 0,
        comentarios_lead: initialData.comentarios_lead || '',
        feedback_corretor: initialData.feedback_corretor || '',
      };
      
      console.log('📝 [VisitaForm] Resetando form com:', formData);
      reset(formData);
      
      // Update local states
      if (initialData.data_visita) {
        setSelectedDate(new Date(initialData.data_visita));
      }
      if (initialData.avaliacao_lead) {
        setRating(initialData.avaliacao_lead);
      }
    }
  }, [initialData, reset]);

  // Sync rating with form value
  useEffect(() => {
    if (initialData?.avaliacao_lead) {
      setRating(initialData.avaliacao_lead);
      setValue('avaliacao_lead', initialData.avaliacao_lead);
    }
  }, [initialData?.avaliacao_lead, setValue]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setValue('data_visita', date);
    }
  };

  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
    setValue('avaliacao_lead', newRating);
  };

  const renderStars = () => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "w-5 h-5 cursor-pointer transition-colors",
          i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground hover:text-yellow-400"
        )}
        onClick={() => handleRatingChange(i + 1)}
      />
    ));
  };

  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00'
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lead Selection */}
        <div className="space-y-2">
          <Label htmlFor="lead_id">Lead *</Label>
          <div className="flex gap-2">
            <Select 
              value={watch('lead_id')} 
              onValueChange={(value) => setValue('lead_id', value)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um lead" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.nome} - {lead.telefone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {onAddNewLead && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onAddNewLead}
                className="flex-shrink-0"
                title="Adicionar novo lead"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
          {errors.lead_id && (
            <p className="text-sm text-destructive">{errors.lead_id.message}</p>
          )}
        </div>

        {/* Corretor Selection */}
        <div className="space-y-2">
          <Label htmlFor="corretor_id">Corretor</Label>
          <Select 
            value={watch('corretor_id')}
            onValueChange={(value) => setValue('corretor_id', value)}
            disabled={autoAssign}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um corretor" />
            </SelectTrigger>
            <SelectContent>
              {corretores.map((corretor) => (
                <SelectItem key={corretor.id} value={corretor.id}>
                  {corretor.profiles.first_name} {corretor.profiles.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Auto Assign Checkbox - Spans 2 columns on desktop */}
        <div className="md:col-span-2">
          <div className="flex items-start space-x-3 rounded-lg border border-border bg-muted/50 p-4">
            <Checkbox
              id="auto_assign_corretor"
              checked={autoAssign || false}
              onCheckedChange={(checked) => {
                setValue('auto_assign_corretor', checked as boolean);
                if (checked) {
                  setValue('corretor_id', '');
                }
              }}
              className="mt-1"
            />
            <div className="space-y-1 leading-none flex-1">
              <Label 
                htmlFor="auto_assign_corretor" 
                className="text-sm font-medium cursor-pointer"
              >
                Escolha automática de corretores
              </Label>
              <p className="text-xs text-muted-foreground">
                O sistema irá distribuir automaticamente esta visita para corretores qualificados usando critérios de construtora, bairro, tipo de imóvel, nota e número de visitas. Quando ativado, o campo de corretor será desabilitado.
              </p>
            </div>
          </div>
        </div>

        {/* Empreendimento Selection */}
        <div className="space-y-2">
          <Label htmlFor="empreendimento_id">Empreendimento</Label>
          <Select 
            value={watch('empreendimento_id') || ''}
            onValueChange={(value) => setValue('empreendimento_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um empreendimento" />
            </SelectTrigger>
            <SelectContent>
              {empreendimentos.map((empreendimento) => (
                <SelectItem key={empreendimento.id} value={empreendimento.id}>
                  {empreendimento.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select 
            value={watch('status') || 'agendada'}
            onValueChange={(value) => setValue('status', value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agendada">Agendada</SelectItem>
              <SelectItem value="confirmada">Confirmada</SelectItem>
              <SelectItem value="realizada">Realizada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
              <SelectItem value="reagendada">Reagendada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Data da Visita */}
        <div className="space-y-2">
          <Label>Data da Visita *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? (
                  format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
                ) : (
                  "Selecione uma data"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={(date) => date < new Date()}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          {errors.data_visita && (
            <p className="text-sm text-destructive">{errors.data_visita.message}</p>
          )}
        </div>

        {/* Horário */}
        <div className="space-y-2">
          <Label htmlFor="horario_visita">Horário *</Label>
          <Select 
            value={watch('horario_visita') || ''}
            onValueChange={(value) => setValue('horario_visita', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um horário" />
            </SelectTrigger>
            <SelectContent>
              {timeSlots.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.horario_visita && (
            <p className="text-sm text-destructive">{errors.horario_visita.message}</p>
          )}
        </div>
      </div>

      {/* Avaliação do Lead - só aparece se status for realizada */}
      {status === 'realizada' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Avaliação do Lead</Label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {renderStars()}
              </div>
              <span className="text-sm text-muted-foreground">
                {rating > 0 && `${rating}/5`}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comentarios_lead">Comentários do Lead</Label>
            <Textarea
              {...register('comentarios_lead')}
              placeholder="Comentários ou feedback do lead sobre a visita..."
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback_corretor">Feedback do Corretor</Label>
            <Textarea
              {...register('feedback_corretor')}
              placeholder="Seu feedback sobre a visita..."
              className="min-h-[80px]"
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => reset()}
          disabled={isLoading}
        >
          Limpar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Salvando..." : "Salvar Visita"}
        </Button>
      </div>
    </form>
  );
}
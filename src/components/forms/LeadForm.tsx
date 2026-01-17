import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PhoneInput } from "@/components/ui/phone-input";
import { PhoneVerification } from "@/components/ui/phone-verification";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const leadSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  telefone: z.string().min(1, "Telefone é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  empreendimento_id: z.string().min(1, "Empreendimento é obrigatório"),
  data_visita_solicitada: z.date(),
  horario_visita_solicitada: z.string().min(1, "Horário é obrigatório"),
  origem: z.string().min(1, "Origem é obrigatória"),
  observacoes: z.string().optional(),
  corretor_designado_id: z.string().optional()
});

type LeadFormData = z.infer<typeof leadSchema>;

interface LeadFormProps {
  initialData?: any;
  onSuccess: (leadId?: string) => void;
  onCancel: () => void;
}

const horarios = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00"
];

const origens = [
  "website", "facebook", "instagram", "google", "indicacao", 
  "outdoor", "radio", "tv", "email", "whatsapp", "outro"
];

export default function LeadForm({ initialData, onSuccess, onCancel }: LeadFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date | undefined>(
    initialData?.data_visita_solicitada ? new Date(initialData.data_visita_solicitada) : undefined
  );

  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: initialData ? {
      ...initialData,
      email: initialData.email || "",
      data_visita_solicitada: initialData.data_visita_solicitada ? new Date(initialData.data_visita_solicitada) : undefined
    } : {
      origem: "website"
    }
  });

  // Buscar empreendimentos
  const { data: empreendimentos = [] } = useQuery({
    queryKey: ['empreendimentos-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar corretores ativos
  const { data: corretores = [] } = useQuery({
    queryKey: ['corretores-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corretores')
        .select(`
          id,
          profiles(first_name, last_name)
        `)
        .eq('status', 'ativo')
        .order('profiles(first_name)');
      
      if (error) throw error;
      return data;
    }
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      const leadData = {
        ...data,
        email: data.email || null,
        data_visita_solicitada: format(data.data_visita_solicitada, 'yyyy-MM-dd'),
        corretor_designado_id: data.corretor_designado_id || null,
        status: 'novo' as const
      };

      const { data: result, error } = await supabase
        .from('leads')
        .insert(leadData)
        .select('id')
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: async (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      
      // Se não escolheu corretor, disparar distribuição automática estilo "Uber"
      if (!variables.corretor_designado_id) {
        try {
          toast({
            title: "Lead criado",
            description: "Iniciando distribuição automática de corretores...",
          });

          const { error: distError } = await supabase.functions.invoke('distribute-lead', {
            body: { lead_id: result.id }
          });

          if (distError) throw distError;

          toast({
            title: "Distribuição em andamento",
            description: "O sistema está notificando os corretores compatíveis.",
          });
        } catch (err) {
          console.error("Erro ao iniciar distribuição:", err);
          toast({
            title: "Atenção",
            description: "Lead salvo, mas houve erro ao iniciar a distribuição automática.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Lead criado",
          description: "Lead criado e atribuído manualmente com sucesso!",
        });
      }
      
      onSuccess(result?.id);
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar lead",
        description: "Não foi possível criar o lead.",
        variant: "destructive",
      });
    }
  });

  const updateLeadMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      const leadData = {
        ...data,
        email: data.email || null,
        data_visita_solicitada: format(data.data_visita_solicitada, 'yyyy-MM-dd'),
        corretor_designado_id: data.corretor_designado_id || null
      };

      const { error } = await supabase
        .from('leads')
        .update(leadData)
        .eq('id', initialData.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: "Lead atualizado",
        description: "Lead atualizado com sucesso!",
      });
      onSuccess();
    }
  });

  const onSubmit = (data: LeadFormData) => {
    // Validação extra de telefone antes de submeter
    if (!data.telefone || data.telefone.length < 13) {
      toast({
        title: "Telefone inválido",
        description: "Por favor, insira um número de telefone completo e válido. Exemplo: (85) 99999-9999",
        variant: "destructive",
      });
      return;
    }
    
    if (initialData?.id) {
      updateLeadMutation.mutate(data);
    } else {
      createLeadMutation.mutate(data);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome *</Label>
          <Input
            id="nome"
            {...register("nome")}
            placeholder="Nome completo do lead"
          />
          {errors.nome && (
            <p className="text-sm text-red-500">{errors.nome.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone *</Label>
          <PhoneInput
            value={watch("telefone")}
            onChange={(value) => setValue("telefone", value)}
            placeholder="(85) 99999-9999"
          />
          <PhoneVerification phoneNumber={watch("telefone")} />
          {errors.telefone && (
            <p className="text-sm text-red-500">{errors.telefone.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            {...register("email")}
            placeholder="email@exemplo.com"
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Empreendimento *</Label>
          <Select onValueChange={(value) => setValue("empreendimento_id", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o empreendimento" />
            </SelectTrigger>
            <SelectContent>
              {empreendimentos.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.empreendimento_id && (
            <p className="text-sm text-red-500">{errors.empreendimento_id.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data da Visita *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(newDate) => {
                  setDate(newDate);
                  if (newDate) {
                    setValue("data_visita_solicitada", newDate);
                  }
                }}
                initialFocus
                disabled={(date) => date < new Date()}
              />
            </PopoverContent>
          </Popover>
          {errors.data_visita_solicitada && (
            <p className="text-sm text-red-500">{errors.data_visita_solicitada.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Horário da Visita *</Label>
          <Select onValueChange={(value) => setValue("horario_visita_solicitada", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o horário" />
            </SelectTrigger>
            <SelectContent>
              {horarios.map((horario) => (
                <SelectItem key={horario} value={horario}>
                  {horario}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.horario_visita_solicitada && (
            <p className="text-sm text-red-500">{errors.horario_visita_solicitada.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Origem *</Label>
          <Select onValueChange={(value) => setValue("origem", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a origem" />
            </SelectTrigger>
            <SelectContent>
              {origens.map((origem) => (
                <SelectItem key={origem} value={origem}>
                  {origem.charAt(0).toUpperCase() + origem.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.origem && (
            <p className="text-sm text-red-500">{errors.origem.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Corretor Designado</Label>
          <Select onValueChange={(value) => setValue("corretor_designado_id", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o corretor (opcional)" />
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          {...register("observacoes")}
          placeholder="Informações adicionais sobre o lead..."
          rows={3}
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={onCancel} type="button">
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={createLeadMutation.isPending || updateLeadMutation.isPending}
        >
          {(createLeadMutation.isPending || updateLeadMutation.isPending) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {initialData?.id ? "Atualizar" : "Criar"} Lead
        </Button>
      </div>
    </form>
  );
}
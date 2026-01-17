import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, DollarSign, MapPin, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const empreendimentoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  endereco: z.string().optional(),
  descricao: z.string().optional(),
  construtora_id: z.string().min(1, "Construtora é obrigatória"),
  bairro_id: z.string().min(1, "Bairro é obrigatório"),
  valor_min: z.number().optional(),
  valor_max: z.number().optional(),
  ativo: z.boolean().default(true)
});

type EmpreendimentoFormData = z.infer<typeof empreendimentoSchema>;

interface EmpreendimentoFormProps {
  initialData?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function EmpreendimentoForm({ initialData, onSuccess, onCancel }: EmpreendimentoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<EmpreendimentoFormData>({
    resolver: zodResolver(empreendimentoSchema),
    defaultValues: initialData || { ativo: true }
  });

  // Buscar construtoras
  const { data: construtoras = [] } = useQuery({
    queryKey: ['construtoras-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('construtoras')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar bairros
  const { data: bairros = [] } = useQuery({
    queryKey: ['bairros-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bairros')
        .select('id, nome, cidade')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  const createEmpreendimentoMutation = useMutation({
    mutationFn: async (data: EmpreendimentoFormData) => {
      const empreendimentoData = {
        ...data,
        endereco: data.endereco || null,
        descricao: data.descricao || null,
        valor_min: data.valor_min || null,
        valor_max: data.valor_max || null
      };

      const { error } = await supabase
        .from('empreendimentos')
        .insert(empreendimentoData);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empreendimentos'] });
      toast({
        title: "Empreendimento criado",
        description: "Empreendimento criado com sucesso!",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Erro ao criar empreendimento",
        description: "Não foi possível criar o empreendimento.",
        variant: "destructive",
      });
    }
  });

  const updateEmpreendimentoMutation = useMutation({
    mutationFn: async (data: EmpreendimentoFormData) => {
      const empreendimentoData = {
        ...data,
        endereco: data.endereco || null,
        descricao: data.descricao || null,
        valor_min: data.valor_min || null,
        valor_max: data.valor_max || null
      };

      const { error } = await supabase
        .from('empreendimentos')
        .update(empreendimentoData)
        .eq('id', initialData.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empreendimentos'] });
      toast({
        title: "Empreendimento atualizado",
        description: "Empreendimento atualizado com sucesso!",
      });
      onSuccess();
    }
  });

  const onSubmit = (data: EmpreendimentoFormData) => {
    if (initialData?.id) {
      updateEmpreendimentoMutation.mutate(data);
    } else {
      createEmpreendimentoMutation.mutate(data);
    }
  };

  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const formattedValue = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(numericValue));
    return formattedValue;
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Informações Básicas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Informações Básicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Empreendimento *</Label>
            <Input
              id="nome"
              {...register("nome")}
              placeholder="Nome do empreendimento"
            />
            {errors.nome && (
              <p className="text-sm text-red-500">{errors.nome.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Construtora *</Label>
              <Select 
                defaultValue={initialData?.construtora_id}
                onValueChange={(value) => setValue("construtora_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a construtora" />
                </SelectTrigger>
                <SelectContent>
                  {construtoras.map((construtora) => (
                    <SelectItem key={construtora.id} value={construtora.id}>
                      {construtora.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.construtora_id && (
                <p className="text-sm text-red-500">{errors.construtora_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Bairro *</Label>
              <Select 
                defaultValue={initialData?.bairro_id}
                onValueChange={(value) => setValue("bairro_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o bairro" />
                </SelectTrigger>
                <SelectContent>
                  {bairros.map((bairro) => (
                    <SelectItem key={bairro.id} value={bairro.id}>
                      {bairro.nome} - {bairro.cidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.bairro_id && (
                <p className="text-sm text-red-500">{errors.bairro_id.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              {...register("endereco")}
              placeholder="Endereço completo do empreendimento"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              {...register("descricao")}
              placeholder="Descrição detalhada do empreendimento..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Informações Financeiras */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Faixa de Preço
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_min">Valor Mínimo (R$)</Label>
              <Input
                id="valor_min"
                type="number"
                step="1000"
                {...register("valor_min", { valueAsNumber: true })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor_max">Valor Máximo (R$)</Label>
              <Input
                id="valor_max"
                type="number"
                step="1000"
                {...register("valor_max", { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Switch
              id="ativo"
              defaultChecked={initialData?.ativo !== false}
              onCheckedChange={(checked) => setValue("ativo", checked)}
            />
            <Label htmlFor="ativo">Empreendimento ativo</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={onCancel} type="button">
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={createEmpreendimentoMutation.isPending || updateEmpreendimentoMutation.isPending}
        >
          {(createEmpreendimentoMutation.isPending || updateEmpreendimentoMutation.isPending) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {initialData?.id ? "Atualizar" : "Criar"} Empreendimento
        </Button>
      </div>
    </form>
  );
}
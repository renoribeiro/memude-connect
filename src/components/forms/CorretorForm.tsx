import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { PhoneInput } from "@/components/ui/phone-input";
import { PhoneVerification } from "@/components/ui/phone-verification";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { corretorSchema, type CorretorFormData } from "@/lib/validations";
import { useFormValidations } from "@/hooks/useFormValidations";
import { Loader2, MapPin, Building, User, Phone, Mail, Search, CheckCircle, XCircle, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface CorretorFormProps {
  initialData?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const ESTADOS_BRASIL = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' }
];

const TIPOS_IMOVEL = [
  { value: 'residencial', label: 'Residencial' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'rural', label: 'Rural' },
  { value: 'todos', label: 'Todos os Tipos' }
];

const STATUS_OPTIONS = [
  { value: 'em_avaliacao', label: 'Em Avaliação' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'bloqueado', label: 'Bloqueado' }
];

export default function CorretorForm({ initialData, onSuccess, onCancel }: CorretorFormProps) {
  const queryClient = useQueryClient();
  const [selectedBairros, setSelectedBairros] = useState<string[]>([]);
  const [selectedConstrutoras, setSelectedConstrutoras] = useState<string[]>([]);
  const [bairroSearch, setBairroSearch] = useState('');
  const [construtorSearch, setConstrutorSearch] = useState('');
  const [allConstrutoras, setAllConstrutoras] = useState(false);
  const { validateCPF, validatePhone, applyMask } = useFormValidations();

  const form = useForm<CorretorFormData>({
    resolver: zodResolver(corretorSchema),
    defaultValues: {
      nome: initialData?.profiles?.first_name && initialData?.profiles?.last_name 
        ? `${initialData.profiles.first_name} ${initialData.profiles.last_name}`
        : "",
      cpf: initialData?.cpf || "",
      telefone: initialData?.telefone || initialData?.whatsapp || "", 
      email: initialData?.email || "",
      creci: initialData?.creci || "",
      cidade: initialData?.cidade || "",
      estado: initialData?.estado || "CE",
      tipo_imovel: initialData?.tipo_imovel || "todos",
      observacoes: initialData?.observacoes || "",
      status: initialData?.status || "em_avaliacao",
      nota_media: initialData?.nota_media || 0,
      bairros: [],
      construtoras: [],
    },
  });

  // Buscar bairros
  const { data: bairros = [] } = useQuery({
    queryKey: ['bairros'],
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

  // Buscar construtoras
  const { data: construtoras = [] } = useQuery({
    queryKey: ['construtoras'],
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

  // Estados para busca e filtro
  const filteredBairros = bairros?.filter(bairro => 
    bairro.nome.toLowerCase().includes(bairroSearch.toLowerCase())
  ) || [];

  const filteredConstrutoras = construtoras?.filter(construtora => 
    construtora.nome.toLowerCase().includes(construtorSearch.toLowerCase())
  ) || [];

  // Carregar dados iniciais
  useEffect(() => {
    if (initialData?.corretor_bairros) {
      setSelectedBairros(initialData.corretor_bairros.map((cb: any) => cb.bairro_id));
    }
    
    if (initialData?.corretor_construtoras) {
      const selectedIds = initialData.corretor_construtoras.map((cc: any) => cc.construtora_id);
      setSelectedConstrutoras(selectedIds);
      // Verifica se todas as construtoras estão selecionadas
      if (construtoras && selectedIds.length === construtoras.length) {
        setAllConstrutoras(true);
      }
    }
  }, [initialData, construtoras]);

  // Sincronizar estados com o formulário para validação
  useEffect(() => {
    form.setValue('bairros', selectedBairros);
    form.setValue('construtoras', selectedConstrutoras);
  }, [selectedBairros, selectedConstrutoras, form]);

  // Função para lidar com "Todas as Construtoras"
  const handleAllConstrutoras = (checked: boolean) => {
    setAllConstrutoras(checked);
    if (checked && construtoras) {
      setSelectedConstrutoras(construtoras.map(c => c.id));
    } else {
      setSelectedConstrutoras([]);
    }
  };

  // Função para lidar com seleção individual de construtoras
  const handleConstrutorSelection = (construtorId: string, checked: boolean) => {
    if (checked) {
      const newSelected = [...selectedConstrutoras, construtorId];
      setSelectedConstrutoras(newSelected);
      // Verifica se todas estão selecionadas
      if (construtoras && newSelected.length === construtoras.length) {
        setAllConstrutoras(true);
      }
    } else {
      setSelectedConstrutoras(selectedConstrutoras.filter(id => id !== construtorId));
      setAllConstrutoras(false);
    }
  };

  // Mutation para criar corretor
  const createCorretorMutation = useMutation({
    mutationFn: async (formData: CorretorFormData) => {
      const { nome, cpf, telefone, email, creci, cidade, estado, tipo_imovel, observacoes, status, nota_media } = formData;

      if (selectedBairros.length === 0) {
        throw new Error('Selecione pelo menos um bairro');
      }

      if (selectedConstrutoras.length === 0) {
        throw new Error('Selecione pelo menos uma construtora');
      }

      try {
        // Create new corretor - first create user via edge function
        const tempEmail = email || `${creci}@temp.memude.com`;
        const tempPassword = `temp_${creci}_${Date.now()}`;
        
        const [firstName, ...lastNameParts] = nome.split(' ');
        const lastName = lastNameParts.join(' ') || 'Corretor';

        // Create auth user using edge function (has service_role permissions)
        const { data: userData, error: userError } = await supabase.functions.invoke('create-user', {
          body: {
            email: tempEmail,
            password: tempPassword,
            first_name: firstName,
            last_name: lastName,
            role: 'corretor',
            phone: telefone
          }
        });

        if (userError) throw userError;
        if (!userData?.user?.id) throw new Error('Falha ao criar usuário');

        const userId = userData.user.id;

        // Fetch the profile created by the edge function
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (profileError) throw profileError;
        if (!profile) throw new Error('Falha ao buscar perfil do usuário');

        // Create corretor
        const { data: corretor, error: corretorError } = await supabase
          .from('corretores')
          .insert({
            creci,
            whatsapp: telefone, // Usar telefone no lugar de whatsapp
            telefone,
            email: email || null,
            cpf: cpf || null,
            cidade,
            estado,
            tipo_imovel,
            observacoes: observacoes || null,
            status: status || 'em_avaliacao',
            nota_media: nota_media || 0,
            data_avaliacao: (nota_media && nota_media > 0) ? new Date().toISOString().split('T')[0] : null,
            profile_id: profile.id
          })
          .select()
          .single();

        if (corretorError) throw corretorError;

        // Associate bairros
        if (selectedBairros.length > 0) {
          const bairroAssociations = selectedBairros.map(bairroId => ({
            corretor_id: corretor.id,
            bairro_id: bairroId
          }));

          const { error: bairrosError } = await supabase
            .from('corretor_bairros')
            .insert(bairroAssociations);

          if (bairrosError) throw bairrosError;
        }

        // Associate construtoras
        if (selectedConstrutoras.length > 0) {
          const construtoraAssociations = selectedConstrutoras.map(construtoraId => ({
            corretor_id: corretor.id,
            construtora_id: construtoraId
          }));

          const { error: construtorasError } = await supabase
            .from('corretor_construtoras')
            .insert(construtoraAssociations);

          if (construtorasError) throw construtorasError;
        }

        // Note: Password reset link generation removed as create-user edge function doesn't support it
        // User will receive welcome email/WhatsApp with temporary credentials
        const resetUrl = `${window.location.origin}/auth?mode=reset`;

        try {
          // Send welcome email
          const { error: emailError } = await supabase.functions.invoke('send-welcome-email', {
            body: {
              email: tempEmail,
              name: nome,
              creci,
              resetUrl: resetUrl
            }
          });

          if (emailError) {
            console.error('Error sending welcome email:', emailError);
          }

          // Send WhatsApp invitation
          const { error: whatsappError } = await supabase.functions.invoke('send-whatsapp-invitation', {
            body: {
              phone_number: telefone,
              name: nome,
              creci,
              email: tempEmail,
              resetUrl: resetUrl,
              corretor_id: corretor.id
            }
          });

          if (whatsappError) {
            console.error('Error sending WhatsApp invitation:', whatsappError);
          }
        } catch (notificationError) {
          console.error('Error sending notifications:', notificationError);
        }

        return corretor;
      } catch (error) {
        console.error('Error creating corretor:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corretores'] });
      toast({
        title: "Corretor cadastrado com sucesso!",
        description: "Email de boas-vindas e mensagem no WhatsApp foram enviados.",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar corretor",
        description: error.message || "Não foi possível cadastrar o corretor.",
        variant: "destructive",
      });
    }
  });

  // Mutation para atualizar corretor
  const updateCorretorMutation = useMutation({
    mutationFn: async (formData: CorretorFormData) => {
      const { nome, cpf, telefone, email, creci, cidade, estado, tipo_imovel, observacoes, status, nota_media } = formData;

      try {
        // Update corretor data
        const { error: corretorError } = await supabase
          .from('corretores')
          .update({
            creci,
            whatsapp: telefone, // Usar telefone no lugar de whatsapp
            telefone,
            email: email || null,
            cpf: cpf || null,
            cidade,
            estado,
            tipo_imovel,
            observacoes: observacoes || null,
            status: status || 'em_avaliacao',
            nota_media: nota_media || 0,
            data_avaliacao: (nota_media && nota_media > 0) ? new Date().toISOString().split('T')[0] : null
          })
          .eq('id', initialData.id);

        if (corretorError) throw corretorError;

        // Update profile if needed
        if (initialData?.profiles) {
          const [firstName, ...lastNameParts] = nome.split(' ');
          const lastName = lastNameParts.join(' ') || 'Corretor';
          
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              first_name: firstName,
              last_name: lastName
            })
            .eq('id', initialData.profiles.id);

          if (profileError) throw profileError;
        }

        // Remove old associations
        await supabase
          .from('corretor_bairros')
          .delete()
          .eq('corretor_id', initialData.id);

        await supabase
          .from('corretor_construtoras')
          .delete()
          .eq('corretor_id', initialData.id);

        // Create new associations
        if (selectedBairros.length > 0) {
          const bairroAssociations = selectedBairros.map(bairroId => ({
            corretor_id: initialData.id,
            bairro_id: bairroId
          }));

          const { error: bairrosError } = await supabase
            .from('corretor_bairros')
            .insert(bairroAssociations);

          if (bairrosError) throw bairrosError;
        }

        if (selectedConstrutoras.length > 0) {
          const construtoraAssociations = selectedConstrutoras.map(construtoraId => ({
            corretor_id: initialData.id,
            construtora_id: construtoraId
          }));

          const { error: construtorasError } = await supabase
            .from('corretor_construtoras')
            .insert(construtoraAssociations);

          if (construtorasError) throw construtorasError;
        }

        return { success: true };
      } catch (error) {
        console.error('Error updating corretor:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corretores'] });
      toast({
        title: "Corretor atualizado",
        description: "Dados do corretor atualizados com sucesso!",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar corretor",
        description: error.message || "Não foi possível atualizar o corretor.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (formData: CorretorFormData) => {
    // Garantir que os arrays estão atualizados antes da validação
    const updatedData = {
      ...formData,
      bairros: selectedBairros,
      construtoras: selectedConstrutoras
    };

    if (initialData?.id) {
      updateCorretorMutation.mutate(updatedData);
    } else {
      createCorretorMutation.mutate(updatedData);
    }
  };

  const toggleBairro = (bairroId: string) => {
    setSelectedBairros(prev => 
      prev.includes(bairroId) 
        ? prev.filter(id => id !== bairroId)
        : [...prev, bairroId]
    );
  };

  const toggleConstrutora = (construtoraId: string) => {
    setSelectedConstrutoras(prev => 
      prev.includes(construtoraId) 
        ? prev.filter(id => id !== construtoraId)
        : [...prev, construtoraId]
    );
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Dados Pessoais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                {...form.register("nome")}
                placeholder="Nome completo do corretor"
              />
              {form.formState.errors.nome && (
                <p className="text-sm text-destructive">{form.formState.errors.nome.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <div className="relative">
                <Input
                  id="cpf"
                  {...form.register("cpf")}
                  placeholder="000.000.000-00"
                  onChange={(e) => {
                    const maskedValue = applyMask(e.target.value, 'cpf');
                    form.setValue('cpf', maskedValue);
                  }}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {form.watch('cpf') && (
                    validateCPF(form.watch('cpf')) ? 
                      <CheckCircle className="h-4 w-4 text-green-500" /> :
                      <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
              {form.formState.errors.cpf && (
                <p className="text-sm text-destructive">{form.formState.errors.cpf.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <PhoneInput
                value={form.watch("telefone")}
                onChange={(value) => form.setValue("telefone", value)}
                placeholder="(85) 99999-9999"
              />
              <PhoneVerification phoneNumber={form.watch("telefone")} />
              {form.formState.errors.telefone && (
                <p className="text-sm text-destructive">{form.formState.errors.telefone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="corretor@email.com"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados Profissionais */}
      <Card>
        <CardHeader>
          <CardTitle>Dados Profissionais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="creci">CRECI *</Label>
              <Input
                id="creci"
                {...form.register("creci")}
                placeholder="Número do CRECI"
              />
              {form.formState.errors.creci && (
                <p className="text-sm text-destructive">{form.formState.errors.creci.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade *</Label>
              <Input
                id="cidade"
                {...form.register("cidade")}
                placeholder="Nome da cidade"
              />
              {form.formState.errors.cidade && (
                <p className="text-sm text-destructive">{form.formState.errors.cidade.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado">Estado *</Label>
              <Select value={form.watch("estado")} onValueChange={(value) => form.setValue("estado", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_BRASIL.map((estado) => (
                    <SelectItem key={estado.value} value={estado.value}>
                      {estado.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.estado && (
                <p className="text-sm text-destructive">{form.formState.errors.estado.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo_imovel">Tipo de Imóvel *</Label>
              <Select value={form.watch("tipo_imovel")} onValueChange={(value) => form.setValue("tipo_imovel", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_IMOVEL.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.tipo_imovel && (
                <p className="text-sm text-destructive">{form.formState.errors.tipo_imovel.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.watch("status")} onValueChange={(value) => form.setValue("status", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campo de Avaliação */}
          <div className="space-y-2">
            <Label htmlFor="nota_media">
              Avaliação do Corretor
            </Label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "w-6 h-6 cursor-pointer transition-colors",
                      star <= (form.watch("nota_media") || 0)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    )}
                    onClick={() => form.setValue("nota_media", star)}
                  />
                ))}
                <span className="text-sm text-muted-foreground ml-2">
                  {form.watch("nota_media") 
                    ? `${form.watch("nota_media").toFixed(1)} estrelas` 
                    : "Não avaliado"}
                </span>
              </div>
              
              <Slider
                value={[form.watch("nota_media") || 0]}
                onValueChange={(value) => form.setValue("nota_media", value[0])}
                max={5}
                step={0.5}
                className="w-full"
              />
              
              <p className="text-xs text-muted-foreground">
                Arraste o controle ou clique nas estrelas para avaliar (0 a 5)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              {...form.register("observacoes")}
              placeholder="Informações adicionais sobre o corretor..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Áreas de Atuação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bairros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Bairros de Atuação *
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar bairro..."
                  value={bairroSearch}
                  onChange={(e) => setBairroSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredBairros.map((bairro) => (
                <div key={bairro.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`bairro-${bairro.id}`}
                    checked={selectedBairros.includes(bairro.id)}
                    onCheckedChange={() => toggleBairro(bairro.id)}
                  />
                  <Label 
                    htmlFor={`bairro-${bairro.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {bairro.nome} - {bairro.cidade}
                  </Label>
                </div>
              ))}
            </div>
            {selectedBairros.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  {selectedBairros.length} bairro{selectedBairros.length > 1 ? 's' : ''} selecionado{selectedBairros.length > 1 ? 's' : ''}:
                </p>
                <div className="flex flex-wrap gap-1">
                  {selectedBairros.map((bairroId) => {
                    const bairro = bairros?.find(b => b.id === bairroId);
                    return bairro ? (
                      <Badge key={bairroId} variant="secondary" className="text-xs">
                        {bairro.nome}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}
            {selectedBairros.length === 0 && (
              <p className="text-sm text-destructive mt-2">Selecione pelo menos um bairro</p>
            )}
          </CardContent>
        </Card>

        {/* Construtoras */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Construtoras Parceiras *
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar construtora..."
                  value={construtorSearch}
                  onChange={(e) => setConstrutorSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {/* Opção "Todas as Construtoras" */}
              <div className="flex items-center space-x-2 pb-2 border-b">
                <Checkbox
                  id="todas-construtoras"
                  checked={allConstrutoras}
                  onCheckedChange={handleAllConstrutoras}
                />
                <Label htmlFor="todas-construtoras" className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-primary">
                  Todas as Construtoras
                </Label>
              </div>
              
              {filteredConstrutoras.map((construtora) => (
                <div key={construtora.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`construtora-${construtora.id}`}
                    checked={selectedConstrutoras.includes(construtora.id)}
                    onCheckedChange={(checked) => handleConstrutorSelection(construtora.id, checked as boolean)}
                  />
                  <Label 
                    htmlFor={`construtora-${construtora.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {construtora.nome}
                  </Label>
                </div>
              ))}
            </div>
            {selectedConstrutoras.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  {allConstrutoras ? 'Todas as construtoras selecionadas' : `${selectedConstrutoras.length} construtora${selectedConstrutoras.length > 1 ? 's' : ''} selecionada${selectedConstrutoras.length > 1 ? 's' : ''}:`}
                </p>
                {!allConstrutoras && (
                  <div className="flex flex-wrap gap-1">
                    {selectedConstrutoras.map((construtoraId) => {
                      const construtora = construtoras?.find(c => c.id === construtoraId);
                      return construtora ? (
                        <Badge key={construtoraId} variant="secondary" className="text-xs">
                          {construtora.nome}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}
            {selectedConstrutoras.length === 0 && (
              <p className="text-sm text-destructive mt-2">Selecione pelo menos uma construtora</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={onCancel} type="button">
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={createCorretorMutation.isPending || updateCorretorMutation.isPending}
        >
          {(createCorretorMutation.isPending || updateCorretorMutation.isPending) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {initialData?.id ? "Atualizar" : "Cadastrar"} Corretor
        </Button>
      </div>
    </form>
  );
}
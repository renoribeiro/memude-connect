import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Save, User, Award, MapPin, Building, Star, TrendingUp, Calendar } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CorretorProfile {
  id: string;
  creci: string;
  whatsapp: string;
  cpf?: string;
  status: string;
  nota_media: number;
  total_visitas: number;
  observacoes?: string;
  data_avaliacao?: string;
  created_at: string;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    phone?: string;
    avatar_url?: string;
  };
}

const statusVariants = {
  'em_avaliacao': 'secondary',
  'aprovado': 'success',
  'reprovado': 'destructive',
  'suspenso': 'outline'
} as const;

const statusLabels = {
  'em_avaliacao': 'Em Avaliação',
  'aprovado': 'Aprovado',
  'reprovado': 'Reprovado',
  'suspenso': 'Suspenso'
};

export default function Perfil() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("perfil");

  const { data: corretor, isLoading } = useQuery({
    queryKey: ['corretor-profile'],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      const { data, error } = await supabase
        .from('corretores')
        .select(`
          *,
          profiles(*)
        `)
        .eq('profile_id', profile.id)
        .single();
      
      if (error) throw error;
      return data as CorretorProfile;
    },
    enabled: !!profile?.id
  });

  const { data: bairros = [] } = useQuery({
    queryKey: ['my-bairros', corretor?.id],
    queryFn: async () => {
      if (!corretor?.id) return [];
      
      const { data, error } = await supabase
        .from('corretor_bairros')
        .select(`
          bairros(nome, cidade)
        `)
        .eq('corretor_id', corretor.id);
      
      if (error) throw error;
      return data.map(item => item.bairros).filter(Boolean);
    },
    enabled: !!corretor?.id
  });

  const { data: construtoras = [] } = useQuery({
    queryKey: ['my-construtoras', corretor?.id],
    queryFn: async () => {
      if (!corretor?.id) return [];
      
      const { data, error } = await supabase
        .from('corretor_construtoras')
        .select(`
          construtoras(nome)
        `)
        .eq('corretor_id', corretor.id);
      
      if (error) throw error;
      return data.map(item => item.construtoras).filter(Boolean);
    },
    enabled: !!corretor?.id
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { first_name: string; last_name: string; phone?: string }) => {
      if (!profile?.id) throw new Error('Usuário não encontrado');
      
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', profile.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corretor-profile'] });
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível salvar as informações.",
        variant: "destructive",
      });
    }
  });

  const updateCorretorMutation = useMutation({
    mutationFn: async (data: { whatsapp: string; observacoes?: string }) => {
      if (!corretor?.id) throw new Error('Corretor não encontrado');
      
      const { error } = await supabase
        .from('corretores')
        .update(data)
        .eq('id', corretor.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corretor-profile'] });
      toast({
        title: "Dados atualizados",
        description: "Suas informações profissionais foram salvas.",
      });
    }
  });

  const getRatingStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Star key={i} className="w-4 h-4 fill-yellow-400/50 text-yellow-400" />);
      } else {
        stars.push(<Star key={i} className="w-4 h-4 text-muted-foreground" />);
      }
    }
    return stars;
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (!profile || !corretor) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-6">
          <Avatar className="w-20 h-20">
            <AvatarImage src={corretor.profiles.avatar_url} />
            <AvatarFallback className="text-lg">
              {getInitials(corretor.profiles.first_name, corretor.profiles.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">
              {corretor.profiles.first_name} {corretor.profiles.last_name}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant={statusVariants[corretor.status as keyof typeof statusVariants] || 'default'}>
                {statusLabels[corretor.status as keyof typeof statusLabels] || corretor.status}
              </Badge>
              <span className="text-muted-foreground">CRECI: {corretor.creci}</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Award className="w-4 h-4" />
                Avaliação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{corretor.nota_media.toFixed(1)}</div>
                <div className="flex items-center">
                  {getRatingStars(corretor.nota_media)}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Total de Visitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{corretor.total_visitas}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Bairros Atribuídos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bairros.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building className="w-4 h-4" />
                Construtoras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{construtoras.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="perfil" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Dados Pessoais
            </TabsTrigger>
            <TabsTrigger value="areas" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Áreas de Atuação
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="perfil" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Pessoais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Nome</Label>
                    <Input
                      id="first_name"
                      defaultValue={corretor.profiles.first_name}
                      onBlur={(e) => {
                        if (e.target.value !== corretor.profiles.first_name) {
                          updateProfileMutation.mutate({
                            first_name: e.target.value,
                            last_name: corretor.profiles.last_name,
                            phone: corretor.profiles.phone
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Sobrenome</Label>
                    <Input
                      id="last_name"
                      defaultValue={corretor.profiles.last_name}
                      onBlur={(e) => {
                        if (e.target.value !== corretor.profiles.last_name) {
                          updateProfileMutation.mutate({
                            first_name: corretor.profiles.first_name,
                            last_name: e.target.value,
                            phone: corretor.profiles.phone
                          });
                        }
                      }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      defaultValue={corretor.profiles.phone}
                      onBlur={(e) => {
                        if (e.target.value !== corretor.profiles.phone) {
                          updateProfileMutation.mutate({
                            first_name: corretor.profiles.first_name,
                            last_name: corretor.profiles.last_name,
                            phone: e.target.value
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input
                      id="whatsapp"
                      defaultValue={corretor.whatsapp}
                      onBlur={(e) => {
                        if (e.target.value !== corretor.whatsapp) {
                          updateCorretorMutation.mutate({
                            whatsapp: e.target.value,
                            observacoes: corretor.observacoes
                          });
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="creci">CRECI (Somente Leitura)</Label>
                  <Input
                    id="creci"
                    value={corretor.creci}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    placeholder="Adicione informações adicionais sobre seu perfil..."
                    defaultValue={corretor.observacoes}
                    onBlur={(e) => {
                      if (e.target.value !== corretor.observacoes) {
                        updateCorretorMutation.mutate({
                          whatsapp: corretor.whatsapp,
                          observacoes: e.target.value
                        });
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="areas" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Bairros de Atuação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {bairros.length > 0 ? (
                    <div className="space-y-2">
                      {bairros.map((bairro, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <span>{bairro.nome}</span>
                          <Badge variant="outline">{bairro.cidade}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhum bairro atribuído ainda
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="w-5 h-5" />
                    Construtoras Parceiras
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {construtoras.length > 0 ? (
                    <div className="space-y-2">
                      {construtoras.map((construtora, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <span>{construtora.nome}</span>
                          <Badge variant="success">Ativa</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhuma construtora atribuída ainda
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="historico" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Histórico do Corretor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                    <div>
                      <p className="font-medium">Cadastro no Sistema</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(corretor.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant="outline">Sistema</Badge>
                  </div>

                  {corretor.data_avaliacao && (
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                      <div>
                        <p className="font-medium">Avaliação Realizada</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(corretor.data_avaliacao), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant="success">Aprovado</Badge>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                    <div>
                      <p className="font-medium">Status Atual</p>
                      <p className="text-sm text-muted-foreground">
                        {statusLabels[corretor.status as keyof typeof statusLabels]}
                      </p>
                    </div>
                    <Badge variant={statusVariants[corretor.status as keyof typeof statusVariants]}>
                      Ativo
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, Clock, Users, Bell } from "lucide-react";

export function VisitDistributionSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['distribution-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_settings')
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
  });

  const [formData, setFormData] = useState({
    max_attempts: settings?.max_attempts || 5,
    timeout_minutes: settings?.timeout_minutes || 15,
    auto_distribution_enabled: settings?.auto_distribution_enabled ?? true,
    fallback_to_admin: settings?.fallback_to_admin ?? true,
    notification_method: settings?.notification_method || 'whatsapp',
  });

  // Atualiza formData quando settings carrega
  useState(() => {
    if (settings) {
      setFormData({
        max_attempts: settings.max_attempts || 5,
        timeout_minutes: settings.timeout_minutes || 15,
        auto_distribution_enabled: settings.auto_distribution_enabled ?? true,
        fallback_to_admin: settings.fallback_to_admin ?? true,
        notification_method: settings.notification_method || 'whatsapp',
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('distribution_settings')
        .upsert({
          id: settings?.id || crypto.randomUUID(),
          ...data,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution-settings'] });
      toast({
        title: "Configurações salvas",
        description: "As configurações de distribuição foram atualizadas com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Distribuição</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configurações de Distribuição de Visitas
        </CardTitle>
        <CardDescription>
          Configure como as visitas são distribuídas automaticamente para os corretores
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Distribuição Automática */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-distribution" className="text-base">
              Distribuição Automática
            </Label>
            <p className="text-sm text-muted-foreground">
              Ativar distribuição automática de visitas para corretores
            </p>
          </div>
          <Switch
            id="auto-distribution"
            checked={formData.auto_distribution_enabled}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, auto_distribution_enabled: checked })
            }
          />
        </div>

        {/* Número Máximo de Tentativas */}
        <div className="space-y-2">
          <Label htmlFor="max-attempts" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Número Máximo de Tentativas
          </Label>
          <Input
            id="max-attempts"
            type="number"
            min="1"
            max="10"
            value={formData.max_attempts}
            onChange={(e) =>
              setFormData({ ...formData, max_attempts: parseInt(e.target.value) || 5 })
            }
          />
          <p className="text-xs text-muted-foreground">
            Quantos corretores serão contatados antes de notificar o administrador
          </p>
        </div>

        {/* Tempo Limite por Tentativa */}
        <div className="space-y-2">
          <Label htmlFor="timeout" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Tempo Limite por Tentativa (minutos)
          </Label>
          <Input
            id="timeout"
            type="number"
            min="5"
            max="60"
            value={formData.timeout_minutes}
            onChange={(e) =>
              setFormData({ ...formData, timeout_minutes: parseInt(e.target.value) || 15 })
            }
          />
          <p className="text-xs text-muted-foreground">
            Quanto tempo cada corretor tem para responder antes de passar para o próximo
          </p>
        </div>

        {/* Fallback para Admin */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="fallback-admin" className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notificar Administrador
            </Label>
            <p className="text-sm text-muted-foreground">
              Notificar admin quando todas as tentativas falharem
            </p>
          </div>
          <Switch
            id="fallback-admin"
            checked={formData.fallback_to_admin}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, fallback_to_admin: checked })
            }
          />
        </div>

        {/* Botão Salvar */}
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {updateMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </CardContent>
    </Card>
  );
}

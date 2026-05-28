import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, Settings, MessageSquare, Smartphone, Mail, Database, Zap, Users, CheckCircle, XCircle, AlertTriangle, Loader2, Info, Calendar, Copy, Activity, DollarSign } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { LeadDistribution } from "@/components/automation/LeadDistribution";
import { DistributionMonitor } from "@/components/automation/DistributionMonitor";
import { VisitDistributionMonitor } from "@/components/automation/VisitDistributionMonitor";
import { VisitDistributionSettings } from "@/components/automation/VisitDistributionSettings";
import { WebhookMonitor } from "@/components/automation/WebhookMonitor";
import { EvolutionInstances } from "@/components/configuracoes/EvolutionInstances";
import webhookConfigGuide from "@/assets/webhook-config-guide.png";

interface SystemSetting {
  key: string;
  value: string;
  description?: string;
}

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'error';

const DEFAULT_SETTINGS = {
  'company_name': 'MEMUDE Imóveis',
  'company_email': 'contato@memude.com',
  'company_phone': '+55 85 99999-9999',
  'evolution_api_url': '',
  'evolution_api_key': '',
  'evolution_instance_name': '',
  'whatsapp_api_token': '',
  'whatsapp_phone_id': '',
  'sms_api_key': '',
  'email_smtp_host': '',
  'email_smtp_port': '587',
  'email_smtp_user': '',
  'email_smtp_password': '',
  'lead_auto_assign': 'true',
  'notification_emails': 'true',
  'notification_whatsapp': 'true',
  'backup_frequency': 'daily',
};

export default function Configuracoes() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("geral");
  const [evolutionStatus, setEvolutionStatus] = useState<ConnectionStatus>('idle');
  const [wahaStatus, setWahaStatus] = useState<ConnectionStatus>('idle');
  const [isSaving, setIsSaving] = useState<string | null>(null);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('key');

      if (error) throw error;
      return data as SystemSetting[];
    }
  });

  // Efeito para testar conexão automaticamente quando entrar na aba comunicação
  useEffect(() => {
    if (activeTab === 'comunicacao') {
      if (evolutionStatus === 'idle') {
        const hasEvolutionConfig = getSetting('evolution_api_url') &&
          getSetting('evolution_api_key') &&
          getSetting('evolution_instance_name');

        if (hasEvolutionConfig) {
          setTimeout(() => testEvolutionConnection(), 1000);
        }
      }
      if (wahaStatus === 'idle') {
        const hasWahaConfig = getSetting('waha_api_url');
        if (hasWahaConfig) {
          setTimeout(() => testWahaConnection(), 1000);
        }
      }
    }
  }, [activeTab, settings]);

  const getSetting = (key: string) => {
    const setting = settings.find(s => s.key === key);
    return setting?.value || DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] || '';
  };

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      // Primeiro, tenta fazer update do registro existente
      const { data: updateResult, error: updateError } = await supabase
        .from('system_settings')
        .update({
          value,
          updated_by: profile?.id,
          updated_at: new Date().toISOString()
        })
        .eq('key', key)
        .select();

      // Se não encontrou nenhum registro para atualizar, cria um novo
      if (updateResult && updateResult.length === 0) {
        const { error: insertError } = await supabase
          .from('system_settings')
          .insert({
            key,
            value,
            updated_by: profile?.id,
            updated_at: new Date().toISOString()
          });

        if (insertError) throw insertError;
      } else if (updateError) {
        throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso.",
      });
    },
    onError: (error) => {
      console.error('Erro ao salvar configuração:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    }
  });


  const handleSaveSetting = async (key: string, value: string) => {
    setIsSaving(key);
    try {
      await updateSettingMutation.mutateAsync({ key, value });
    } finally {
      setIsSaving(null);
    }
  };

  // Debounce function para evitar muitas chamadas
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSave = useCallback(
    (...args: any[]) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => handleSaveSetting(...args), 500);
    },
    [handleSaveSetting]
  );

  const handleSwitchChange = (key: string, checked: boolean) => {
    handleSaveSetting(key, checked.toString());
  };

  // Função para validar URL
  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Função para testar conexão com Evolution API
  const testEvolutionConnection = async () => {
    setEvolutionStatus('testing');

    // Validar campos antes de testar
    const apiUrl = getSetting('evolution_api_url')?.trim();
    const apiKey = getSetting('evolution_api_key')?.trim();
    const instanceName = getSetting('evolution_instance_name')?.trim();

    if (!apiUrl || !apiKey || !instanceName) {
      setEvolutionStatus('error');
      const missingFields = [];
      if (!apiUrl) missingFields.push('URL da API');
      if (!apiKey) missingFields.push('Chave da API');
      if (!instanceName) missingFields.push('Nome da Instância');

      toast({
        title: "Configuração incompleta",
        description: `Por favor, preencha: ${missingFields.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    if (!validateUrl(apiUrl)) {
      setEvolutionStatus('error');
      toast({
        title: "URL inválida",
        description: "A URL da API deve ser válida (ex: https://api.evolution.com)",
        variant: "destructive",
      });
      return;
    }

    console.log('Testing Evolution API V2 connection with:', {
      url: apiUrl,
      instance: instanceName,
      hasApiKey: !!apiKey
    });

    try {
      const { data, error } = await supabase.functions.invoke('evolution-check-connection');

      if (error) {
        console.error('Function invocation error:', error);
        throw error;
      }

      if (data.success && data.connected) {
        setEvolutionStatus('connected');
        toast({
          title: "✅ Conexão bem-sucedida",
          description: `Instância "${data.instance_name}" conectada. Status: ${data.instance_state}`,
        });
      } else {
        setEvolutionStatus('error');
        const errorMsg = data.error || "Não foi possível conectar à Evolution API";
        console.error('Connection test failed:', data);
        toast({
          title: "❌ Falha na conexão",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Connection test error:', error);
      setEvolutionStatus('error');
      toast({
        title: "❌ Erro de conexão",
        description: error.message || "Não foi possível testar a conexão",
        variant: "destructive",
      });
    }
  };

  // Função para testar conexão com WAHA API
  const testWahaConnection = async () => {
    setWahaStatus('testing');

    const apiUrl = getSetting('waha_api_url')?.trim();

    if (!apiUrl) {
      setWahaStatus('error');
      toast({
        title: "Configuração incompleta",
        description: "Por favor, preencha a URL da API WAHA",
        variant: "destructive",
      });
      return;
    }

    if (!validateUrl(apiUrl)) {
      setWahaStatus('error');
      toast({
        title: "URL inválida",
        description: "A URL da API WAHA deve ser válida (ex: http://localhost:3000)",
        variant: "destructive",
      });
      return;
    }

    console.log('Testing WAHA connection with:', { url: apiUrl });

    try {
      const { data, error } = await supabase.functions.invoke('waha-check-connection');

      if (error) {
        console.error('Function invocation error:', error);
        throw error;
      }

      if (data?.success && data?.connected) {
        setWahaStatus('connected');
        toast({
          title: "✅ Conexão bem-sucedida",
          description: `Sessão WAHA "default" ativa e pronta para uso. Status: ${data.instance_state}`,
        });
      } else {
        setWahaStatus('error');
        const errorMsg = data?.error || "A sessão 'default' do WAHA não está com status WORKING";
        toast({
          title: "❌ Falha na conexão",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('WAHA Connection test error:', error);
      setWahaStatus('error');
      toast({
        title: "❌ Erro de conexão",
        description: error.message || "Não foi possível testar a conexão com o WAHA",
        variant: "destructive",
      });
    }
  };

  const getWahaConnectionBadge = () => {
    switch (wahaStatus) {
      case 'testing':
        return (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Testando conexão...
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" />
            Conectado
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <XCircle className="w-4 h-4" />
            Erro de conexão
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="w-4 h-4" />
            Não testado
          </div>
        );
    }
  };

  // Função para renderizar o status da conexão
  const getConnectionBadge = () => {
    switch (evolutionStatus) {
      case 'testing':
        return (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Testando conexão...
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" />
            Conectado
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <XCircle className="w-4 h-4" />
            Erro de conexão
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="w-4 h-4" />
            Não testado
          </div>
        );
    }
  };

  if (!profile) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
            <p className="text-muted-foreground">
              Gerencie as configurações gerais e integrações
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-row overflow-x-auto justify-start md:grid md:grid-cols-6 w-full h-auto p-1 whitespace-nowrap scrollbar-none">
            <TabsTrigger value="geral" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="comunicacao" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Comunicação
            </TabsTrigger>
            <TabsTrigger value="integracao" className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Integrações
            </TabsTrigger>
            <TabsTrigger value="automacao" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Automação Leads
            </TabsTrigger>
            <TabsTrigger value="automacao-visitas" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Automação Visitas
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Financeiro
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Empresa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Nome da Empresa</Label>
                    <Input
                      id="company_name"
                      defaultValue={getSetting('company_name')}
                      disabled={isSaving === 'company_name'}
                      onBlur={(e) => debouncedSave('company_name', e.target.value)}
                    />
                    {isSaving === 'company_name' && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_phone">Telefone</Label>
                    <Input
                      id="company_phone"
                      defaultValue={getSetting('company_phone')}
                      disabled={isSaving === 'company_phone'}
                      onBlur={(e) => handleSaveSetting('company_phone', e.target.value)}
                    />
                    {isSaving === 'company_phone' && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_email">Email da Empresa</Label>
                  <Input
                    id="company_email"
                    type="email"
                    defaultValue={getSetting('company_email')}
                    disabled={isSaving === 'company_email'}
                    onBlur={(e) => handleSaveSetting('company_email', e.target.value)}
                  />
                  {isSaving === 'company_email' && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preferências do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Atribuição Automática de Leads</Label>
                    <p className="text-sm text-muted-foreground">
                      Distribui leads automaticamente para corretores disponíveis
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={getSetting('lead_auto_assign') === 'true'}
                      disabled={isSaving === 'lead_auto_assign'}
                      onCheckedChange={(checked) => handleSwitchChange('lead_auto_assign', checked)}
                    />
                    {isSaving === 'lead_auto_assign' && <Loader2 className="w-4 h-4 animate-spin" />}
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações por Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Receber notificações importantes por email
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={getSetting('notification_emails') === 'true'}
                      disabled={isSaving === 'notification_emails'}
                      onCheckedChange={(checked) => handleSwitchChange('notification_emails', checked)}
                    />
                    {isSaving === 'notification_emails' && <Loader2 className="w-4 h-4 animate-spin" />}
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações por WhatsApp</Label>
                    <p className="text-sm text-muted-foreground">
                      Receber notificações via WhatsApp
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={getSetting('notification_whatsapp') === 'true'}
                      disabled={isSaving === 'notification_whatsapp'}
                      onCheckedChange={(checked) => handleSwitchChange('notification_whatsapp', checked)}
                    />
                    {isSaving === 'notification_whatsapp' && <Loader2 className="w-4 h-4 animate-spin" />}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comunicacao" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Provedor de WhatsApp
                </CardTitle>
                <CardDescription>
                  Escolha qual API será utilizada para envio e recebimento de mensagens.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Selecione o Provedor</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    defaultValue={getSetting('whatsapp_provider') || 'evolution'}
                    onChange={(e) => handleSaveSetting('whatsapp_provider', e.target.value)}
                  >
                    <option value="evolution">Evolution API V2</option>
                    <option value="waha">WAHA (WhatsApp HTTP API)</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Configuração Evolution */}
            {(getSetting('whatsapp_provider') === 'evolution' || !getSetting('whatsapp_provider')) && (
              <EvolutionInstances />
            )}

            {/* Configuração WAHA */}
            {getSetting('whatsapp_provider') === 'waha' && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      Configuração WAHA
                    </CardTitle>
                    <CardDescription>
                      WhatsApp HTTP API - Opção estável e leve.
                      <a
                        href="https://waha.devlike.pro/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline ml-1"
                      >
                        Ver documentação
                      </a>
                    </CardDescription>
                  </div>
                  {getWahaConnectionBadge()}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="waha_api_url">URL da API WAHA</Label>
                    <Input
                      id="waha_api_url"
                      placeholder="http://localhost:3000"
                      defaultValue={getSetting('waha_api_url')}
                      onBlur={(e) => handleSaveSetting('waha_api_url', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="waha_api_key">Chave da API (X-Api-Key)</Label>
                    <Input
                      id="waha_api_key"
                      type="password"
                      placeholder="Opcional se não configurado auth"
                      defaultValue={getSetting('waha_api_key')}
                      onBlur={(e) => handleSaveSetting('waha_api_key', e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={testWahaConnection}
                      disabled={wahaStatus === 'testing'}
                    >
                      {wahaStatus === 'testing' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Testar Conexão
                    </Button>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Webhook para WAHA:</strong>
                      <br />
                      Configure o evento <code className="text-xs bg-muted px-1">message.any</code> manualmente no seu painel WAHA para apontar para a URL abaixo, enviando no cabeçalho <code className="text-xs bg-muted px-1">X-Api-Key</code> a sua chave secreta cadastrada:
                      <br />
                      <code className="text-xs bg-muted px-1 py-0.5 rounded block mt-1 overflow-x-auto font-mono">
                        https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/waha-webhook-handler
                      </code>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Configuração Webhook (Comum ou Específico) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  🔗 URL do Webhook Evolution API
                </CardTitle>
                <CardDescription>
                  Copie esta URL e configure manualmente no painel da Evolution API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* URL do Webhook com botão Copiar */}
                <div className="space-y-2">
                  <Label>URL do Webhook</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value="https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/evolution-webhook-handler"
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText('https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/evolution-webhook-handler');
                        toast({
                          title: "URL copiada!",
                          description: "Cole esta URL no painel da Evolution API",
                        });
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* FASE 4: Botão de Teste */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setIsSaving('test_webhook');
                      try {
                        const { data, error } = await supabase.functions.invoke('test-webhook');

                        if (error) throw error;

                        if (data.success) {
                          toast({
                            title: "✅ Webhook funcionando!",
                            description: data.message || "O webhook está recebendo eventos corretamente.",
                          });
                        } else {
                          toast({
                            title: "⚠️ Webhook com problemas",
                            description: data.message || "O webhook não está funcionando corretamente.",
                            variant: "destructive",
                          });
                        }
                      } catch (error: any) {
                        toast({
                          title: "Erro ao testar webhook",
                          description: error.message,
                          variant: "destructive",
                        });
                      } finally {
                        setIsSaving(null);
                      }
                    }}
                    disabled={isSaving === 'test_webhook'}
                  >
                    {isSaving === 'test_webhook' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Activity className="w-4 h-4 mr-2" />
                    )}
                    Testar Webhook
                  </Button>

                  {/* FASE 3: Botão Configurar Webhook */}
                  <Button
                    onClick={async () => {
                      setIsSaving('configure_webhook');
                      try {
                        toast({
                          title: "Configurando webhook...",
                          description: "Aguarde enquanto configuramos a Evolution API",
                        });

                        const { data, error } = await supabase.functions.invoke('evolution-configure-webhook');

                        if (error) throw error;

                        if (data?.success) {
                          toast({
                            title: "✅ Webhook configurado!",
                            description: `Webhook ativo na instância ${data.instance}. Eventos: ${data.events?.join(', ')}`,
                          });

                          queryClient.invalidateQueries({ queryKey: ['system-settings'] });
                        } else {
                          throw new Error(data?.error || 'Erro desconhecido ao configurar webhook. Verifique as configurações da Evolution API.');
                        }
                      } catch (error: any) {
                        console.error('Erro ao configurar webhook:', error);
                        toast({
                          title: "❌ Erro ao configurar webhook",
                          description: error.message || "Verifique se a Evolution API está configurada corretamente",
                          variant: "destructive",
                        });
                      } finally {
                        setIsSaving(null);
                      }
                    }}
                    disabled={isSaving === 'configure_webhook'}
                  >
                    {isSaving === 'configure_webhook' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    Configurar Webhook Automaticamente
                  </Button>
                </div>

                {/* Tutorial passo a passo */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>📝 Como configurar manualmente:</strong>
                    <ol className="list-decimal ml-4 mt-2 space-y-1 text-sm">
                      <li>Copie a URL acima clicando no botão de copiar</li>
                      <li>Acesse o painel da Evolution API</li>
                      <li>Vá em "Webhook" nas configurações da sua instância</li>
                      <li>Ative o webhook (toggle "Ativo")</li>
                      <li>Cole a URL no campo "URL"</li>
                      <li>Mantenha "Webhook por Eventos" <strong>DESATIVADO</strong></li>
                      <li>Mantenha "Webhook Base64" <strong>DESATIVADO</strong></li>
                      <li>Salve as configurações</li>
                      <li>Volte aqui e clique em "Testar Webhook"</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                {/* FASE 5: Documentação oficial */}
                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>📚 Documentação Oficial:</strong>
                    <br />
                    <a
                      href="https://doc.evolution-api.com/v2/pt/configuration/webhooks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:text-primary/80"
                    >
                      Webhooks - Evolution API V2 (Português)
                    </a>
                  </AlertDescription>
                </Alert>

                {/* FASE 5: Imagem de referência */}
                <div className="border rounded-lg overflow-hidden">
                  <img
                    src={webhookConfigGuide}
                    alt="Guia de configuração do webhook na Evolution API"
                    className="w-full"
                  />
                  <p className="text-xs text-center text-muted-foreground p-2 bg-muted">
                    Exemplo de como configurar o webhook no painel da Evolution API
                  </p>
                </div>

                {/* Eventos monitorados */}
                <div className="bg-muted/50 p-4 rounded-md space-y-2">
                  <h4 className="text-sm font-medium">📋 Eventos Monitorados pelo Webhook:</h4>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li>✅ <strong>messages.upsert / MESSAGES_UPSERT</strong> - Mensagens recebidas (respostas dos corretores)</li>
                    <li>✅ <strong>messages.update / MESSAGES_UPDATE</strong> - Atualização de status de mensagens</li>
                    <li>✅ <strong>connection.update / CONNECTION_UPDATE</strong> - Status de conexão da instância</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  WhatsApp Business API (Legacy)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp_token">Token da API</Label>
                  <Input
                    id="whatsapp_token"
                    type="password"
                    placeholder="Seu token do WhatsApp Business API"
                    defaultValue={getSetting('whatsapp_api_token')}
                    disabled={isSaving === 'whatsapp_api_token'}
                    onBlur={(e) => handleSaveSetting('whatsapp_api_token', e.target.value)}
                  />
                  {isSaving === 'whatsapp_api_token' && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp_phone_id">Phone Number ID</Label>
                  <Input
                    id="whatsapp_phone_id"
                    placeholder="ID do número de telefone"
                    defaultValue={getSetting('whatsapp_phone_id')}
                    disabled={isSaving === 'whatsapp_phone_id'}
                    onBlur={(e) => handleSaveSetting('whatsapp_phone_id', e.target.value)}
                  />
                  {isSaving === 'whatsapp_phone_id' && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  SMS Gateway
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sms_api_key">Chave da API SMS</Label>
                  <Input
                    id="sms_api_key"
                    type="password"
                    placeholder="Sua chave da API de SMS"
                    defaultValue={getSetting('sms_api_key')}
                    disabled={isSaving === 'sms_api_key'}
                    onBlur={(e) => handleSaveSetting('sms_api_key', e.target.value)}
                  />
                  {isSaving === 'sms_api_key' && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                </div>
              </CardContent>
            </Card>

            {/* FASE 3: Monitor de Webhook */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                <h2 className="text-xl font-semibold">Monitor de Webhooks</h2>
              </div>
              <WebhookMonitor />
            </div>
          </TabsContent>

          <TabsContent value="integracao" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Configurações de Email (SMTP)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp_host">Servidor SMTP</Label>
                    <Input
                      id="smtp_host"
                      placeholder="smtp.gmail.com"
                      defaultValue={getSetting('email_smtp_host')}
                      disabled={isSaving === 'email_smtp_host'}
                      onBlur={(e) => handleSaveSetting('email_smtp_host', e.target.value)}
                    />
                    {isSaving === 'email_smtp_host' && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_port">Porta</Label>
                    <Input
                      id="smtp_port"
                      placeholder="587"
                      defaultValue={getSetting('email_smtp_port')}
                      disabled={isSaving === 'email_smtp_port'}
                      onBlur={(e) => handleSaveSetting('email_smtp_port', e.target.value)}
                    />
                    {isSaving === 'email_smtp_port' && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp_user">Usuário SMTP</Label>
                  <Input
                    id="smtp_user"
                    type="email"
                    placeholder="seu-email@gmail.com"
                    defaultValue={getSetting('email_smtp_user')}
                    disabled={isSaving === 'email_smtp_user'}
                    onBlur={(e) => handleSaveSetting('email_smtp_user', e.target.value)}
                  />
                  {isSaving === 'email_smtp_user' && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp_password">Senha SMTP</Label>
                  <Input
                    id="smtp_password"
                    type="password"
                    placeholder="Sua senha ou app password"
                    defaultValue={getSetting('email_smtp_password')}
                    disabled={isSaving === 'email_smtp_password'}
                    onBlur={(e) => handleSaveSetting('email_smtp_password', e.target.value)}
                  />
                  {isSaving === 'email_smtp_password' && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Backup e Restore
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="backup_frequency">Frequência de Backup</Label>
                  <select
                    id="backup_frequency"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    defaultValue={getSetting('backup_frequency')}
                    onChange={(e) => handleSaveSetting('backup_frequency', e.target.value)}
                  >
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <Separator />
                <div className="flex gap-4">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Fazer Backup Agora
                  </Button>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Restaurar Backup
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informações do Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Versão do Sistema:</span>
                    <span>1.0.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Último Backup:</span>
                    <span>Hoje às 03:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Espaço Utilizado:</span>
                    <span>2.4 GB / 10 GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Uptime:</span>
                    <span>99.9%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automacao" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Distribuição Automática de Leads
                </CardTitle>
                <CardDescription>
                  Configure as regras de distribuição automática de leads para corretores
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Configurações de Distribuição */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Configurações Gerais</h4>
                    <div className="space-y-2">
                      <Label htmlFor="timeout_minutes">Tempo limite (minutos)</Label>
                      <Input
                        id="timeout_minutes"
                        type="number"
                        min="1"
                        max="60"
                        defaultValue={getSetting('distribution_timeout_minutes')}
                        disabled={isSaving === 'distribution_timeout_minutes'}
                        onBlur={(e) => handleSaveSetting('distribution_timeout_minutes', e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Tempo que o corretor tem para responder
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_attempts">Máximo de tentativas</Label>
                      <Input
                        id="max_attempts"
                        type="number"
                        min="1"
                        max="10"
                        defaultValue={getSetting('distribution_max_attempts')}
                        disabled={isSaving === 'distribution_max_attempts'}
                        onBlur={(e) => handleSaveSetting('distribution_max_attempts', e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Quantos corretores tentar antes de notificar admin
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin_whatsapp">WhatsApp do Administrador</Label>
                      <Input
                        id="admin_whatsapp"
                        placeholder="+5585999999999"
                        defaultValue={getSetting('admin_whatsapp')}
                        disabled={isSaving === 'admin_whatsapp'}
                        onBlur={(e) => handleSaveSetting('admin_whatsapp', e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Para notificações de falhas na distribuição
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Status do Sistema</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Distribuição Automática</Label>
                          <p className="text-xs text-muted-foreground">
                            Ativar distribuição automática de leads
                          </p>
                        </div>
                        <Switch
                          checked={getSetting('auto_distribution_enabled') === 'true'}
                          disabled={isSaving === 'auto_distribution_enabled'}
                          onCheckedChange={(checked) => handleSwitchChange('auto_distribution_enabled', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Via WhatsApp</Label>
                          <p className="text-xs text-muted-foreground">
                            Usar WhatsApp para notificações
                          </p>
                        </div>
                        <Switch
                          checked={getSetting('whatsapp_distribution_enabled') === 'true'}
                          disabled={isSaving === 'whatsapp_distribution_enabled'}
                          onCheckedChange={(checked) => handleSwitchChange('whatsapp_distribution_enabled', checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* API Oficial do WhatsApp como Fallback */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">WhatsApp Business API (Fallback)</h4>
                  <p className="text-sm text-muted-foreground">
                    Configurações da API Oficial para usar como backup quando a Evolution API não estiver disponível
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp_official_token">Token da API Oficial</Label>
                      <Input
                        id="whatsapp_official_token"
                        type="password"
                        placeholder="Token da Meta Business API"
                        defaultValue={getSetting('whatsapp_official_token')}
                        disabled={isSaving === 'whatsapp_official_token'}
                        onBlur={(e) => handleSaveSetting('whatsapp_official_token', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp_phone_number_id">ID do Número</Label>
                      <Input
                        id="whatsapp_phone_number_id"
                        placeholder="ID do número do WhatsApp Business"
                        defaultValue={getSetting('whatsapp_phone_number_id')}
                        disabled={isSaving === 'whatsapp_phone_number_id'}
                        onBlur={(e) => handleSaveSetting('whatsapp_phone_number_id', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Monitor de Distribuição */}
                <DistributionMonitor />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automacao-visitas" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <VisitDistributionSettings />
              <VisitDistributionMonitor />
            </div>
          </TabsContent>

          <TabsContent value="financeiro" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Comissões e Impostos
                </CardTitle>
                <CardDescription>
                  Configure os valores padrão para cálculo de comissões de vendas.
                  Esses valores são pré-preenchidos ao criar uma nova venda, mas podem ser ajustados individualmente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="default_commission_percentage">Comissão Padrão (%)</Label>
                    <Input
                      id="default_commission_percentage"
                      type="number"
                      step="0.1"
                      placeholder="6.0"
                      defaultValue={getSetting('default_commission_percentage')}
                      disabled={isSaving === 'default_commission_percentage'}
                      onBlur={(e) => handleSaveSetting('default_commission_percentage', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentual de comissão sobre o valor do imóvel
                    </p>
                    {isSaving === 'default_commission_percentage' && <Loader2 className="w-4 h-4 animate-spin" />}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_rate_percentage">Alíquota de Imposto (%)</Label>
                    <Input
                      id="tax_rate_percentage"
                      type="number"
                      step="0.1"
                      placeholder="20.0"
                      defaultValue={getSetting('tax_rate_percentage')}
                      disabled={isSaving === 'tax_rate_percentage'}
                      onBlur={(e) => handleSaveSetting('tax_rate_percentage', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Imposto descontado da comissão bruta antes da divisão
                    </p>
                    {isSaving === 'tax_rate_percentage' && <Loader2 className="w-4 h-4 animate-spin" />}
                  </div>
                </div>

                <Separator />

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Como funciona o cálculo:</strong>
                    <br />
                    Valor do Imóvel × Comissão (%) = Comissão Bruta
                    <br />
                    Comissão Bruta - Imposto (%) = Comissão Líquida
                    <br />
                    Comissão Líquida ÷ 2 = Corretor (50%) + MeMude (50%)
                    <br />
                    <span className="text-xs text-muted-foreground mt-1 block">
                      Em vendas diretas, 100% da comissão líquida vai para a MeMude.
                    </span>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
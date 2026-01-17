import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  Globe, 
  Clock, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Info
} from "lucide-react";

interface WordPressConfig {
  site_url: string;
  sync_enabled: boolean;
  sync_interval_hours: number;
  last_sync: string | null;
  auto_sync: boolean;
  posts_per_batch: number;
}

export function WordPressSettings() {
  const [config, setConfig] = useState<WordPressConfig>({
    site_url: 'https://memude.com.br',
    sync_enabled: true,
    sync_interval_hours: 24,
    last_sync: null,
    auto_sync: true,
    posts_per_batch: 50
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error' | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setIsLoading(true);
      
      // Load from system_settings table
      const { data: settings, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'wp_site_url',
          'wp_sync_enabled', 
          'wp_sync_interval_hours',
          'wp_last_sync',
          'wp_auto_sync',
          'wp_posts_per_batch'
        ]);

      if (error) throw error;

      // Convert settings array to config object
      const configObj = settings?.reduce((acc: any, setting) => {
        const key = setting.key.replace('wp_', '');
        let value: any = setting.value;
        
        // Type conversions
        if (key === 'sync_enabled' || key === 'auto_sync') {
          value = value === 'true';
        } else if (key === 'sync_interval_hours' || key === 'posts_per_batch') {
          value = parseInt(value) || (key === 'posts_per_batch' ? 50 : 24);
        }
        
        acc[key] = value;
        return acc;
      }, {}) || {};

      setConfig(prev => ({ ...prev, ...configObj }));
      
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfiguration = async () => {
    try {
      setIsSaving(true);
      
      // Convert config to settings format
      const settingsToUpdate = [
        { key: 'wp_site_url', value: config.site_url },
        { key: 'wp_sync_enabled', value: config.sync_enabled.toString() },
        { key: 'wp_sync_interval_hours', value: config.sync_interval_hours.toString() },
        { key: 'wp_auto_sync', value: config.auto_sync.toString() },
        { key: 'wp_posts_per_batch', value: config.posts_per_batch.toString() }
      ];

      // Upsert each setting
      for (const setting of settingsToUpdate) {
        const { error } = await supabase
          .from('system_settings')
          .upsert({
            key: setting.key,
            value: setting.value,
            description: `WordPress ${setting.key.replace('wp_', '').replace('_', ' ')}`
          }, {
            onConflict: 'key'
          });
          
        if (error) throw error;
      }
      
      toast({
        title: "Configurações salvas",
        description: "As configurações do WordPress foram atualizadas com sucesso"
      });
      
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    try {
      setConnectionStatus('testing');
      
      const { data, error } = await supabase.functions.invoke('sync-wordpress-properties', {
        body: { 
          manual: true,
          test_mode: true,
          limit: 3
        }
      });

      if (error) throw error;

      if (data.success) {
        setConnectionStatus('success');
        toast({
          title: "Conexão bem-sucedida",
          description: `Encontrados ${data.totalPostsFetched} posts no site`
        });
      } else {
        setConnectionStatus('error');
        toast({
          title: "Falha na conexão",
          description: data.error || "Erro desconhecido",
          variant: "destructive"
        });
      }
      
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: "Erro no teste",
        description: error.message || "Falha ao testar conexão",
        variant: "destructive"
      });
    }
  };

  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case 'testing':
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Testando...</Badge>;
      case 'success':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Conectado</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Erro</Badge>;
      default:
        return <Badge variant="outline"><Info className="w-3 h-3 mr-1" />Não testado</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Carregando configurações...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configurações do WordPress
          </CardTitle>
          <CardDescription>
            Configure a integração com o site memude.com.br
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Site URL */}
          <div className="space-y-2">
            <Label htmlFor="site_url" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              URL do Site
            </Label>
            <div className="flex gap-2">
              <Input
                id="site_url"
                value={config.site_url}
                onChange={(e) => setConfig(prev => ({ ...prev, site_url: e.target.value }))}
                placeholder="https://memude.com.br"
              />
              <Button 
                variant="outline" 
                onClick={testConnection}
                disabled={connectionStatus === 'testing'}
              >
                Testar
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              {getConnectionBadge()}
            </div>
          </div>

          {/* Sync Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sync_interval" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Intervalo de Sincronização (horas)
              </Label>
              <Input
                id="sync_interval"
                type="number"
                min="1"
                max="168"
                value={config.sync_interval_hours}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  sync_interval_hours: parseInt(e.target.value) || 24 
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="posts_per_batch">Posts por Lote</Label>
              <Input
                id="posts_per_batch"
                type="number"
                min="10"
                max="100"
                value={config.posts_per_batch}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  posts_per_batch: parseInt(e.target.value) || 50 
                }))}
              />
            </div>
          </div>

          {/* Toggle Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sync_enabled">Sincronização Ativa</Label>
                <p className="text-sm text-muted-foreground">
                  Permite que o sistema sincronize dados automaticamente
                </p>
              </div>
              <Switch
                id="sync_enabled"
                checked={config.sync_enabled}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, sync_enabled: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto_sync">Sincronização Automática</Label>
                <p className="text-sm text-muted-foreground">
                  Executa sincronização nos horários programados
                </p>
              </div>
              <Switch
                id="auto_sync"
                checked={config.auto_sync}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, auto_sync: checked }))}
              />
            </div>
          </div>

          {/* Status Information */}
          {config.last_sync && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Última sincronização: {new Date(config.last_sync).toLocaleString('pt-BR')}
              </AlertDescription>
            </Alert>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={saveConfiguration}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Configurações'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
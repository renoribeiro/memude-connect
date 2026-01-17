import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, AlertTriangle, Clock, RefreshCw } from "lucide-react";

export function SyncStatusIndicator() {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'success' | 'error' | 'pending'>('pending');

  useEffect(() => {
    loadLastSync();
  }, []);

  const loadLastSync = async () => {
    try {
      const { data } = await supabase
        .from('wp_sync_log')
        .select('sync_date, status')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setLastSync(data.sync_date);
        setSyncStatus(data.status === 'success' ? 'success' : 'error');
      }
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    }
  };

  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <Alert>
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <AlertDescription>
          {lastSync ? (
            <>
              Última sincronização: {new Date(lastSync).toLocaleString('pt-BR')}
              <Badge variant={syncStatus === 'success' ? 'default' : 'destructive'} className="ml-2">
                {syncStatus === 'success' ? 'Sucesso' : 'Com erros'}
              </Badge>
            </>
          ) : (
            'Nenhuma sincronização executada ainda'
          )}
        </AlertDescription>
      </div>
    </Alert>
  );
}
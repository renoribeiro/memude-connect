import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TestTube, Send, Loader2, MessageSquare, Users, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useValidations } from "@/hooks/useValidations";
import { withEdgeFunctionRetry, withSupabaseRetry } from "@/lib/retryLogic";
import { useQuery } from "@tanstack/react-query";

interface Lead {
  id: string;
  nome: string;
  telefone: string;
  empreendimentos: {
    nome: string;
  };
}

export const DistributionTester = () => {
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("🏠 *TESTE DE DISTRIBUIÇÃO MEMUDE*\n\nEsta é uma mensagem de teste do sistema de distribuição automática.\n\nPara aceitar, responda: *SIM*\nPara recusar, responda: *NÃO*\n\n⏰ Teste realizado em " + new Date().toLocaleString('pt-BR'));
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [isTestingDistribution, setIsTestingDistribution] = useState(false);
  const [isCheckingTimeouts, setIsCheckingTimeouts] = useState(false);
  
  const { validateWhatsappMessage, sanitizePhoneNumber } = useValidations();

  // Buscar leads não atribuídos para teste
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['unassigned-leads-test'],
    queryFn: async () => {
      const result = await withSupabaseRetry(async () => {
        return await supabase
          .from('leads')
          .select(`
            id,
            nome,
            telefone,
            empreendimentos!inner(nome)
          `)
          .is('corretor_designado_id', null)
          .order('created_at', { ascending: false })
          .limit(15);
      });
      
      if (!result.success) {
        throw result.error;
      }
      
      return result.data || [];
    },
    refetchInterval: 30000
  });

  const handleTestWhatsApp = async () => {
    try {
      // Validar entrada usando o hook de validações
      const sanitizedPhone = sanitizePhoneNumber(testPhone);
      validateWhatsappMessage({
        phone_number: sanitizedPhone,
        message: testMessage
      });

      setIsTestingWhatsApp(true);

      const result = await withEdgeFunctionRetry(async () => {
        return await supabase.functions.invoke('evolution-send-whatsapp-v2', {
          body: {
            phone: sanitizedPhone,
            text: testMessage,
            metadata: {
              type: 'test_message',
              lead_id: selectedLeadId || null
            }
          }
        });
      });

      if (!result.success) {
        throw result.error;
      }

      toast({
        title: "WhatsApp Enviado!",
        description: `Mensagem enviada com sucesso. ID: ${result.data?.key?.id || 'N/A'}`,
      });
      
      // Limpar campos após sucesso
      setTestPhone("");
      setTestMessage("🏠 *TESTE DE DISTRIBUIÇÃO MEMUDE*\n\nEsta é uma mensagem de teste do sistema de distribuição automática.\n\nPara aceitar, responda: *SIM*\nPara recusar, responda: *NÃO*\n\n⏰ Teste realizado em " + new Date().toLocaleString('pt-BR'));
      
    } catch (error) {
      console.error('Erro ao testar WhatsApp:', error);
      toast({
        title: "Erro no WhatsApp",
        description: error.message || "Erro ao enviar mensagem de teste",
        variant: "destructive"
      });
    } finally {
      setIsTestingWhatsApp(false);
    }
  };

  const handleTestDistribution = async () => {
    if (!selectedLeadId.trim()) {
      toast({
        title: "Erro",
        description: "ID do Lead é obrigatório para teste de distribuição",
        variant: "destructive"
      });
      return;
    }

    setIsTestingDistribution(true);

    try {
      const result = await withEdgeFunctionRetry(async () => {
        return await supabase.functions.invoke('distribute-lead', {
          body: { lead_id: selectedLeadId.trim() }
        });
      });

      if (!result.success) {
        throw result.error;
      }

      toast({
        title: "Distribuição Iniciada!",
        description: `Lead adicionado à fila de distribuição. ${result.data?.eligible_corretores || 0} corretor(es) elegível(is) encontrado(s).`,
      });
      
      // Limpar seleção após sucesso
      setSelectedLeadId("");
      
    } catch (error) {
      console.error('Erro ao testar distribuição:', error);
      toast({
        title: "Erro na Distribuição",
        description: error.message || "Erro ao iniciar distribuição de teste",
        variant: "destructive"
      });
    } finally {
      setIsTestingDistribution(false);
    }
  };

  const handleCheckTimeouts = async () => {
    setIsCheckingTimeouts(true);

    try {
      const result = await withEdgeFunctionRetry(async () => {
        return await supabase.functions.invoke('distribution-timeout-checker', {
          body: { manual_check: true }
        });
      });

      if (!result.success) {
        throw result.error;
      }

      toast({
        title: "Verificação Concluída!",
        description: `${result.data?.processed || 0} timeout(s) processado(s) e ${result.data?.redistributed || 0} lead(s) redistribuído(s).`,
      });
      
    } catch (error) {
      console.error('Erro ao verificar timeouts:', error);
      toast({
        title: "Erro na Verificação",
        description: error.message || "Erro ao verificar timeouts",
        variant: "destructive"
      });
    } finally {
      setIsCheckingTimeouts(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TestTube className="w-5 h-5" />
        <h3 className="text-lg font-medium">Centro de Testes</h3>
        <Badge variant="outline" className="text-xs">Sistema de Distribuição</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teste de WhatsApp */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 w-5" />
              Teste de WhatsApp
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Teste o envio direto de mensagens WhatsApp
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-phone">Número de Telefone</Label>
              <Input
                id="test-phone"
                placeholder="+5585999999999 ou 85999999999"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                disabled={isTestingWhatsApp}
              />
              <p className="text-xs text-muted-foreground">
                Formato aceito: +5585999999999, 85999999999 ou (85) 99999-9999
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="test-message">Mensagem de Teste</Label>
              <Textarea
                id="test-message"
                placeholder="Digite sua mensagem de teste..."
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                disabled={isTestingWhatsApp}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Máximo: 4.096 caracteres
              </p>
            </div>
            
            <Button 
              onClick={handleTestWhatsApp}
              disabled={isTestingWhatsApp || !testPhone || !testMessage}
              className="w-full"
            >
              {isTestingWhatsApp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Teste WhatsApp
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Teste de Distribuição */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 w-5" />
              Teste de Distribuição
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Teste a distribuição automática com um lead real
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lead-select">Selecionar Lead</Label>
              <Select 
                value={selectedLeadId} 
                onValueChange={setSelectedLeadId}
                disabled={isTestingDistribution || leadsLoading}
              >
                <SelectTrigger>
                  <SelectValue 
                    placeholder={leadsLoading ? "Carregando leads..." : "Escolha um lead não atribuído"} 
                  />
                </SelectTrigger>
                <SelectContent>
                  {leadsLoading ? (
                    <SelectItem value="loading" disabled>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Carregando...
                    </SelectItem>
                  ) : leads.length === 0 ? (
                    <SelectItem value="no_leads" disabled>
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Nenhum lead disponível
                    </SelectItem>
                  ) : (
                    leads.map((lead: Lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{lead.nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {lead.empreendimentos.nome} • {lead.telefone}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {leads.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {leads.length} lead(s) disponível(is) para teste
                </p>
              )}
            </div>
            
            <Button 
              onClick={handleTestDistribution}
              disabled={isTestingDistribution || !selectedLeadId}
              className="w-full"
            >
              {isTestingDistribution ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Distribuindo...
                </>
              ) : (
                <>
                  <Users className="mr-2 h-4 w-4" />
                  Iniciar Distribuição
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Ferramentas de Monitoramento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 w-5" />
            Ferramentas de Monitoramento
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Verificações manuais e ferramentas de diagnóstico
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              variant="outline"
              onClick={handleCheckTimeouts}
              disabled={isCheckingTimeouts}
              className="h-auto p-4 flex flex-col items-start gap-2"
            >
              {isCheckingTimeouts ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <div className="text-left">
                <div className="font-medium">Verificar Timeouts</div>
                <div className="text-xs text-muted-foreground">
                  Force a verificação de tentativas expiradas
                </div>
              </div>
            </Button>

            <Button 
              variant="outline"
              onClick={() => window.location.reload()}
              className="h-auto p-4 flex flex-col items-start gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Atualizar Monitor</div>
                <div className="text-xs text-muted-foreground">
                  Recarrega dados do monitor de distribuição
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status das APIs */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm">Status dos Serviços</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <div className="w-2 h-2 bg-green-500 rounded-full mx-auto"></div>
              <p className="text-xs font-medium">Edge Functions</p>
              <p className="text-xs text-muted-foreground">Ativo</p>
            </div>
            <div className="space-y-1">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mx-auto"></div>
              <p className="text-xs font-medium">WhatsApp API</p>
              <p className="text-xs text-muted-foreground">Configurável</p>
            </div>
            <div className="space-y-1">
              <div className="w-2 h-2 bg-green-500 rounded-full mx-auto"></div>
              <p className="text-xs font-medium">Distribuição</p>
              <p className="text-xs text-muted-foreground">Ativo</p>
            </div>
            <div className="space-y-1">
              <div className="w-2 h-2 bg-green-500 rounded-full mx-auto"></div>
              <p className="text-xs font-medium">Cron Jobs</p>
              <p className="text-xs text-muted-foreground">Ativo</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
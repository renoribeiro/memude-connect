import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PhoneVerificationProps {
  phoneNumber: string;
  size?: "sm" | "default";
}

export function PhoneVerification({ phoneNumber, size = "sm" }: PhoneVerificationProps) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{
    exists: boolean;
    cached?: boolean;
  } | null>(null);
  const { toast } = useToast();

  const handleVerify = async () => {
    if (!phoneNumber) {
      toast({
        title: "Número não informado",
        description: "Por favor, preencha o número de telefone primeiro.",
        variant: "destructive",
      });
      return;
    }

    setVerifying(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('evolution-check-number', {
        body: { phone_number: phoneNumber }
      });

      if (error) throw error;

      setResult({
        exists: data.exists,
        cached: data.cached
      });

      if (data.exists) {
        toast({
          title: "✅ Número verificado",
          description: "Este número está ativo no WhatsApp.",
        });
      } else {
        toast({
          title: "⚠️ Número não encontrado",
          description: "Este número não está registrado no WhatsApp.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Erro ao verificar número:', error);
      toast({
        title: "Erro na verificação",
        description: error.message || "Não foi possível verificar o número.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={handleVerify}
        disabled={verifying || !phoneNumber}
      >
        {verifying ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Verificando...
          </>
        ) : (
          <>
            <Smartphone className="mr-2 h-3 w-3" />
            Verificar WhatsApp
          </>
        )}
      </Button>

      {result && (
        <Badge 
          variant={result.exists ? "default" : "destructive"}
          className={result.exists ? "bg-green-500" : ""}
        >
          {result.exists ? (
            <>
              <CheckCircle className="mr-1 h-3 w-3" />
              Ativo no WhatsApp
            </>
          ) : (
            <>
              <XCircle className="mr-1 h-3 w-3" />
              Não encontrado
            </>
          )}
          {result.cached && " (cache)"}
        </Badge>
      )}
    </div>
  );
}

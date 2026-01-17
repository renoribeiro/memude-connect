import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, Download, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'import' | 'export';
}

export default function ImportExportModal({ open, onOpenChange, type }: ImportExportModalProps) {
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [range, setRange] = useState("Sheet1!A:Z");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!spreadsheetId.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira o ID da planilha do Google Sheets",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('google-sheets-sync', {
        body: {
          action: type,
          spreadsheetId: spreadsheetId.trim(),
          range: range.trim() || "Sheet1!A:Z"
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      setResult(data);
      
      if (data.success) {
        toast({
          title: "Sucesso!",
          description: data.message,
        });
        
        // Refresh the page data after successful import/export
        window.location.reload();
      } else {
        throw new Error(data.error || "Operação falhou");
      }
    } catch (error: any) {
      console.error(`Error in ${type}:`, error);
      toast({
        title: "Erro",
        description: error.message || `Erro ao ${type === 'import' ? 'importar' : 'exportar'} dados`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const extractSpreadsheetId = (url: string) => {
    // Extract spreadsheet ID from Google Sheets URL
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
  };

  const handleUrlChange = (value: string) => {
    const id = extractSpreadsheetId(value);
    setSpreadsheetId(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2">
            {type === 'import' ? <Upload className="h-5 w-5" /> : <Download className="h-5 w-5" />}
            {type === 'import' ? 'Importar' : 'Exportar'} corretores do Google Sheets
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Form Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="spreadsheetUrl" className="text-sm font-medium">
                  URL ou ID da Planilha do Google Sheets
                </Label>
                <Input
                  id="spreadsheetUrl"
                  placeholder="https://docs.google.com/spreadsheets/d/1ABC123... ou 1ABC123..."
                  value={spreadsheetId}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  disabled={loading}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Cole a URL completa ou apenas o ID da planilha
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="range" className="text-sm font-medium">Intervalo (Range)</Label>
                <Input
                  id="range"
                  placeholder="Sheet1!A:Z"
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  disabled={loading}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Especifique o intervalo da planilha (ex: Sheet1!A:Z, Planilha1!A1:G100)
                </p>
              </div>

              {type === 'import' && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Importante:</strong> Para novos corretores, será criada uma conta temporária. 
                    Eles receberão um email com instruções para definir a senha.
                  </AlertDescription>
                </Alert>
              )}

              {result && (
                <div className="rounded-lg border p-3 bg-muted/50">
                  <h4 className="font-medium mb-2 text-sm">Resultado da Operação:</h4>
                  <div className="text-xs space-y-1">
                    {type === 'import' && (
                      <div className="grid grid-cols-3 gap-2">
                        <span>✅ Importados: {result.imported || 0}</span>
                        <span>🔄 Atualizados: {result.updated || 0}</span>
                        <span>❌ Erros: {result.errors || 0}</span>
                      </div>
                    )}
                    {type === 'export' && (
                      <p>✅ Exportados: {result.exported || 0} corretores</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Column Instructions */}
            {type === 'import' && (
              <div className="space-y-3">
                <Alert>
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-3">
                      <p className="text-sm font-medium">As 13 colunas devem estar nesta ordem:</p>
                      <div className="text-xs bg-muted/80 p-3 rounded-md">
                        <div className="grid grid-cols-1 gap-y-1.5">
                          <div className="grid grid-cols-2 gap-x-3">
                            <span>1. Nome Completo <span className="text-red-500">*</span></span>
                            <span>8. Bairros <span className="text-gray-500">(vírgula)</span></span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3">
                            <span>2. CPF</span>
                            <span>9. Tipo Imóvel <span className="text-red-500">*</span></span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3">
                            <span>3. Telefone <span className="text-red-500">*</span></span>
                            <span>10. Construtora <span className="text-gray-500">(vírgula)</span></span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3">
                            <span>4. Email</span>
                            <span>11. Status <span className="text-red-500">*</span></span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3">
                            <span>5. CRECI <span className="text-red-500">*</span></span>
                            <span>12. Visitas Realizadas <span className="text-blue-500">†</span></span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3">
                            <span>6. Cidade <span className="text-red-500">*</span></span>
                            <span>13. Visitas Agendadas <span className="text-blue-500">†</span></span>
                          </div>
                          <div className="grid grid-cols-1">
                            <span>7. Estado <span className="text-red-500">*</span></span>
                          </div>
                        </div>
                        
                        <div className="mt-3 pt-2 border-t border-muted-foreground/20">
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span><span className="text-red-500">*</span> Obrigatório</span>
                            <span><span className="text-blue-500">†</span> Calculado automaticamente</span>
                            <span><span className="text-gray-500">(vírgula)</span> Múltiplos valores</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground bg-info/5 p-2 rounded border-l-2 border-info">
                        <strong>Valores válidos:</strong><br/>
                        • Estado: CE, SP, RJ, etc.<br/>
                        • Tipo: todos, apartamento, casa, comercial<br/>
                        • Status: ativo, inativo, em_avaliacao
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {type === 'export' && (
              <div className="flex items-center justify-center">
                <Alert>
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Exporte todos os corretores para Google Sheets com as 13 colunas no formato padrão.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="min-w-[100px]"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !spreadsheetId.trim()}
              className="min-w-[120px]"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {type === 'import' ? 'Importar' : 'Exportar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState } from "react";
import { Search, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTemplateVariables } from "@/hooks/useTemplates";
import { Skeleton } from "@/components/ui/skeleton";

interface VariableSelectorProps {
  onVariableSelect: (variableName: string) => void;
}

export const VariableSelector: React.FC<VariableSelectorProps> = ({
  onVariableSelect
}) => {
  const [search, setSearch] = useState("");
  const { data: variables = [], isLoading } = useTemplateVariables();

  if (isLoading) {
    return <Skeleton className="h-32" />;
  }

  // Filtrar variáveis por busca
  const filteredVariables = variables.filter(variable =>
    variable.name.toLowerCase().includes(search.toLowerCase()) ||
    variable.description.toLowerCase().includes(search.toLowerCase())
  );

  // Agrupar por categoria
  const groupedVariables = filteredVariables.reduce((groups, variable) => {
    const category = variable.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(variable);
    return groups;
  }, {} as Record<string, typeof variables>);

  const categoryLabels: Record<string, string> = {
    lead: "🧑‍💼 Dados do Lead",
    empreendimento: "🏢 Empreendimento",
    corretor: "👨‍💼 Corretor",
    sistema: "⚙️ Sistema",
    visita: "📅 Visita"
  };

  const handleVariableClick = (variableName: string) => {
    // Remove as chaves do nome da variável ao inserir
    const cleanName = variableName.replace(/[{}]/g, '');
    onVariableSelect(cleanName);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="font-medium">Inserir Variável</h4>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar variáveis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-4">
        {Object.entries(groupedVariables).map(([category, categoryVariables]) => (
          <div key={category} className="space-y-2">
            <h5 className="text-sm font-medium text-muted-foreground">
              {categoryLabels[category] || category}
            </h5>
            <div className="grid grid-cols-1 gap-2">
              {categoryVariables.map((variable) => (
                <div
                  key={variable.id}
                  className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">
                        {variable.name}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {variable.data_type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {variable.description}
                    </p>
                    {variable.default_value && (
                      <p className="text-xs text-green-600 mt-1">
                        Exemplo: {variable.default_value}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleVariableClick(variable.name)}
                    className="ml-2"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            {category !== Object.keys(groupedVariables)[Object.keys(groupedVariables).length - 1] && (
              <Separator />
            )}
          </div>
        ))}
      </div>

      {filteredVariables.length === 0 && (
        <div className="text-center py-6">
          <p className="text-muted-foreground">
            Nenhuma variável encontrada
          </p>
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded">
        <strong>Dica:</strong> Clique em uma variável para inseri-la no template. 
        As variáveis serão substituídas pelos dados reais quando a mensagem for enviada.
      </div>
    </div>
  );
};
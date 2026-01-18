import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, CheckCircle, XCircle, Zap, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EvolutionInstance {
    id: string;
    name: string;
    instance_name: string;
    api_url: string;
    api_token: string;
    is_active: boolean;
    created_at: string;
}

export function EvolutionInstances() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingInstance, setEditingInstance] = useState<EvolutionInstance | null>(null);
    const [testingConnection, setTestingConnection] = useState<string | null>(null);

    const { data: instances = [], isLoading } = useQuery({
        queryKey: ['evolution-instances'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('evolution_instances')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data as EvolutionInstance[];
        }
    });

    const saveMutation = useMutation({
        mutationFn: async (data: Partial<EvolutionInstance>) => {
            if (editingInstance) {
                const { error } = await supabase
                    .from('evolution_instances')
                    .update(data)
                    .eq('id', editingInstance.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('evolution_instances')
                    .insert([data as any]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['evolution-instances'] });
            setIsDialogOpen(false);
            setEditingInstance(null);
            toast({
                title: editingInstance ? "Instância atualizada" : "Instância criada",
                description: "As configurações foram salvas com sucesso.",
            });
        },
        onError: (error) => {
            toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('evolution_instances')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['evolution-instances'] });
            toast({
                title: "Instância removida",
                description: "A instância foi excluída com sucesso.",
            });
        }
    });

    const testConnection = async (instance: EvolutionInstance) => {
        setTestingConnection(instance.id);
        try {
            // Use the generic check connection function
            const { data, error } = await supabase.functions.invoke('evolution-check-connection', {
                body: {
                    instance_config: {
                        api_url: instance.api_url,
                        api_key: instance.api_token,
                        instance_name: instance.instance_name
                    }
                }
            });

            if (error) throw error;

            if (data.success && data.connected) {
                toast({
                    title: "✅ Conexão bem-sucedida",
                    description: `Instância "${instance.instance_name}" está online.`,
                });
            } else {
                throw new Error(data.error || "Não foi possível conectar");
            }
        } catch (error: any) {
            toast({
                title: "❌ Falha na conexão",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setTestingConnection(null);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-500" />
                            Instâncias Evolution API
                        </CardTitle>
                        <CardDescription>
                            Gerencie suas conexões com a Evolution API V2
                        </CardDescription>
                    </div>
                    <Button onClick={() => { setEditingInstance(null); setIsDialogOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Instância
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-4">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : instances.length === 0 ? (
                    <div className="text-center p-6 border border-dashed rounded-lg text-muted-foreground">
                        Nenhuma instância configurada. Adicione uma para começar.
                    </div>
                ) : (
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Instância (Evolution)</TableHead>
                                    <TableHead>URL</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {instances.map((instance) => (
                                    <TableRow key={instance.id}>
                                        <TableCell className="font-medium">{instance.name}</TableCell>
                                        <TableCell>{instance.instance_name}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs truncate max-w-[200px]" title={instance.api_url}>
                                            {instance.api_url}
                                        </TableCell>
                                        <TableCell>
                                            {instance.is_active ?
                                                <Badge variant="default" className="bg-green-600">Ativo</Badge> :
                                                <Badge variant="secondary">Inativo</Badge>
                                            }
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => testConnection(instance)}
                                                disabled={!!testingConnection}
                                                title="Testar Conexão"
                                            >
                                                {testingConnection === instance.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Zap className="w-4 h-4 text-blue-500" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => { setEditingInstance(instance); setIsDialogOpen(true); }}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    if (confirm('Tem certeza que deseja excluir esta instância?')) {
                                                        deleteMutation.mutate(instance.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingInstance ? 'Editar Instância' : 'Nova Instância'}</DialogTitle>
                            <DialogDescription>
                                Configure os dados de conexão da sua Evolution API V2.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            saveMutation.mutate({
                                name: formData.get('name') as string,
                                instance_name: formData.get('instance_name') as string,
                                api_url: formData.get('api_url') as string,
                                api_token: formData.get('api_token') as string,
                                is_active: formData.get('is_active') === 'on'
                            });
                        }}>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nome Identificador</Label>
                                    <Input id="name" name="name" placeholder="Ex: Produção Principal" defaultValue={editingInstance?.name} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="instance_name">Nome da Instância (Evolution)</Label>
                                    <Input id="instance_name" name="instance_name" placeholder="Ex: my-instance" defaultValue={editingInstance?.instance_name} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="api_url">URL da API</Label>
                                    <Input id="api_url" name="api_url" placeholder="https://api.evolution.com" defaultValue={editingInstance?.api_url} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="api_token">API Key (Global ou da Instância)</Label>
                                    <Input id="api_token" name="api_token" type="password" defaultValue={editingInstance?.api_token} required />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Switch id="is_active" name="is_active" defaultChecked={editingInstance ? editingInstance.is_active : true} />
                                    <Label htmlFor="is_active">Ativo</Label>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                <Button type="submit" disabled={saveMutation.isPending}>
                                    {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Salvar
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

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
import { Loader2, Plus, Pencil, Trash2, CheckCircle, XCircle, Zap, AlertTriangle, Info, RefreshCw, LogOut, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface EvolutionInstance {
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
    const [qrCodeData, setQrCodeData] = useState<string | null>(null);
    const [showQrModal, setShowQrModal] = useState(false);

    // Fetch instances
    const { data: instances = [], isLoading } = useQuery({
        queryKey: ['evolution-instances'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('evolution_instances')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as EvolutionInstance[];
        }
    });

    // Generic Manager Mutation
    const managerMutation = useMutation({
        mutationFn: async (payload: any) => {
            const { data, error } = await supabase.functions.invoke('evolution-manager', {
                body: payload
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.error || 'Erro na operação');
            return data.data;
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['evolution-instances'] });

            let message = "Operação realizada com sucesso";
            if (variables.action === 'create') message = "Instância criada com sucesso";
            if (variables.action === 'delete') message = "Instância removida com sucesso";
            if (variables.action === 'restart') message = "Instância reiniciada";
            if (variables.action === 'logout') message = "Sessão desconectada";

            if (variables.action === 'connect') {
                // Handle QR Code from Evolution V2 (base64 or code)
                const base64 = data?.base64 || data?.qrcode?.base64;
                if (base64) {
                    setQrCodeData(base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`);
                    setShowQrModal(true);
                } else if (data?.pairingCode) {
                    toast({ title: "Pairing Code", description: `Código: ${data.pairingCode}` });
                } else if (data?.instance?.state === 'open' || data?.state === 'open') {
                    toast({ title: "Já conectado", description: "Esta instância já está conectada." });
                }
            } else if (variables.action === 'connectionState') {
                const state = data?.instance?.state || data?.state || 'unknown';
                toast({
                    title: "Status da Conexão",
                    description: `Estado atual: ${state}`,
                    variant: state === 'open' ? 'default' : 'destructive'
                });
            } else {
                toast({ title: "Sucesso", description: message });
            }
        },
        onError: (error) => {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive"
            });
        },
        onSettled: () => {
            setTestingConnection(null);
        }
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { data, error } = await supabase.functions.invoke('evolution-manager', {
                body: { action: 'delete', instance_id: id }
            });
            if (error) throw error;
            if (!data.success) throw new Error(data.error);
            return data;
        },
        onSuccess: () => {
            toast({ title: "Sucesso", description: "Instância removida" });
            queryClient.invalidateQueries({ queryKey: ['evolution-instances'] });
        },
        onError: (error) => {
            toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        }
    });

    // Save (Create/Update based on DB only for update)
    const saveMutation = useMutation({
        mutationFn: async (formData: any) => {
            if (editingInstance) {
                // Update DB only
                const { error } = await supabase
                    .from('evolution_instances')
                    .update({
                        name: formData.name,
                        instance_name: formData.instance_name,
                        api_url: formData.api_url,
                        api_token: formData.api_token,
                        is_active: formData.is_active
                    })
                    .eq('id', editingInstance.id);
                if (error) throw error;
                return { action: 'update' };
            } else {
                // Create via Manager
                const payload = {
                    action: 'create',
                    payload: {
                        instanceName: formData.instance_name,
                        raw_url: formData.api_url,
                        raw_apikey: formData.api_token,
                        name: formData.name
                    }
                };
                const { data, error } = await supabase.functions.invoke('evolution-manager', {
                    body: payload
                });
                if (error) throw error;
                if (!data.success) throw new Error(data.error);
                return { action: 'create', ...data };
            }
        },
        onSuccess: (data) => {
            toast({ title: "Sucesso", description: data.action === 'create' ? "Instância criada" : "Instância atualizada" });
            setIsDialogOpen(false);
            setEditingInstance(null);
            queryClient.invalidateQueries({ queryKey: ['evolution-instances'] });
        },
        onError: (error) => {
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        }
    });

    const testConnection = (instance: EvolutionInstance) => {
        setTestingConnection(instance.id);
        managerMutation.mutate({
            action: 'connectionState',
            instance_id: instance.id
        });
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
                                                onClick={() => managerMutation.mutate({ action: 'connect', instance_id: instance.id })}
                                                title="Conectar (QR Code)"
                                            >
                                                <QrCode className="w-4 h-4 text-purple-500" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => testConnection(instance)}
                                                disabled={!!testingConnection}
                                                title="Verificar Conexão"
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
                                                title="Reiniciar"
                                                onClick={() => {
                                                    if (confirm('Reiniciar instância?')) {
                                                        managerMutation.mutate({ action: 'restart', instance_id: instance.id });
                                                    }
                                                }}
                                            >
                                                <RefreshCw className="w-4 h-4 text-orange-500" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Logout (Desconectar)"
                                                onClick={() => {
                                                    if (confirm('Desconectar e limpar sessão do WhatsApp?')) {
                                                        managerMutation.mutate({ action: 'logout', instance_id: instance.id });
                                                    }
                                                }}
                                            >
                                                <LogOut className="w-4 h-4 text-gray-500" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => { setEditingInstance(instance); setIsDialogOpen(true); }}
                                                title="Editar Configurações"
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
                                                title="Excluir Instância"
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

                {/* Dialog for Create/Edit */}
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

                {/* Dialog for QR Code */}
                <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Conectar WhatsApp</DialogTitle>
                            <DialogDescription>
                                Escaneie o QR Code abaixo com o seu WhatsApp para conectar.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex items-center justify-center p-6">
                            {qrCodeData ? (
                                <img src={qrCodeData} alt="QR Code" className="w-64 h-64 border rounded" />
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    <span className="text-sm text-muted-foreground">Carregando QR Code...</span>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setShowQrModal(false)}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </CardContent>
        </Card>
    );
}

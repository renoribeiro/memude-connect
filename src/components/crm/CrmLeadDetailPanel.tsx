import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Phone, Mail, Building2, User, Calendar, MapPin, Clock, FileText, DollarSign, FolderOpen, ExternalLink } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CrmLead, CrmStage } from '@/hooks/useCrmPipeline';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface CrmLeadDetailPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    crmLead: CrmLead | null;
    currentStage: CrmStage | null;
    pipelineId: string;
}

const statusLabels: Record<string, string> = {
    novo: 'Novo',
    buscando_corretor: 'Em Contato',
    visita_agendada: 'Agendado',
    visita_realizada: 'Visitou',
    cancelado: 'Perdido',
    follow_up: 'Follow-up',
};

export default function CrmLeadDetailPanel({
    open,
    onOpenChange,
    crmLead,
    currentStage,
    pipelineId,
}: CrmLeadDetailPanelProps) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [notas, setNotas] = useState('');
    const [valorEstimado, setValorEstimado] = useState('');
    const [googleDriveUrl, setGoogleDriveUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Sync state when crmLead changes
    const lead = crmLead?.leads;

    const handleOpen = (v: boolean) => {
        if (v && crmLead) {
            setNotas(crmLead.notas || '');
            setValorEstimado(crmLead.valor_estimado?.toString() || '');
            setGoogleDriveUrl(crmLead.google_drive_url || '');
        }
        onOpenChange(v);
    };

    const handleSave = async () => {
        if (!crmLead) return;
        setIsSaving(true);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase as any)
                .from('crm_leads')
                .update({
                    notas: notas || null,
                    valor_estimado: valorEstimado ? parseFloat(valorEstimado) : null,
                    google_drive_url: googleDriveUrl || null,
                })
                .eq('id', crmLead.id);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['crm-leads', pipelineId] });
            toast({ title: 'Dados do lead atualizados' });
        } catch {
            toast({ title: 'Erro ao salvar', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (!crmLead || !lead) return null;

    return (
        <Dialog open={open} onOpenChange={handleOpen}>
            <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg">{lead.nome}</DialogTitle>
                    <DialogDescription className="flex items-center gap-2">
                        {currentStage && (
                            <Badge
                                style={{ backgroundColor: currentStage.cor, color: '#fff' }}
                            >
                                {currentStage.nome}
                            </Badge>
                        )}
                        <Badge variant="outline">
                            {statusLabels[lead.status] || lead.status}
                        </Badge>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 mt-2">
                    {/* Contact Info */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Informações de Contato
                        </h4>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                {lead.telefone}
                            </div>
                            {lead.email && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                    {lead.email}
                                </div>
                            )}
                            {lead.empreendimentos && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    {lead.empreendimentos.nome}
                                </div>
                            )}
                            {lead.corretores && (
                                <div className="flex items-center gap-2 text-sm">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                    {lead.corretores.profiles.first_name}{' '}
                                    {lead.corretores.profiles.last_name}
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                Origem: {lead.origem}
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* CRM Info */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            No Funil
                        </h4>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                Na etapa: {formatDistanceToNow(new Date(crmLead.moved_at), {
                                    locale: ptBR,
                                    addSuffix: true,
                                })}
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                Adicionado: {format(new Date(crmLead.created_at), "dd/MM/yyyy 'às' HH:mm", {
                                    locale: ptBR,
                                })}
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Editable Fields */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Dados do Funil
                        </h4>
                        <div>
                            <Label htmlFor="crm-valor" className="flex items-center gap-1.5">
                                <DollarSign className="h-3.5 w-3.5" />
                                Valor Estimado (R$)
                            </Label>
                            <Input
                                id="crm-valor"
                                type="number"
                                value={valorEstimado}
                                onChange={(e) => setValorEstimado(e.target.value)}
                                placeholder="0,00"
                            />
                        </div>
                        <div>
                            <Label htmlFor="crm-drive" className="flex items-center gap-1.5">
                                <FolderOpen className="h-3.5 w-3.5" />
                                Pasta de Documentos (Google Drive)
                            </Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="crm-drive"
                                    type="url"
                                    value={googleDriveUrl}
                                    onChange={(e) => setGoogleDriveUrl(e.target.value)}
                                    placeholder="https://drive.google.com/drive/folders/..."
                                    className="flex-1"
                                />
                                {googleDriveUrl && (
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="shrink-0"
                                        onClick={() => window.open(googleDriveUrl, '_blank')}
                                        title="Abrir no Google Drive"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="crm-notas" className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5" />
                                Notas
                            </Label>
                            <Textarea
                                id="crm-notas"
                                value={notas}
                                onChange={(e) => setNotas(e.target.value)}
                                placeholder="Anotações sobre este lead no funil..."
                                rows={4}
                            />
                        </div>
                        <Button onClick={handleSave} disabled={isSaving} className="w-full">
                            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                    </div>

                    {/* Observações do Lead Original */}
                    {lead.observacoes && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Observações do Lead
                                </h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {lead.observacoes}
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Clock, Mail, X } from 'lucide-react';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
}

interface ScheduleReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ReportTemplate | null;
}

export function ScheduleReportModal({ open, onOpenChange, template }: ScheduleReportModalProps) {
  const [formData, setFormData] = useState({
    schedule_type: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'quarterly',
    recipients: [''],
    email_subject: '',
    email_message: '',
  });
  
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const scheduleReportMutation = useMutation({
    mutationFn: async (scheduleData: any) => {
      if (!template || !profile) throw new Error('Template ou perfil não encontrado');
      
      // Calculate next run date based on schedule type
      const now = new Date();
      let nextRun = new Date();
      
      switch (scheduleData.schedule_type) {
        case 'daily':
          nextRun.setDate(now.getDate() + 1);
          break;
        case 'weekly':
          nextRun.setDate(now.getDate() + 7);
          break;
        case 'monthly':
          nextRun.setMonth(now.getMonth() + 1);
          break;
        case 'quarterly':
          nextRun.setMonth(now.getMonth() + 3);
          break;
      }
      
      const { error } = await supabase
        .from('scheduled_reports')
        .insert({
          report_template_id: template.id,
          schedule_type: scheduleData.schedule_type,
          recipients: scheduleData.recipients.filter((email: string) => email.trim()),
          email_subject: scheduleData.email_subject || `Relatório ${template.name}`,
          email_message: scheduleData.email_message,
          next_run: nextRun.toISOString(),
          created_by: profile.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      toast({
        title: 'Relatório agendado',
        description: 'O relatório foi agendado com sucesso.',
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao agendar relatório',
        description: error.message || 'Não foi possível agendar o relatório.',
        variant: 'destructive',
      });
    }
  });

  const resetForm = () => {
    setFormData({
      schedule_type: 'monthly',
      recipients: [''],
      email_subject: '',
      email_message: '',
    });
  };

  const addRecipient = () => {
    setFormData(prev => ({
      ...prev,
      recipients: [...prev.recipients, '']
    }));
  };

  const updateRecipient = (index: number, email: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.map((recipient, i) => i === index ? email : recipient)
    }));
  };

  const removeRecipient = (index: number) => {
    if (formData.recipients.length > 1) {
      setFormData(prev => ({
        ...prev,
        recipients: prev.recipients.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validRecipients = formData.recipients.filter(email => email.trim() && email.includes('@'));
    if (validRecipients.length === 0) {
      toast({
        title: 'Destinatários obrigatórios',
        description: 'Adicione pelo menos um email válido.',
        variant: 'destructive',
      });
      return;
    }

    scheduleReportMutation.mutate({
      ...formData,
      recipients: validRecipients
    });
  };

  const getScheduleLabel = (type: string) => {
    switch (type) {
      case 'daily': return 'Diário';
      case 'weekly': return 'Semanal';
      case 'monthly': return 'Mensal';
      case 'quarterly': return 'Trimestral';
      default: return type;
    }
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Agendar Relatório
          </DialogTitle>
          <DialogDescription>
            Configure o envio automático do relatório "{template.name}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Schedule Type */}
          <div className="space-y-2">
            <Label htmlFor="schedule_type">Frequência de Envio</Label>
            <Select 
              value={formData.schedule_type} 
              onValueChange={(value: typeof formData.schedule_type) => 
                setFormData(prev => ({ ...prev, schedule_type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a frequência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Diário
                  </div>
                </SelectItem>
                <SelectItem value="weekly">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Semanal
                  </div>
                </SelectItem>
                <SelectItem value="monthly">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Mensal
                  </div>
                </SelectItem>
                <SelectItem value="quarterly">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Trimestral
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Próximo envio será {getScheduleLabel(formData.schedule_type).toLowerCase()}
            </p>
          </div>

          {/* Recipients */}
          <div className="space-y-2">
            <Label>Destinatários</Label>
            <div className="space-y-2">
              {formData.recipients.map((recipient, index) => (
                <div key={index} className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      className="pl-10"
                      value={recipient}
                      onChange={(e) => updateRecipient(index, e.target.value)}
                    />
                  </div>
                  {formData.recipients.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeRecipient(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRecipient}
              className="w-full"
            >
              + Adicionar Destinatário
            </Button>
          </div>

          {/* Email Subject */}
          <div className="space-y-2">
            <Label htmlFor="email_subject">Assunto do Email</Label>
            <Input
              id="email_subject"
              placeholder={`Relatório ${template.name}`}
              value={formData.email_subject}
              onChange={(e) => setFormData(prev => ({ ...prev, email_subject: e.target.value }))}
            />
          </div>

          {/* Email Message */}
          <div className="space-y-2">
            <Label htmlFor="email_message">Mensagem (Opcional)</Label>
            <Textarea
              id="email_message"
              placeholder="Adicione uma mensagem personalizada para acompanhar o relatório..."
              value={formData.email_message}
              onChange={(e) => setFormData(prev => ({ ...prev, email_message: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Summary */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Resumo do Agendamento</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Relatório:</span>
                <Badge variant="outline">{template.name}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Frequência:</span>
                <span>{getScheduleLabel(formData.schedule_type)}</span>
              </div>
              <div className="flex justify-between">
                <span>Destinatários:</span>
                <span>{formData.recipients.filter(email => email.trim()).length} email(s)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={scheduleReportMutation.isPending}
              className="min-w-[120px]"
            >
              {scheduleReportMutation.isPending ? 'Agendando...' : 'Agendar Relatório'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
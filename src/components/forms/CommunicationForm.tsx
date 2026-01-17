import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Phone, Mail, User, Users } from "lucide-react";
import { useState } from "react";

const communicationSchema = z.object({
  type: z.enum(['whatsapp', 'sms', 'email']),
  recipient_type: z.enum(['lead', 'corretor', 'broadcast']),
  recipient_id: z.string().optional(),
  phone_number: z.string().optional(),
  email: z.string().email().optional(),
  subject: z.string().optional(),
  content: z.string().min(1, "Conteúdo é obrigatório"),
  scheduled_at: z.string().optional(),
});

export type CommunicationFormData = z.infer<typeof communicationSchema>;

interface CommunicationFormProps {
  onSubmit: (data: CommunicationFormData) => void;
  isLoading?: boolean;
  leads: Array<{ id: string; nome: string; telefone: string; email?: string }>;
  corretores: Array<{ id: string; profiles: { first_name: string; last_name: string }; whatsapp: string }>;
}

export function CommunicationForm({ 
  onSubmit, 
  isLoading = false, 
  leads = [], 
  corretores = [] 
}: CommunicationFormProps) {
  const [selectedType, setSelectedType] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [recipientType, setRecipientType] = useState<'lead' | 'corretor' | 'broadcast'>('lead');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<CommunicationFormData>({
    resolver: zodResolver(communicationSchema),
    defaultValues: {
      type: 'whatsapp',
      recipient_type: 'lead',
    }
  });

  const watchType = watch('type');
  const watchRecipientType = watch('recipient_type');

  const handleTypeChange = (type: 'whatsapp' | 'sms' | 'email') => {
    setSelectedType(type);
    setValue('type', type);
  };

  const handleRecipientTypeChange = (type: 'lead' | 'corretor' | 'broadcast') => {
    setRecipientType(type);
    setValue('recipient_type', type);
    setValue('recipient_id', '');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4" />;
      case 'sms':
        return <Phone className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const templates = [
    {
      name: "Boas-vindas Lead",
      content: "Olá {nome}! Obrigado pelo seu interesse. Em breve um corretor entrará em contato."
    },
    {
      name: "Confirmação Visita",
      content: "Olá {nome}! Sua visita está confirmada para {data} às {horario}. Nos vemos lá!"
    },
    {
      name: "Lembrete Visita",
      content: "Olá {nome}! Lembrando da sua visita hoje às {horario}. Qualquer dúvida, estou à disposição."
    },
    {
      name: "Follow-up Pós-visita",
      content: "Olá {nome}! Como foi sua visita? Gostaria de saber sua opinião e se posso ajudar em algo mais."
    }
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Type Selection */}
      <div className="space-y-3">
        <Label>Tipo de Comunicação</Label>
        <div className="grid grid-cols-3 gap-2">
          {['whatsapp', 'sms', 'email'].map((type) => (
            <Button
              key={type}
              type="button"
              variant={selectedType === type ? 'default' : 'outline'}
              className="flex items-center gap-2"
              onClick={() => handleTypeChange(type as any)}
            >
              {getTypeIcon(type)}
              {type === 'whatsapp' ? 'WhatsApp' : type === 'sms' ? 'SMS' : 'Email'}
            </Button>
          ))}
        </div>
      </div>

      {/* Recipient Type */}
      <div className="space-y-2">
        <Label>Destinatário</Label>
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant={recipientType === 'lead' ? 'default' : 'outline'}
            className="flex items-center gap-2"
            onClick={() => handleRecipientTypeChange('lead')}
          >
            <User className="w-4 h-4" />
            Lead
          </Button>
          <Button
            type="button"
            variant={recipientType === 'corretor' ? 'default' : 'outline'}
            className="flex items-center gap-2"
            onClick={() => handleRecipientTypeChange('corretor')}
          >
            <User className="w-4 h-4" />
            Corretor
          </Button>
          <Button
            type="button"
            variant={recipientType === 'broadcast' ? 'default' : 'outline'}
            className="flex items-center gap-2"
            onClick={() => handleRecipientTypeChange('broadcast')}
          >
            <Users className="w-4 h-4" />
            Broadcast
          </Button>
        </div>
      </div>

      {/* Recipient Selection */}
      {recipientType !== 'broadcast' && (
        <div className="space-y-2">
          <Label htmlFor="recipient_id">
            {recipientType === 'lead' ? 'Selecionar Lead' : 'Selecionar Corretor'}
          </Label>
          <Select onValueChange={(value) => setValue('recipient_id', value)}>
            <SelectTrigger>
              <SelectValue placeholder={`Selecione um ${recipientType}`} />
            </SelectTrigger>
            <SelectContent>
              {recipientType === 'lead' 
                ? leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.nome} - {lead.telefone}
                    </SelectItem>
                  ))
                : corretores.map((corretor) => (
                    <SelectItem key={corretor.id} value={corretor.id}>
                      {corretor.profiles.first_name} {corretor.profiles.last_name}
                    </SelectItem>
                  ))
              }
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Manual Contact Info for Broadcast */}
      {recipientType === 'broadcast' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(selectedType === 'whatsapp' || selectedType === 'sms') && (
            <div className="space-y-2">
              <Label htmlFor="phone_number">Número de Telefone</Label>
              <Input
                {...register('phone_number')}
                placeholder="+55 85 99999-9999"
                className="w-full"
              />
              {errors.phone_number && (
                <p className="text-sm text-destructive">{errors.phone_number.message}</p>
              )}
            </div>
          )}
          
          {selectedType === 'email' && (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                {...register('email')}
                type="email"
                placeholder="email@exemplo.com"
                className="w-full"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Subject for Email */}
      {selectedType === 'email' && (
        <div className="space-y-2">
          <Label htmlFor="subject">Assunto</Label>
          <Input
            {...register('subject')}
            placeholder="Assunto do email"
            className="w-full"
          />
        </div>
      )}

      {/* Templates */}
      <div className="space-y-2">
        <Label>Templates Prontos</Label>
        <div className="grid grid-cols-2 gap-2">
          {templates.map((template) => (
            <Button
              key={template.name}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setValue('content', template.content)}
            >
              {template.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label htmlFor="content">Conteúdo da Mensagem</Label>
        <Textarea
          {...register('content')}
          placeholder="Digite sua mensagem aqui..."
          className="min-h-[120px]"
        />
        {errors.content && (
          <p className="text-sm text-destructive">{errors.content.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Use {"{nome}"}, {"{data}"}, {"{horario}"} para personalizar a mensagem
        </p>
      </div>

      {/* Schedule */}
      <div className="space-y-2">
        <Label htmlFor="scheduled_at">Agendar Envio (Opcional)</Label>
        <Input
          {...register('scheduled_at')}
          type="datetime-local"
          className="w-full"
        />
      </div>

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => reset()}
          disabled={isLoading}
        >
          Limpar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Enviando..." : "Enviar Comunicação"}
        </Button>
      </div>
    </form>
  );
}
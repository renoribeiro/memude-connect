import { useState, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Lock, UserCircle, Award } from 'lucide-react';

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserModal({ open, onOpenChange }: CreateUserModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'cliente' as 'admin' | 'corretor' | 'cliente',
    phone: '',
  });

  const [corretorData, setCorretorData] = useState({
    creci: '',
    cpf: '',
    whatsapp: '',
    cidade: '',
    estado: 'CE',
    tipo_imovel: 'todos',
    observacoes: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setCorretorData({
        creci: '',
        cpf: '',
        whatsapp: formData.phone || '',
        cidade: '',
        estado: 'CE',
        tipo_imovel: 'todos',
        observacoes: '',
      });
    }
  }, [open, formData.phone]);

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof formData) => {
      // 1. Create user via Edge Function
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: userData
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // 2. If role is 'corretor', insert professional details in corretores table
      if (userData.role === 'corretor' && data.user?.id) {
        // Wait briefly for trigger/profile insertion to complete and fetch the profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', data.user.id)
          .single();

        if (profile) {
          // Check if corretor record exists (it might due to our new trigger!)
          const { data: existingCorretor } = await supabase
            .from('corretores')
            .select('id')
            .eq('profile_id', profile.id)
            .maybeSingle();

          if (existingCorretor) {
            const { error: updateError } = await supabase
              .from('corretores')
              .update({
                creci: corretorData.creci,
                cpf: corretorData.cpf || null,
                whatsapp: corretorData.whatsapp || userData.phone || '',
                cidade: corretorData.cidade || null,
                estado: corretorData.estado || 'CE',
                tipo_imovel: corretorData.tipo_imovel || 'todos',
                observacoes: corretorData.observacoes || null,
              })
              .eq('id', existingCorretor.id);

            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase
              .from('corretores')
              .insert({
                profile_id: profile.id,
                creci: corretorData.creci,
                cpf: corretorData.cpf || null,
                whatsapp: corretorData.whatsapp || userData.phone || '',
                cidade: corretorData.cidade || null,
                estado: corretorData.estado || 'CE',
                tipo_imovel: corretorData.tipo_imovel || 'todos',
                observacoes: corretorData.observacoes || null,
                status: 'ativo',
                nota_media: 5.0,
                total_visitas: 0,
              });

            if (insertError) throw insertError;
          }
        }
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] });
      toast({
        title: 'Usuário criado',
        description: 'O usuário foi criado com sucesso e receberá um email de confirmação.',
      });
      onOpenChange(false);
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'cliente',
        phone: '',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar usuário',
        description: error.message || 'Não foi possível criar o usuário.',
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }
    createUserMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="w-5 h-5" />
            Criar Novo Usuário
          </DialogTitle>
          <DialogDescription>
            Crie um novo usuário no sistema. Um email de confirmação será enviado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nome *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="first_name"
                  placeholder="Nome"
                  className="pl-10"
                  value={formData.first_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Sobrenome *</Label>
              <Input
                id="last_name"
                placeholder="Sobrenome"
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                className="pl-10"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Senha mínima 6 caracteres"
                className="pl-10"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              placeholder="(85) 99999-9999"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Função *</Label>
            <Select value={formData.role} onValueChange={(value: typeof formData.role) => setFormData(prev => ({ ...prev, role: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="corretor">Corretor</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.role === 'corretor' && (
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Award className="w-4 h-4" />
                <span>Dados Profissionais do Corretor</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="creci">CRECI *</Label>
                  <Input
                    id="creci"
                    placeholder="Ex: 12345-F"
                    value={corretorData.creci}
                    onChange={(e) => setCorretorData(prev => ({ ...prev, creci: e.target.value }))}
                    required={formData.role === 'corretor'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    placeholder="Ex: 000.000.000-00"
                    value={corretorData.cpf}
                    onChange={(e) => setCorretorData(prev => ({ ...prev, cpf: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp *</Label>
                  <Input
                    id="whatsapp"
                    placeholder="Ex: (85) 99999-9999"
                    value={corretorData.whatsapp}
                    onChange={(e) => setCorretorData(prev => ({ ...prev, whatsapp: e.target.value }))}
                    required={formData.role === 'corretor'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    placeholder="Ex: Fortaleza"
                    value={corretorData.cidade}
                    onChange={(e) => setCorretorData(prev => ({ ...prev, cidade: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Select value={corretorData.estado} onValueChange={(value) => setCorretorData(prev => ({ ...prev, estado: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AC">Acre</SelectItem>
                      <SelectItem value="AL">Alagoas</SelectItem>
                      <SelectItem value="AP">Amapá</SelectItem>
                      <SelectItem value="AM">Amazonas</SelectItem>
                      <SelectItem value="BA">Bahia</SelectItem>
                      <SelectItem value="CE">Ceará</SelectItem>
                      <SelectItem value="DF">Distrito Federal</SelectItem>
                      <SelectItem value="ES">Espírito Santo</SelectItem>
                      <SelectItem value="GO">Goiás</SelectItem>
                      <SelectItem value="MA">Maranhão</SelectItem>
                      <SelectItem value="MT">Mato Grosso</SelectItem>
                      <SelectItem value="MS">Mato Grosso do Sul</SelectItem>
                      <SelectItem value="MG">Minas Gerais</SelectItem>
                      <SelectItem value="PA">Pará</SelectItem>
                      <SelectItem value="PB">Paraíba</SelectItem>
                      <SelectItem value="PR">Paraná</SelectItem>
                      <SelectItem value="PE">Pernambuco</SelectItem>
                      <SelectItem value="PI">Piauí</SelectItem>
                      <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                      <SelectItem value="RN">Rio Grande do Norte</SelectItem>
                      <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                      <SelectItem value="RO">Rondônia</SelectItem>
                      <SelectItem value="RR">Roraima</SelectItem>
                      <SelectItem value="SC">Santa Catarina</SelectItem>
                      <SelectItem value="SP">São Paulo</SelectItem>
                      <SelectItem value="SE">Sergipe</SelectItem>
                      <SelectItem value="TO">Tocantins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_imovel">Tipo de Imóvel</Label>
                  <Select value={corretorData.tipo_imovel} onValueChange={(value: any) => setCorretorData(prev => ({ ...prev, tipo_imovel: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="residencial">Residencial</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="terreno">Terreno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Informações adicionais do corretor..."
                  value={corretorData.observacoes}
                  onChange={(e) => setCorretorData(prev => ({ ...prev, observacoes: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createUserMutation.isPending}
              className="min-w-[100px]"
            >
              {createUserMutation.isPending ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
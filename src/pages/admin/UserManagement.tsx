import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, UserCheck, UserX, Shield, Clock, Users, Loader2, Power } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { CreateUserModal } from '@/components/modals/CreateUserModal';
import { EditUserModal } from '@/components/modals/EditUserModal';
import { chamarFuncao } from '@/lib/erroAmigavel';
import DashboardLayout from '@/components/layout/DashboardLayout';

export interface ManagedUser {
  id: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'sdr' | 'closer' | 'corretor' | 'cliente';
  email: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  user_id: string;
  last_sign_in_at?: string;
}

const UserManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users via Edge Function (includes email from auth.users)
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['managed-users'],
    queryFn: async () => {
      const data = await chamarFuncao<{ users: ManagedUser[] }>('manage-user', { action: 'list' });
      return data.users;
    },
    enabled: isAdmin
  });

  // Toggle user active status
  const toggleActiveStatusMutation = useMutation({
    mutationFn: async (userId: string) => {
      return chamarFuncao<{ is_active: boolean }>('manage-user', { action: 'toggle_active', user_id: userId });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] });
      toast({
        title: data.is_active ? 'Usuário ativado' : 'Usuário desativado',
        description: data.is_active
          ? 'O usuário agora pode acessar o sistema.'
          : 'Sem acesso ao sistema e fora das sugestões de visita. Nada foi apagado.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Não foi possível alterar o status',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Delete user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await chamarFuncao('manage-user', { action: 'delete', user_id: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] });
      toast({
        title: 'Usuário removido',
        description: 'A conta foi removida.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Não foi possível excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const filteredUsers = users.filter(user =>
    user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive' as const;
      case 'sdr': case 'closer': return 'outline' as const;
      case 'corretor': return 'default' as const;
      case 'cliente': return 'secondary' as const;
      default: return 'outline' as const;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'sdr': return 'SDR';
      case 'closer': return 'Closer';
      case 'corretor': return 'Corretor';
      case 'cliente': return 'Cliente';
      default: return role;
    }
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Usuários</h1>
            <p className="text-muted-foreground">
              Gerencie todos os usuários do sistema
            </p>
          </div>
          <Button className="md:w-auto" onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Usuário
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{users.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Admins</p>
                  <p className="text-xl font-bold">{users.filter(u => u.role === 'admin').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Corretores</p>
                  <p className="text-xl font-bold">{users.filter(u => u.role === 'corretor').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Clientes</p>
                  <p className="text-xl font-bold">{users.filter(u => u.role === 'cliente').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Inativos</p>
                  <p className="text-xl font-bold">{users.filter(u => u.is_active === false).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Usuários</CardTitle>
            <CardDescription>
              {filteredUsers.length} usuário(s) encontrado(s)
            </CardDescription>
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou função..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum usuário encontrado.
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Último Login</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className={!user.is_active && user.is_active !== undefined ? 'opacity-60' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                              {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                            </div>
                            <span className="font-medium">{user.first_name} {user.last_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {getRoleLabel(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.is_active === false ? (
                            <Badge variant="outline" className="border-orange-400 text-orange-600">
                              Inativo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-400 text-green-600">
                              Ativo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {user.last_sign_in_at
                            ? new Date(user.last_sign_in_at).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Nunca'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar"
                              onClick={() => {
                                setSelectedUser(user);
                                setEditModalOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={user.is_active === false ? 'Ativar' : 'Desativar'}
                              onClick={() => toggleActiveStatusMutation.mutate(user.user_id)}
                              disabled={toggleActiveStatusMutation.isPending}
                            >
                              {toggleActiveStatusMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Power className={`h-4 w-4 ${user.is_active === false ? 'text-green-500' : 'text-orange-500'}`} />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Excluir"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`Excluir ${user.first_name} ${user.last_name} de vez? Não dá para desfazer. Quem já tem visitas, vendas ou leads não pode ser excluído: use Desativar.`)) {
                                  deleteUserMutation.mutate(user.user_id);
                                }
                              }}
                              disabled={deleteUserMutation.isPending}
                            >
                              {deleteUserMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modals */}
        <CreateUserModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
        />

        <EditUserModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          user={selectedUser}
        />
      </div>
    </DashboardLayout>
  );
};

export default UserManagement;
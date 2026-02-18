import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Home,
  Users,
  UserCheck,
  Building2,
  Calendar,
  MessageSquare,
  BarChart3,
  Settings,
  RefreshCw,
  LogOut,
  UserCog,
  TrendingUp,
  Activity,
  Bot,
  DollarSign
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import Logo from '@/components/ui/logo';
import { NotificationSystem } from "@/components/notifications/NotificationSystem";

interface DashboardLayoutProps {
  children: ReactNode;
}

const navigation = {
  admin: [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Leads', href: '/leads', icon: Users },
    { name: 'Corretores', href: '/corretores', icon: UserCheck },
    { name: 'Gestão de Usuários', href: '/admin/users', icon: UserCog },
    { name: 'Empreendimentos', href: '/empreendimentos', icon: Building2 },
    { name: 'Visitas', href: '/visitas', icon: Calendar },
    { name: 'Vendas', href: '/vendas', icon: DollarSign },
    { name: 'Comunicações', href: '/comunicacoes', icon: MessageSquare },
    { name: 'Relatórios', href: '/relatorios', icon: BarChart3 },
    { name: 'Analytics', href: '/admin/analytics', icon: TrendingUp },
    { name: 'Agentes de IA', href: '/admin/ai-agents', icon: Bot },
    { name: 'Monitoramento', href: '/admin/monitoring', icon: Activity },
    { name: 'Sincronização WP', href: '/sincronizacao-wordpress', icon: RefreshCw },
    { name: 'Configurações', href: '/configuracoes', icon: Settings },
  ],
  corretor: [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Meus Leads', href: '/meus-leads', icon: Users },
    { name: 'Minhas Visitas', href: '/minhas-visitas', icon: Calendar },
    { name: 'Minhas Comissões', href: '/minhas-comissoes', icon: DollarSign },
    { name: 'Meu Perfil', href: '/perfil', icon: UserCheck },
  ]
};

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { profile, signOut, isAdmin, isCorretor } = useAuth();
  const location = useLocation();

  const navItems = isAdmin ? navigation.admin : navigation.corretor;

  const getUserInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return 'US';
  };

  const getUserRole = () => {
    switch (profile?.role) {
      case 'admin': return 'Administrador';
      case 'corretor': return 'Corretor';
      case 'cliente': return 'Cliente';
      default: return 'Usuário';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-white/20 sticky top-0 z-50">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Logo size="md" />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <NotificationSystem />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url} alt={profile?.first_name} />
                      <AvatarFallback className="bg-primary text-white">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {profile?.first_name} {profile?.last_name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {getUserRole()}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <nav className="w-64 bg-white/70 backdrop-blur-lg border-r border-white/20">
          <div className="flex h-full flex-col">
            <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
              <div className="flex flex-1 flex-col space-y-1 px-3">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`
                        group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors
                        ${isActive
                          ? 'bg-primary text-white shadow-glow'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }
                      `}
                    >
                      <item.icon
                        className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-500'
                          }`}
                        aria-hidden="true"
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
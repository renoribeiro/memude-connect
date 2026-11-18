import { ReactNode, useState } from 'react';
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
import { DollarSign, LogOut, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import Logo from '@/components/ui/logo';
import { NotificationSystem } from "@/components/notifications/NotificationSystem";
import ThemeToggle from '@/components/layout/ThemeToggle';
import { MenuLateral } from './MenuLateral';
import { NAV_CLIENTE, NAV_CORRETOR, NAV_EQUIPE, filtrarNav } from './navegacao';

interface DashboardLayoutProps {
  children: ReactNode;
}

const PAPEL: Record<string, string> = {
  admin: 'Administrador', corretor: 'Corretor', cliente: 'Cliente', sdr: 'SDR', closer: 'Closer',
};

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { profile, signOut, isAdmin, isComercial, isCorretor } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);

  const entradas = isAdmin || isComercial
    ? filtrarNav(NAV_EQUIPE, isAdmin)
    : isCorretor ? NAV_CORRETOR : NAV_CLIENTE;
  const iniciais = profile?.first_name && profile?.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : 'US';

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="sticky top-0 z-50 border-b border-border bg-card shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu lateral">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SheetTitle className="sr-only">Menu</SheetTitle>
                  <div className="flex h-full flex-col bg-card">
                    <div className="flex h-16 items-center border-b px-6">
                      <Logo size="md" />
                    </div>
                    <div className="flex-1 overflow-y-auto py-4">
                      <MenuLateral entradas={entradas} aoNavegar={() => setMenuAberto(false)} />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <div className="hidden flex-shrink-0 md:flex">
                <Logo size="md" />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {isAdmin && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href="https://financas.memudecore.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Abrir MeMude Financeiro"
                  >
                    <DollarSign className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Financeiro</span>
                  </a>
                </Button>
              )}
              <ThemeToggle />
              <NotificationSystem />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full" aria-label="Menu de perfil do usuário">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url} alt={profile?.first_name} />
                      <AvatarFallback className="bg-gradient-primary text-white">{iniciais}</AvatarFallback>
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
                        {PAPEL[profile?.role ?? ''] ?? 'Usuário'}
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
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border bg-card/70 py-4 md:block">
          <MenuLateral entradas={entradas} />
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;

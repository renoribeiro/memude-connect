import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, LogIn, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/ui/logo';
import { useAuth } from '@/hooks/useAuth';

/** Sem permissão para a página (padrão MeMude). */
const Unauthorized = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const sair = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center"><Logo size="md" /></div>
        <section className="space-y-5 rounded-[22px] border border-mm-borda-suave bg-card p-8">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-mm-rosa-claro">
            <ShieldAlert className="h-9 w-9 text-mm-acao" aria-hidden />
          </span>
          <div className="space-y-2">
            <h1 className="text-[26px] tracking-[-0.02em]">Acesso não autorizado</h1>
            <p className="text-[15px] text-muted-foreground">
              {user
                ? 'Seu perfil não tem acesso a esta página. Se precisar, peça ao administrador.'
                : 'Entre com seu login para acessar esta página.'}
            </p>
          </div>
          {user ? (
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="acao" className="h-12 flex-1" onClick={() => navigate('/', { replace: true })}>
                  <Home className="h-4 w-4" /> Ir para o início
                </Button>
                <Button variant="outline" className="h-12 flex-1" onClick={() => navigate(-1)}>
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
              </div>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={sair}>Sair da conta</Button>
            </div>
          ) : (
            <Button variant="acao" className="h-12 w-full" onClick={() => navigate('/auth')}>
              <LogIn className="h-4 w-4" /> Entrar
            </Button>
          )}
        </section>
      </div>
    </main>
  );
};

export default Unauthorized;

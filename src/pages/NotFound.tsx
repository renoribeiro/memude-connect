import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/ui/logo';

/** Página não encontrada (padrão MeMude: fundo claro, cartão branco, ação principal rosa). */
const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center"><Logo size="md" /></div>
        <section className="space-y-5 rounded-[22px] border border-mm-borda-suave bg-card p-8">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-mm-lilas">
            <MapPin className="h-9 w-9 text-primary" aria-hidden />
          </span>
          <div className="space-y-2">
            <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-mm-rosa-texto">Erro 404</p>
            <h1 className="text-[26px] tracking-[-0.02em]">Página não encontrada</h1>
            <p className="text-[15px] text-muted-foreground">O endereço não existe ou mudou de lugar.</p>
            <p className="break-all text-xs text-muted-foreground">{location.pathname}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="acao" className="h-12 flex-1" onClick={() => navigate('/', { replace: true })}>
              <Home className="h-4 w-4" /> Ir para o início
            </Button>
            <Button variant="outline" className="h-12 flex-1" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          </div>
        </section>
        <p className="text-sm text-muted-foreground">Se achar que é um erro, avise a equipe da MeMude.</p>
      </div>
    </main>
  );
};

export default NotFound;

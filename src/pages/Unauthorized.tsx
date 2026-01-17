import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Home, LogIn, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Logo from '@/components/ui/logo';
import { useAuth } from '@/hooks/useAuth';

const Unauthorized = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleLogin = () => {
    navigate('/auth');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-primary">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-secondary/20 rounded-full animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-light/10 rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 w-full max-w-lg space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Logo size="xl" variant="white" />
          </div>
        </div>

        {/* Main Card */}
        <Card className="glass-card border-white/20 shadow-2xl">
          <CardContent className="p-8 text-center space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center shadow-glow">
                <ShieldAlert className="w-10 h-10 text-white" />
              </div>
            </div>

            {/* Title and Message */}
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-foreground">
                Acesso Não Autorizado
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {user 
                  ? "Você não tem permissão para acessar esta página. Entre em contato com o administrador se acredita que isso é um erro."
                  : "Você precisa estar logado para acessar esta página."
                }
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4 pt-4">
              {user ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={handleGoHome}
                    className="flex-1 bg-primary hover:bg-primary-dark text-primary-foreground font-medium h-12"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Ir para Início
                  </Button>
                  <Button 
                    onClick={handleGoBack}
                    variant="outline"
                    className="flex-1 bg-white/10 border-white/30 text-foreground hover:bg-white/20 h-12"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={handleLogin}
                  className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-medium h-12"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Fazer Login
                </Button>
              )}
              
              {user && (
                <Button 
                  onClick={handleLogout}
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground hover:bg-white/10"
                >
                  Sair da Conta
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-white/70 text-sm">
          Precisa de ajuda? Entre em contato com o suporte.
        </p>
      </div>
    </div>
  );
};

export default Unauthorized;
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { MapPin, Home, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Logo from '@/components/ui/logo';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-primary">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-white/10 rounded-full animate-bounce" style={{ animationDuration: '3s' }} />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-secondary/20 rounded-full animate-pulse-slow" />
        <div className="absolute top-1/3 left-1/4 w-48 h-48 bg-primary-light/10 rounded-full animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute bottom-1/3 right-1/4 w-56 h-56 bg-white/5 rounded-full animate-bounce" style={{ animationDuration: '4s', animationDelay: '0.5s' }} />
      </div>

      <div className="relative z-10 w-full max-w-2xl space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Logo size="xl" variant="white" />
          </div>
        </div>

        {/* Main Card */}
        <Card className="glass-card border-white/20 shadow-2xl">
          <CardContent className="p-12 text-center space-y-8">
            {/* 404 Icon and Number */}
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-32 h-32 bg-gradient-primary rounded-full flex items-center justify-center shadow-glow animate-pulse-slow">
                    <MapPin className="w-16 h-16 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-secondary rounded-full flex items-center justify-center shadow-glow-pink">
                    <Search className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h1 className="text-8xl font-bold text-transparent bg-gradient-primary bg-clip-text">
                  404
                </h1>
                <div className="w-24 h-1 bg-gradient-primary rounded-full mx-auto"></div>
              </div>
            </div>

            {/* Title and Message */}
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-foreground">
                Página Não Encontrada
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-md mx-auto">
                Ops! Parece que você se perdeu no caminho. A página que você está procurando não existe ou foi movida.
              </p>
              <p className="text-sm text-muted-foreground/80 font-mono bg-muted/20 rounded-lg px-4 py-2 inline-block">
                Rota tentada: <span className="text-error">{location.pathname}</span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button 
                onClick={handleGoHome}
                className="flex-1 bg-primary hover:bg-primary-dark text-primary-foreground font-medium h-12 shadow-glow hover:shadow-glow-pink transition-all duration-300"
              >
                <Home className="w-5 h-5 mr-2" />
                Voltar ao Início
              </Button>
              <Button 
                onClick={handleGoBack}
                variant="outline"
                className="flex-1 bg-white/10 border-white/30 text-foreground hover:bg-white/20 h-12"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Página Anterior
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center space-y-2">
          <p className="text-white/70 text-sm">
            Se você acredita que isso é um erro, entre em contato com o suporte.
          </p>
          <div className="flex justify-center space-x-4 text-white/50 text-xs">
            <span>MeMude Connect</span>
            <span>•</span>
            <span>Portal Imobiliário</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

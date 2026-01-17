import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import Logo from '@/components/ui/logo';
import { signInSchema, SignInFormData } from '@/lib/validations';
import { AuthLoadingScreen } from '@/components/ui/loading-states';
import heroImage from '@/assets/hero-dashboard.jpg';

const AuthPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, profile, loading } = useAuth();
  const { handleAsyncError } = useErrorHandler();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user && profile) {
      console.log('User authenticated, redirecting to home');
      navigate('/', { replace: true });
    }
  }, [user, profile, loading, navigate]);

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleSignIn = async (data: SignInFormData) => {
    setIsLoading(true);
    try {
      const result = await handleAsyncError(
        () => signIn(data.email, data.password),
        { customMessage: 'Erro ao fazer login. Verifique suas credenciais.' }
      );
      
      if (result && !result.error) {
        // Auth context will handle navigation through the useEffect
        console.log('Login successful, waiting for auth state update');
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };



  // Show loading while checking auth status
  if (loading) {
    return <AuthLoadingScreen />;
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(236, 72, 153, 0.8)), url(${heroImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="w-full max-w-md space-y-6">
        <div className="text-center text-white space-y-2">
          <div className="flex justify-center mb-6">
            <Logo size="lg" variant="white" />
          </div>
          <p className="text-white/90 text-lg font-medium">Portal de Gestão Imobiliária</p>
        </div>

        <Card className="backdrop-blur-xl bg-white/95 border border-white/30 shadow-2xl">
          <CardHeader className="space-y-3">
            <CardTitle className="text-2xl font-bold text-center text-foreground">
              Entrar na sua conta
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              Digite suas credenciais para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...signInForm}>
              <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-6">
                <FormField
                  control={signInForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-medium">Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="seu@email.com"
                          className="bg-white border-input text-foreground placeholder:text-muted-foreground"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signInForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-medium">Senha</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Sua senha"
                          className="bg-white border-input text-foreground placeholder:text-muted-foreground"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar no Sistema
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
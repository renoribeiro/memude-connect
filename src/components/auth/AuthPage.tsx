import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Logo from '@/components/ui/logo';
import { signInSchema, SignInFormData } from '@/lib/validations';
import { AuthLoadingScreen } from '@/components/ui/loading-states';

const AuthPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, user, profile, loading } = useAuth();
  const { handleAsyncError } = useErrorHandler();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user && profile) {
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
        // O contexto de autenticação conclui o redirecionamento.
      }
    } catch (error) {
      console.error(
        'Falha no login:',
        error instanceof Error ? error.message : 'erro desconhecido',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const emailIsValid = await signInForm.trigger('email');
    if (!emailIsValid) return;

    setIsResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        signInForm.getValues('email'),
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (error) throw error;

      toast({
        title: 'Verifique seu email',
        description:
          'Se houver uma conta com esse endereço, enviaremos as instruções para redefinir a senha.',
      });
    } catch {
      // Resposta genérica para não revelar se uma conta existe.
      toast({
        title: 'Verifique seu email',
        description:
          'Se houver uma conta com esse endereço, enviaremos as instruções para redefinir a senha.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Show loading while checking auth status
  if (loading) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>

        <Card className="rounded-[22px] border-mm-borda-suave shadow-none">
          <CardHeader className="space-y-2 pb-4">
            <CardTitle className="text-center text-[30px] font-extrabold tracking-[-0.02em]">
              Entrar no MeMude
            </CardTitle>
            <CardDescription className="text-center text-[15px]">
              Corretores e equipe usam o mesmo acesso.
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
                      <FormLabel className="text-[13px] font-semibold text-foreground">E-mail</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="seu@email.com"
                          autoComplete="email"
                          inputMode="email"
                          className="h-[50px] text-base"
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
                      <FormLabel className="text-[13px] font-semibold text-foreground">Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Sua senha"
                            autoComplete="current-password"
                            className="h-[50px] pr-12 text-base"
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-primary"
                            onClick={() => setShowPassword((visible) => !visible)}
                            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          >
                            {showPassword
                              ? <EyeOff className="h-4 w-4" />
                              : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-sm font-bold text-mm-acao"
                    disabled={isLoading || isResetting}
                    onClick={handlePasswordReset}
                  >
                    {isResetting ? 'Enviando instruções...' : 'Esqueci minha senha'}
                  </Button>
                </div>
                <Button
                  type="submit"
                  variant="acao"
                  className="h-[54px] w-full text-base"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
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

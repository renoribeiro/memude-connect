import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Logo from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const MIN_PASSWORD_LENGTH = 12;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let active = true;
    const finishCheck = async () => {
      const { data } = await supabase.auth.getSession();
      if (active) {
        setSessionReady(Boolean(data.session));
        setCheckingSession(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;
        if (event === 'PASSWORD_RECOVERY' || session) {
          setSessionReady(true);
          setCheckingSession(false);
        }
      },
    );
    void finishCheck();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: 'Senha muito curta',
        description: `Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        variant: 'destructive',
      });
      return;
    }
    if (password !== confirmation) {
      toast({
        title: 'As senhas não coincidem',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut();
      toast({
        title: 'Senha atualizada',
        description: 'Entre novamente usando sua nova senha.',
      });
      navigate('/auth', { replace: true });
    } catch (error) {
      toast({
        title: 'Não foi possível atualizar a senha',
        description: error instanceof Error
          ? error.message
          : 'Solicite um novo link de recuperação.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-600 to-pink-500 p-4 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo size="lg" variant="white" />
        </div>
        <Card className="border-white/30 bg-white/95 shadow-2xl">
          <CardHeader>
            <CardTitle>Redefinir senha</CardTitle>
            <CardDescription>
              Crie uma senha forte com pelo menos {MIN_PASSWORD_LENGTH} caracteres.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checkingSession ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Validando o link...
              </div>
            ) : !sessionReady ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Este link é inválido ou expirou. Solicite uma nova recuperação de senha.
                </p>
                <Button className="w-full" onClick={() => navigate('/auth')}>
                  Voltar ao login
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={MIN_PASSWORD_LENGTH}
                      maxLength={100}
                      autoComplete="new-password"
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword
                        ? <EyeOff className="h-4 w-4" />
                        : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    minLength={MIN_PASSWORD_LENGTH}
                    maxLength={100}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <Button className="w-full" type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Atualizar senha
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useMemo, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { desativarPush } from '@/lib/conversas/push';

interface Profile {
  id: string;
  user_id: string;
  role: 'admin' | 'corretor' | 'cliente' | 'sdr' | 'closer';
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: any; success?: boolean }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isCorretor: boolean;
  /** Equipe comercial do módulo Leads e Visitas: admin, SDR ou closer. */
  isComercial: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const ultimoUsuario = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name, phone, avatar_url')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Falha ao carregar perfil:', profileError.message);
        return null;
      }

      if (!profileData) {
        console.warn('Perfil de usuário não encontrado');
        return null;
      }

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Falha ao carregar papel do usuário:', roleError.message);
        return null;
      }

      return {
        ...profileData,
        // Ausência de papel falha para o nível sem privilégios.
        role: roleData?.role || 'cliente',
      };
    } catch (error) {
      console.error(
        'Falha inesperada ao carregar perfil:',
        error instanceof Error ? error.message : 'erro desconhecido',
      );
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Prevent race condition with getSession on mount
        if (event === 'INITIAL_SESSION') return;
        if (!active) return;

        // Sessão expirou, saiu em outra aba ou trocou de pessoa: nada da anterior fica em cache
        const novoUsuario = session?.user?.id ?? null;
        if (event === 'SIGNED_OUT' || (ultimoUsuario.current && novoUsuario && novoUsuario !== ultimoUsuario.current)) {
          queryClient.clear();
        }
        ultimoUsuario.current = novoUsuario;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          fetchProfile(session.user.id).then(userProfile => {
            if (!active) return;
            setProfile(userProfile);
            setLoading(false);
          }).catch(error => {
            console.error(
              'Falha ao carregar perfil autenticado:',
              error instanceof Error ? error.message : 'erro desconhecido',
            );
            setProfile(null);
            setLoading(false);
          });
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active) return;

      if (error) {
        console.error('Error getting session:', error);
        setLoading(false);
        return;
      }

      if (session?.user) {
        setSession(session);
        setUser(session.user);
        fetchProfile(session.user.id).then(userProfile => {
          if (!active) return;
          setProfile(userProfile);
          setLoading(false);
        }).catch(error => {
          console.error(
            'Falha ao carregar perfil da sessão:',
            error instanceof Error ? error.message : 'erro desconhecido',
          );
          setProfile(null);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, queryClient]);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsAuthenticating(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setIsAuthenticating(false);
        toast({
          title: "Erro ao fazer login",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo ao MeMude Connect",
      });

      setIsAuthenticating(false);
      return { success: true };
    } catch (error: any) {
      setIsAuthenticating(false);
      toast({
        title: "Erro ao fazer login",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  }, [toast]);

  const signUp = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: firstName,
            last_name: lastName,
          }
        }
      });

      if (error) {
        toast({
          title: "Erro ao criar conta",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      toast({
        title: "Conta criada com sucesso!",
        description: "Verifique seu email para confirmar a conta.",
      });

      return {};
    } catch (error: any) {
      toast({
        title: "Erro ao criar conta",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  }, [toast]);

  const signOut = useCallback(async () => {
    // Aparelho para de receber avisos da pessoa que saiu (lead e prévia de mensagem são dados sensíveis)
    await Promise.race([desativarPush().catch(() => undefined), new Promise((r) => setTimeout(r, 2500))]);
    await supabase.auth.signOut();
    // Celular compartilhado: nada da pessoa anterior fica na tela (conversas em cache e rascunhos)
    queryClient.clear();
    Object.keys(sessionStorage).filter((k) => k.startsWith('memude:rascunho:')).forEach((k) => sessionStorage.removeItem(k));
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAuthenticating(false);
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
  }, [toast, queryClient]);

  const isAdmin = useMemo(() => profile?.role === 'admin', [profile]);
  const isCorretor = useMemo(() => profile?.role === 'corretor', [profile]);
  const isComercial = useMemo(() => ['admin', 'sdr', 'closer'].includes(profile?.role ?? ''), [profile]);

  const value = useMemo((): AuthContextType => ({
    user,
    session,
    profile,
    loading: loading || isAuthenticating,
    signIn,
    signUp,
    signOut,
    isAdmin,
    isCorretor,
    isComercial,
  }), [user, session, profile, loading, isAuthenticating, signIn, signUp, signOut, isAdmin, isCorretor, isComercial]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { idbStore } from '@/lib/offline/store';
import { wipeLocalData } from '@/lib/offline/pin';
import { secureStore } from '@/lib/offline/local';
import { isOfflineAccessValid } from '@/lib/offline/access';

type AppRole = 'admin_kraflo' | 'admin_empresa';

interface UserProfile {
  id: string;
  empresa_id: string | null;
  nome_completo: string | null;
  email: string | null;
  funcao: string | null;
  setor: string | null;
  codigo_empresa: string | null;
  id_telegram: number | null;
  /** Chave do técnico deste usuário (número interno; não é o ID do Telegram) */
  tecnico_id: number | null;
}

const PROFILE_CACHE_KEY = 'kraflo:profile-cache';

function clearCachedProfile(): void {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // nada a fazer
  }
}

function readCachedProfile(userId: string): { profile: UserProfile; roles: AppRole[] } | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { userId: string; validatedAt: number; profile: UserProfile; roles: AppRole[] };
    if (cached.userId !== userId) return null;
    // Acesso offline expira se não houve validação com o servidor no prazo máximo
    if (!isOfflineAccessValid(cached.validatedAt)) return null;
    return { profile: cached.profile, roles: cached.roles };
  } catch {
    return null;
  }
}

function writeCachedProfile(userId: string, profile: UserProfile, roles: AppRole[]): void {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ userId, validatedAt: Date.now(), profile, roles }));
  } catch {
    // armazenamento cheio ou bloqueado: segue sem cache
  }
}

interface SignUpData {
  nomeCompleto: string;
  funcao?: string;
  setor?: string;
  nomeEmpresa?: string;
  codigoConvite?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  roles: AppRole[];
  isLoading: boolean;
  isAdminKraflo: boolean;
  isAdminEmpresa: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, data: SignUpData) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    // Sem conexão, usa o último perfil conhecido deste usuário (modo campo offline)
    const cached = readCachedProfile(userId);
    if (cached) {
      setProfile(cached.profile);
      setRoles(cached.roles);
    }
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileData) {
        setProfile(profileData as UserProfile);
      }

      // Fetch roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (rolesData) {
        setRoles(rolesData.map(r => r.role as AppRole));
      }

      if (profileData && rolesData) {
        writeCachedProfile(userId, profileData as UserProfile, rolesData.map(r => r.role as AppRole));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (email: string, password: string, data: SignUpData) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nome_completo: data.nomeCompleto,
          funcao: data.funcao || null,
          setor: data.setor || null,
          nome_empresa: data.nomeEmpresa || null,
          codigo_convite: data.codigoConvite || null,
        },
      },
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    // Logout apaga PIN, dados de apoio e fila deste aparelho (a tela avisa antes sobre envios pendentes)
    await wipeLocalData(idbStore);
    secureStore.lock();
    clearCachedProfile();
    await supabase.auth.signOut();
  };

  const isAdminKraflo = roles.includes('admin_kraflo');
  const isAdminEmpresa = roles.includes('admin_empresa');

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        isLoading,
        isAdminKraflo,
        isAdminEmpresa,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmailVerificationDialog } from '@/components/EmailVerificationDialog';
import { toast } from '@/components/ui/sonner';
import { Bot, Loader2, Mail, Lock, User, Briefcase, Building2, Hash, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
;

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const signupSchema = z.object({
  nomeCompleto: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
  funcao: z.string().optional(),
  setor: z.string().optional(),
  modo: z.enum(['nova', 'convite']),
  nomeEmpresa: z.string().optional(),
  codigoConvite: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
}).refine((data) => data.modo !== 'nova' || (data.nomeEmpresa ?? '').trim().length >= 2, {
  message: 'Informe o nome da empresa',
  path: ['nomeEmpresa'],
}).refine((data) => data.modo !== 'convite' || (data.codigoConvite ?? '').trim().length === 8, {
  message: 'O código de convite tem 8 caracteres',
  path: ['codigoConvite'],
});


export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form
  const [signupNome, setSignupNome] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupFuncao, setSignupFuncao] = useState('');
  const [signupSetor, setSignupSetor] = useState('');
  const [signupNomeEmpresa, setSignupNomeEmpresa] = useState('');
  const [searchParams] = useSearchParams();
  const conviteDaUrl = (searchParams.get('convite') ?? '').toUpperCase().slice(0, 8);
  const [signupModo, setSignupModo] = useState<'nova' | 'convite'>(conviteDaUrl ? 'convite' : 'nova');
  const [signupConvite, setSignupConvite] = useState(conviteDaUrl);
  // Empresa do convite, confirmada no servidor (null = ainda não conferido ou inválido)
  const [conviteEmpresa, setConviteEmpresa] = useState<string | null>(null);
  const [conviteChecado, setConviteChecado] = useState(false);

  // Link de convite abre direto no cadastro
  useEffect(() => {
    if (conviteDaUrl) setActiveTab('signup');
  }, [conviteDaUrl]);

  // Confere o código assim que tem 8 caracteres e mostra para qual empresa ele vale
  useEffect(() => {
    setConviteEmpresa(null);
    setConviteChecado(false);
    if (signupModo !== 'convite' || signupConvite.trim().length !== 8) return;
    let cancelado = false;
    supabase.rpc('fn_validar_convite', { p_codigo: signupConvite.trim() }).then(({ data }) => {
      if (cancelado) return;
      const r = data as { valido?: boolean; empresa_nome?: string } | null;
      setConviteEmpresa(r?.valido ? (r.empresa_nome ?? '') : null);
      setConviteChecado(true);
    });
    return () => { cancelado = true; };
  }, [signupModo, signupConvite]);

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = loginSchema.parse({
        email: loginEmail,
        password: loginPassword,
      });

      const { error } = await signIn(validated.email, validated.password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Email ou senha incorretos');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Login realizado com sucesso!');
        navigate('/');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = signupSchema.parse({
        nomeCompleto: signupNome,
        email: signupEmail,
        password: signupPassword,
        confirmPassword: signupConfirmPassword,
        funcao: signupFuncao,
        setor: signupSetor,
        modo: signupModo,
        nomeEmpresa: signupNomeEmpresa,
        codigoConvite: signupConvite,
      });

      if (validated.modo === 'convite' && conviteEmpresa === null) {
        toast.error('Código de convite inválido. Confira com o administrador da empresa.');
        return;
      }

      const { error } = await signUp(validated.email, validated.password, {
        nomeCompleto: validated.nomeCompleto,
        funcao: validated.funcao,
        setor: validated.setor,
        nomeEmpresa: validated.modo === 'nova' ? validated.nomeEmpresa?.trim() : undefined,
        codigoConvite: validated.modo === 'convite' ? validated.codigoConvite?.trim().toUpperCase() : undefined,
      });
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Este email já está cadastrado');
        } else if (error.message.includes('Database error')) {
          toast.error('Não foi possível concluir o cadastro. Confira o código de convite e tente de novo.');
        } else {
          toast.error(error.message);
        }
      } else {
        setVerificationEmail(validated.email);
        setShowVerificationDialog(true);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-primary rounded-lg mb-4">
            <Bot className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="font-mono text-2xl font-bold text-foreground">KRAFLO</h1>
          <p className="text-muted-foreground text-sm">Sistema de Manutenção Industrial</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono">Acesso ao Sistema</CardTitle>
            <CardDescription>
              Entre com suas credenciais ou crie uma nova conta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar Conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      'Entrar'
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-nome">Nome Completo *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-nome"
                        type="text"
                        placeholder="Seu nome"
                        value={signupNome}
                        onChange={(e) => setSignupNome(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="signup-funcao">Função</Label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-funcao"
                          type="text"
                          placeholder="Ex: Mecânico"
                          value={signupFuncao}
                          onChange={(e) => setSignupFuncao(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-setor">Setor</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-setor"
                          type="text"
                          placeholder="Ex: Tecelagem"
                          value={signupSetor}
                          onChange={(e) => setSignupSetor(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>

                  <fieldset className="space-y-3">
                    <legend className="text-sm font-medium">Empresa *</legend>
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Como você entra na empresa">
                      {([['nova', 'Criar empresa'], ['convite', 'Tenho um convite']] as const).map(([valor, rotulo]) => (
                        <button
                          key={valor}
                          type="button"
                          role="radio"
                          aria-checked={signupModo === valor}
                          onClick={() => setSignupModo(valor)}
                          className={`h-10 rounded-md border text-sm transition-colors ${
                            signupModo === valor
                              ? 'border-primary bg-primary/15 text-primary'
                              : 'border-white/10 text-muted-foreground'
                          }`}
                        >
                          {rotulo}
                        </button>
                      ))}
                    </div>

                    {signupModo === 'nova' ? (
                      <div className="space-y-2">
                        <Label htmlFor="signup-empresa">Nome da empresa</Label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="signup-empresa"
                            type="text"
                            placeholder="Ex: Têxtil ABC"
                            value={signupNomeEmpresa}
                            onChange={(e) => setSignupNomeEmpresa(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Você será o administrador e poderá convidar a equipe com um código.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="signup-convite">Código de convite</Label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="signup-convite"
                            type="text"
                            placeholder="8 caracteres"
                            maxLength={8}
                            autoCapitalize="characters"
                            value={signupConvite}
                            onChange={(e) => setSignupConvite(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                            className="pl-10 font-mono tracking-widest"
                          />
                        </div>
                        {conviteEmpresa !== null ? (
                          <p className="flex items-center gap-1.5 text-xs text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Você entrará em: {conviteEmpresa}
                          </p>
                        ) : conviteChecado ? (
                          <p role="alert" className="text-xs text-destructive">Código não encontrado. Peça um novo ao administrador.</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Peça o código ao administrador da sua empresa.</p>
                        )}
                      </div>
                    )}
                  </fieldset>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirmar Senha *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-confirm"
                        type="password"
                        placeholder="••••••••"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      'Criar Conta'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Ao continuar, você concorda com os Termos de Serviço e Política de Privacidade.
        </p>
      </div>

      <EmailVerificationDialog
        open={showVerificationDialog}
        onClose={() => {
          setShowVerificationDialog(false);
          setActiveTab('login');
        }}
        email={verificationEmail}
      />
    </div>
  );
}

import React from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  ClipboardList,
  Library,
  Cpu,
  Activity,
  User,
  LogOut,
  Bot,
  Shield,
  Building2,
  ChevronRight,
  Settings2,
  Plus,
  Home,
  Boxes,
  Smartphone,
  Menu,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OSForm } from '@/components/OSForm';
import { AccessDenied } from '@/components/AccessDenied';
import { papelDe, podeAcessarRota, rotaInicial, temNivel, type Papel } from '@/lib/permissoes';
import { offlineQueue, secureStore } from '@/lib/offline/local';
import { idbStore } from '@/lib/offline/store';
import { pinOwner } from '@/lib/offline/pin';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, profile, roles, isAdminKraflo, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOSFormOpen, setIsOSFormOpen] = React.useState(false);
  const queryClient = useQueryClient();

  // Nenhuma tela interna deve abrir sem sessão
  React.useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true });
  }, [authLoading, user, navigate]);

  const handleSignOut = async () => {
    // Lançamentos de OS ainda não enviados seriam apagados: pede confirmação antes
    let aviso: string | null = null;
    if (secureStore.isUnlocked) {
      const pendentes = await offlineQueue.list();
      if (pendentes.length > 0) {
        aviso = `Há ${pendentes.length} lançamento(s) de OS que ainda não foram enviados. `;
      }
    } else if (await pinOwner(idbStore)) {
      // Bloqueado: não dá para contar sem o PIN, então avisa que pode haver pendências
      aviso = 'O Modo Campo está bloqueado e pode ter lançamentos de OS ainda não enviados. ';
    }
    if (aviso && !window.confirm(aviso + 'Se você sair, eles serão apagados deste aparelho. Sair mesmo assim?')) {
      return;
    }
    await signOut();
    navigate('/auth');
  };

  // Quem é quem: o menu, o bloqueio de rotas e os botões administrativos leem de lib/permissoes.ts
  const papel = papelDe(roles);

  interface ItemMenu {
    title: string;
    icon: React.ElementType;
    path: string;
    isActive: boolean;
    minimo: Papel;
    grupo: 'operacao' | 'administracao';
  }
  const na = (caminho: string) => location.pathname === caminho;

  const todosItens: ItemMenu[] = [
    // Operação: o trabalho do dia a dia (técnico e administração)
    { title: "Modo Campo", icon: Smartphone, path: "/campo", isActive: na("/campo"), minimo: 'tecnico', grupo: 'operacao' },
    { title: "Ordens de Serviço", icon: ClipboardList, path: "/ordens-servico", isActive: na("/ordens-servico"), minimo: 'tecnico', grupo: 'operacao' },
    { title: "Biblioteca", icon: Library, path: "/biblioteca", isActive: na("/biblioteca"), minimo: 'tecnico', grupo: 'operacao' },
    { title: "Estoque de Peças", icon: Boxes, path: "/estoque", isActive: na("/estoque"), minimo: 'tecnico', grupo: 'operacao' },
    { title: "Assistente IA", icon: MessageSquare, path: "/assistente", isActive: na("/assistente"), minimo: 'tecnico', grupo: 'operacao' },
    { title: "Raio-X Equipamento", icon: Cpu, path: "/equipamento", isActive: location.pathname.startsWith("/equipamento"), minimo: 'tecnico', grupo: 'operacao' },
    { title: "Meu Desempenho", icon: Activity, path: "/meu-desempenho", isActive: na("/meu-desempenho"), minimo: 'tecnico', grupo: 'operacao' },
    // Administração: gestão da empresa (só admin)
    { title: "Dashboard", icon: LayoutDashboard, path: "/", isActive: na("/"), minimo: 'admin_empresa', grupo: 'administracao' },
    { title: "Relatórios IA", icon: BarChart3, path: "/relatorios", isActive: na("/relatorios"), minimo: 'admin_empresa', grupo: 'administracao' },
    { title: "Gestão de Ativos", icon: Settings2, path: "/configuracoes", isActive: na("/configuracoes"), minimo: 'admin_empresa', grupo: 'administracao' },
    { title: "Indexação de IA", icon: Shield, path: "/admin/indexacao", isActive: na("/admin/indexacao"), minimo: 'admin_empresa', grupo: 'administracao' },
  ];

  const itensVisiveis = todosItens.filter((item) => temNivel(papel, item.minimo));
  const itensOperacao = itensVisiveis.filter((item) => item.grupo === 'operacao');
  const itensAdmin = itensVisiveis.filter((item) => item.grupo === 'administracao');
  const ehAdmin = papel !== 'tecnico';

  // Barra de baixo do celular: 2 atalhos de cada lado do botão "Nova OS". O resto vai em "Mais".
  const atalho = (path: string, label: string, icon: React.ElementType) => ({ path, label, icon });
  const atalhosEsquerda = ehAdmin
    ? [atalho("/", "Início", Home), atalho("/ordens-servico", "O.S", ClipboardList)]
    : [atalho("/campo", "Campo", Smartphone), atalho("/ordens-servico", "O.S", ClipboardList)];
  const atalhosDireita = ehAdmin
    ? [atalho("/campo", "Campo", Smartphone)]
    : [atalho("/meu-desempenho", "Desempenho", Activity)];
  const caminhosNaBarra = [...atalhosEsquerda, ...atalhosDireita].map((a) => a.path);
  const itensMais = itensVisiveis.filter((item) => !caminhosNaBarra.includes(item.path));
  const maisAtivo = itensMais.some((item) => item.isActive);

  // Bloqueio da tela: espera saber o papel; quem abre tela de admin sendo técnico volta ao seu início
  const acessoLiberado = podeAcessarRota(papel, location.pathname);
  let conteudo: React.ReactNode = children;
  if (!authLoading && user) {
    if (!acessoLiberado) {
      conteudo =
        location.pathname === '/' ? (
          <Navigate to={rotaInicial(papel)} replace />
        ) : (
          <AccessDenied message="Esta área é da administração da empresa. Fale com o administrador se precisar de acesso." />
        );
    }
  } else if (authLoading) {
    conteudo = (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const renderItemMenu = (item: ItemMenu) => (
    <SidebarMenuItem key={item.path}>
      <SidebarMenuButton
        onClick={() => navigate(item.path)}
        isActive={item.isActive}
        className={cn(
          "transition-all duration-200 hover:bg-primary/10 group",
          item.isActive && "bg-primary/20 text-primary border-r-2 border-primary"
        )}
      >
        <item.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", item.isActive && "text-primary")} />
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <Sidebar className="border-r border-border bg-sidebar-background">
          <SidebarHeader className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Bot className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-xl font-bold tracking-tighter text-foreground">
                  KRAFLO
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                  Industrial AI
                </span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-4">
            <SidebarMenu>
              <div className="mb-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Operação
              </div>
              {itensOperacao.map(renderItemMenu)}

              {itensAdmin.length > 0 && (
                <>
                  <div className="mt-6 mb-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Administração
                  </div>
                  {itensAdmin.map(renderItemMenu)}
                </>
              )}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-border bg-black/20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-12 w-full justify-between hover:bg-white/5 transition-colors rounded-xl p-2">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/20">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-medium truncate w-24 text-foreground">
                        {profile?.nome_completo || "Perfil"}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate w-24">
                        {user?.email}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 glass-panel border-border">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/conta')}>
                  <User className="mr-2 h-4 w-4" /> {ehAdmin ? 'Conta e Equipe' : 'Minha Conta'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/meu-desempenho')}>
                  <Activity className="mr-2 h-4 w-4" /> Meu Desempenho
                </DropdownMenuItem>
                {isAdminKraflo && (
                  <DropdownMenuItem onClick={() => navigate('/admin/indexacao')}>
                    <Shield className="mr-2 h-4 w-4" /> Admin Kraflo
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="bg-background flex flex-col min-w-0">
          <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-border sticky top-0 bg-background z-40">
            <div className="flex items-center gap-2 md:gap-4">
              <SidebarTrigger className="hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors hidden md:flex" />
              
              {/* Mobile Logo */}
              <div className="flex items-center gap-2 md:hidden">
                <Bot className="h-5 w-5 text-primary" />
                <span className="font-mono font-bold text-sm tracking-tighter">KRAFLO</span>
              </div>

              <div className="h-4 w-[1px] bg-white/10 mx-2 hidden md:block" />
              <div className="flex flex-col">
                <h2 className="text-xs md:text-sm font-semibold text-foreground tracking-tight line-clamp-1">
                  {location.pathname === "/" ? "Dashboard Operacional" : 
                   location.pathname.includes("ordens-servico") ? "Ordens de Serviço" :
                   location.pathname.includes("biblioteca") ? "Biblioteca de Manuais" :
                   location.pathname.includes("equipamento") ? "Raio-X de Equipamento" : 
                   location.pathname.includes("configuracoes") ? "Gestão de Ativos" :
                   location.pathname.includes("estoque") ? "Estoque de Peças" :
                   location.pathname.includes("campo") ? "Modo Campo" :
                   location.pathname.includes("conta") ? "Conta e Equipe" : "Sistema Industrial"}
                </h2>
                <div className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  Sistema Online
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {isAdminKraflo ? (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono text-[9px] md:text-[10px] uppercase px-1.5">
                  <Shield className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1" /> Admin
                </Badge>
              ) : papel === 'tecnico' ? (
                <Badge variant="outline" className="bg-secondary text-muted-foreground border-border font-mono text-[9px] md:text-[10px] uppercase px-1.5">
                  <User className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1" /> Técnico
                </Badge>
              ) : roles.includes('admin_empresa') ? (
                <Badge variant="outline" className="bg-secondary text-muted-foreground border-border font-mono text-[9px] md:text-[10px] uppercase px-1.5">
                  <Building2 className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1" /> Empresa
                </Badge>
              ) : null}
              
              {/* Mobile User Toggle */}
              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20">
                      <User className="h-4 w-4 text-primary" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 glass-panel border-border">
                    <DropdownMenuItem onClick={() => navigate('/conta')}>
                      <User className="mr-2 h-4 w-4" /> Conta e Equipe
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/meu-desempenho')}>
                      <Activity className="mr-2 h-4 w-4" /> Perfil
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                      <LogOut className="mr-2 h-4 w-4" /> Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="max-w-7xl mx-auto h-full"
              >
                {conteudo}
              </motion.div>
            </AnimatePresence>
          </main>
        </SidebarInset>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-border px-4 py-2 flex justify-around items-center safe-area-bottom shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
          {atalhosEsquerda.map((a) => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className={cn(
                "flex flex-col items-center p-2 transition-all",
                location.pathname === a.path ? "text-primary scale-110" : "text-muted-foreground"
              )}
            >
              <a.icon className="h-5 w-5" />
              <span className="text-[10px] mt-1 font-medium">{a.label}</span>
            </button>
          ))}

          {/* Center FAB */}
          <div className="relative -mt-10">
            <Button 
              size="icon" 
              className="h-14 w-14 rounded-full bg-primary hover:scale-110 active:scale-95 transition-all duration-300 border-4 border-background"
              aria-label="Nova OS"
              onClick={() => {
                // Sem conexão o formulário online não grava: abre o Modo Campo, que funciona offline
                if (!navigator.onLine) navigate('/campo');
                else setIsOSFormOpen(true);
              }}
            >
              <Plus className="h-7 w-7 text-primary-foreground" />
            </Button>
          </div>

          {atalhosDireita.map((a) => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className={cn(
                "flex flex-col items-center p-2 transition-all",
                location.pathname === a.path ? "text-primary scale-110" : "text-muted-foreground"
              )}
            >
              <a.icon className="h-5 w-5" />
              <span className="text-[10px] mt-1 font-medium">{a.label}</span>
            </button>
          ))}

          {/* Demais telas: no celular a barra lateral não aparece */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Mais telas"
                className={cn(
                  "flex flex-col items-center p-2 transition-all",
                  maisAtivo ? "text-primary scale-110" : "text-muted-foreground"
                )}
              >
                <Menu className="h-5 w-5" />
                <span className="text-[10px] mt-1 font-medium">Mais</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-60 glass-panel border-border mb-2">
              {itensMais.map((item) => (
                <DropdownMenuItem
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn("h-11", item.isActive && "text-primary")}
                >
                  <item.icon className="mr-3 h-4 w-4" /> {item.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Global OS Form for FAB */}
        <OSForm 
          open={isOSFormOpen} 
          onClose={() => setIsOSFormOpen(false)} 
          onSuccess={() => {
            setIsOSFormOpen(false);
            queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
            queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
          }}
        />
      </div>
    </SidebarProvider>
  );
}

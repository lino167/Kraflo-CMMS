import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OSForm } from '@/components/OSForm';
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

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, profile, roles, isAdminKraflo, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOSFormOpen, setIsOSFormOpen] = React.useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navItems = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/",
      isActive: location.pathname === "/",
    },
    {
      title: "Ordens de Serviço",
      icon: ClipboardList,
      path: "/ordens-servico",
      isActive: location.pathname === "/ordens-servico",
    },
    {
      title: "Biblioteca",
      icon: Library,
      path: "/biblioteca",
      isActive: location.pathname === "/biblioteca",
    },
    {
      title: "Gestão de Ativos",
      icon: Settings2,
      path: "/configuracoes",
      isActive: location.pathname === "/configuracoes",
    },
    {
      title: "Assistente IA",
      icon: MessageSquare,
      path: "/assistente",
      isActive: location.pathname === "/assistente",
    },
    {
      title: "Relatórios IA",
      icon: BarChart3,
      path: "/relatorios",
      isActive: location.pathname === "/relatorios",
    },
  ];

  // Special items that were in the header
  const technicalItems = [
    {
      title: "Raio-X Equipamento",
      icon: Cpu,
      path: "/equipamento",
      isActive: location.pathname.startsWith("/equipamento"),
    },
    {
      title: "Meu Desempenho",
      icon: Activity,
      path: "/meu-desempenho",
      isActive: location.pathname === "/meu-desempenho",
    },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <Sidebar className="border-r border-white/5 bg-sidebar-background/80 backdrop-blur-xl">
          <SidebarHeader className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg shadow-neon">
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
                Menu Principal
              </div>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    isActive={item.isActive}
                    className={cn(
                      "transition-all duration-200 hover:bg-primary/10 group",
                      item.isActive && "bg-primary/20 text-primary shadow-neon border-r-2 border-primary"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", item.isActive && "text-primary")} />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              <div className="mt-6 mb-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Análise Técnica
              </div>
              {technicalItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    isActive={item.isActive}
                    className={cn(
                      "transition-all duration-200 hover:bg-primary/10 group",
                      item.isActive && "bg-primary/20 text-primary shadow-neon border-r-2 border-primary"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", item.isActive && "text-primary")} />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-white/5 bg-black/20">
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
              <DropdownMenuContent align="end" className="w-56 glass-panel border-white/10 shadow-surface">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
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
          <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-white/5 sticky top-0 bg-background/50 backdrop-blur-xl z-40">
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
                   location.pathname.includes("configuracoes") ? "Gestão de Ativos" : "Sistema Industrial"}
                </h2>
                <div className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  Sistema Online • v3.0 Premium
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {isAdminKraflo ? (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono text-[9px] md:text-[10px] uppercase px-1.5">
                  <Shield className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1" /> Admin
                </Badge>
              ) : roles.includes('admin_empresa') ? (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-mono text-[9px] md:text-[10px] uppercase px-1.5">
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
                  <DropdownMenuContent align="end" className="w-56 glass-panel border-white/10">
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
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </SidebarInset>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-white/10 px-4 py-2 flex justify-around items-center safe-area-bottom shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
          <button 
            onClick={() => navigate('/')}
            className={cn(
              "flex flex-col items-center p-2 transition-all",
              location.pathname === "/" ? "text-primary scale-110" : "text-muted-foreground"
            )}
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px] mt-1 font-medium">Início</span>
          </button>
          
          <button 
            onClick={() => navigate('/ordens-servico')}
            className={cn(
              "flex flex-col items-center p-2 transition-all",
              location.pathname === "/ordens-servico" ? "text-primary scale-110" : "text-muted-foreground"
            )}
          >
            <ClipboardList className="h-5 w-5" />
            <span className="text-[10px] mt-1 font-medium">O.S</span>
          </button>

          {/* Center FAB */}
          <div className="relative -mt-10">
            <Button 
              size="icon" 
              className="h-14 w-14 rounded-full bg-primary shadow-neon hover:scale-110 active:scale-95 transition-all duration-300 border-4 border-background"
              onClick={() => setIsOSFormOpen(true)}
            >
              <Plus className="h-7 w-7 text-primary-foreground" />
            </Button>
          </div>

          <button 
            onClick={() => navigate('/assistente')}
            className={cn(
              "flex flex-col items-center p-2 transition-all",
              location.pathname === "/assistente" ? "text-primary scale-110" : "text-muted-foreground"
            )}
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-[10px] mt-1 font-medium">IA</span>
          </button>

          <button 
            onClick={() => navigate('/configuracoes')}
            className={cn(
              "flex flex-col items-center p-2 transition-all",
              location.pathname === "/configuracoes" ? "text-primary scale-110" : "text-muted-foreground"
            )}
          >
            <Settings2 className="h-5 w-5" />
            <span className="text-[10px] mt-1 font-medium">Ativos</span>
          </button>
        </div>

        {/* Global OS Form for FAB */}
        <OSForm 
          open={isOSFormOpen} 
          onClose={() => setIsOSFormOpen(false)} 
          onSuccess={() => {
            setIsOSFormOpen(false);
            // We can't easily refresh the child component from here, but 
            // most child components use React Query which will auto-refetch
            // or they can be manually refreshed by the user.
          }}
        />
      </div>
    </SidebarProvider>
  );
}

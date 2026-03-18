import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AIChat } from "@/components/AIChat";
import { AIReport } from "@/components/AIReport";
import { Dashboard } from "@/components/Dashboard";
import { ManualUpload } from "@/components/ManualUpload";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Bot,
  Database,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Upload,
  Loader2,
  LogOut,
  User,
  Building2,
  Shield,
  BarChart3,
  Activity,
  Cpu,
  Library,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Index = () => {
  const navigate = useNavigate();
  const { user, profile, roles, isLoading: authLoading, isAdminKraflo, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [stats, setStats] = useState({
    totalOS: 0,
    osIndexadas: 0,
    manuais: 0,
    chunks: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const { count: osCount } = await supabase
        .from("ordens_de_servico")
        .select("*", { count: "exact", head: true })
        .in("status_os", ["Fechada", "Liberado para produção"]);

      const { count: indexedCount } = await supabase
        .from("os_embeddings")
        .select("*", { count: "exact", head: true });

      const { count: manuaisCount } = await supabase
        .from("manuais")
        .select("*", { count: "exact", head: true });

      const { count: chunksCount } = await supabase
        .from("manual_chunks")
        .select("*", { count: "exact", head: true });

      setStats({
        totalOS: osCount || 0,
        osIndexadas: indexedCount || 0,
        manuais: manuaisCount || 0,
        chunks: chunksCount || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const indexAllOS = async () => {
    setIsIndexing(true);
    try {
      const { data, error } = await supabase.functions.invoke("index-os", {
        body: { index_all: true },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success(`${data.indexed} ordens de serviço indexadas com sucesso!`);
      loadStats();
    } catch (error) {
      console.error("Error indexing OS:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao indexar ordens de serviço"
      );
    } finally {
      setIsIndexing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleAskAI = (question: string) => {
    setAiQuestion(question);
    setActiveTab("chat");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Floating Command Bridge Header */}
      <div className="pt-4 px-4 sticky top-0 z-50 w-full mb-6">
        <header className="glass-panel rounded-2xl mx-auto container p-3 flex items-center justify-between shadow-surface glow-border">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Bot className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-foreground">
                  KRAFLO
                </h1>
                <p className="text-xs text-muted-foreground">
                  Sistema de Manutenção Industrial
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick Navigation */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/equipamento")}
                className="hidden md:flex"
              >
                <Cpu className="h-4 w-4 mr-2" />
                Raio-X
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/meu-desempenho")}
                className="hidden md:flex"
              >
                <Activity className="h-4 w-4 mr-2" />
                Meu Desempenho
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/biblioteca")}
                className="hidden md:flex"
              >
                <Library className="h-4 w-4 mr-2" />
                Biblioteca
              </Button>

              {/* Role Badge */}
              {isAdminKraflo ? (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin Kraflo
                </Badge>
              ) : roles.includes('admin_empresa') ? (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                  <Building2 className="h-3 w-3 mr-1" />
                  Admin Empresa
                </Badge>
              ) : null}

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">{profile?.nome_completo || "Usuário"}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
      </div>

      <main className="container mx-auto px-4 pb-6 mt-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Assistente</span>
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </TabsTrigger>
            <TabsTrigger value="manuais" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Manuais</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <Dashboard onAskAI={handleAskAI} />
          </TabsContent>

          <TabsContent value="chat">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Stats Panel */}
              <div className="lg:col-span-1 space-y-4">
                <h2 className="font-mono text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Status do Sistema
                </h2>

                <Card className="p-4 bg-card border-border industrial-card">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-mono font-bold text-foreground">
                        {stats.osIndexadas}/{stats.totalOS}
                      </p>
                      <p className="text-xs text-muted-foreground">OS Indexadas</p>
                    </div>
                  </div>
                  {stats.osIndexadas < stats.totalOS && (
                    <Button
                      onClick={indexAllOS}
                      disabled={isIndexing}
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 border-primary/50 hover:bg-primary/10"
                    >
                      {isIndexing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Indexando...
                        </>
                      ) : (
                        <>
                          <Database className="h-4 w-4 mr-2" />
                          Indexar OS
                        </>
                      )}
                    </Button>
                  )}
                </Card>

                <Card className="p-4 bg-card border-border industrial-card">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-mono font-bold text-foreground">
                        {stats.manuais}
                      </p>
                      <p className="text-xs text-muted-foreground">Manuais</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 bg-secondary/30 border-border">
                  <h3 className="font-mono text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Dicas de Uso
                  </h3>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Descreva o problema com detalhes</li>
                    <li>• Mencione o equipamento específico</li>
                    <li>• Inclua sintomas observados</li>
                    <li>• Pergunte sobre procedimentos</li>
                  </ul>
                </Card>
              </div>

              {/* Chat Area */}
              <div className="lg:col-span-3 h-[calc(100vh-280px)]">
                <AIChat
                  initialQuestion={aiQuestion}
                  onQuestionHandled={() => setAiQuestion(null)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="relatorios">
            <AIReport empresaId={profile?.empresa_id || undefined} />
          </TabsContent>

          <TabsContent value="manuais">
            <div className="max-w-2xl mx-auto">
              <ManualUpload />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;

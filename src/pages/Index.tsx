import { useState, useEffect } from "react";
import { AIChat } from "@/components/AIChat";
import { AIReport } from "@/components/AIReport";
import { Dashboard } from "@/components/Dashboard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Database,
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface IndexProps {
  defaultTab?: string;
}

const Index = ({ defaultTab = "dashboard" }: IndexProps) => {
  const { user, profile, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [stats, setStats] = useState({
    totalOS: 0,
    osIndexadas: 0,
    manuais: 0,
    chunks: 0,
  });

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

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
    <main className="container mx-auto pb-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="hidden container mx-auto">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Assistente</span>
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all">
            <BarChart3 className="h-4 w-4 mr-2" />
            Relatórios IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <Dashboard onAskAI={handleAskAI} />
        </TabsContent>

        <TabsContent value="chat">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
      </Tabs>
    </main>
  );
};

export default Index;

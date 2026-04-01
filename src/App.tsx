import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const OrdensServico = lazy(() => import("./pages/OrdensServico"));
const Biblioteca = lazy(() => import("./pages/Biblioteca"));
const IndexacaoAdmin = lazy(() => import("./pages/IndexacaoAdmin"));
const EquipamentoRaioX = lazy(() => import("./pages/EquipamentoRaioX"));
const PerfilTecnico = lazy(() => import("./pages/PerfilTecnico"));
const NotFound = lazy(() => import("./pages/NotFound"));
import { AppLayout } from "@/components/AppLayout";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={
            <div className="flex h-screen items-center justify-center bg-background">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
          }>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              
              <Route path="/" element={<AppLayout><Index /></AppLayout>} />
              <Route path="/assistente" element={<AppLayout><Index defaultTab="chat" /></AppLayout>} />
              <Route path="/relatorios" element={<AppLayout><Index defaultTab="relatorios" /></AppLayout>} />
              <Route path="/manuais" element={<AppLayout><Index defaultTab="manuais" /></AppLayout>} />
              
              <Route path="/ordens-servico" element={<AppLayout><OrdensServico /></AppLayout>} />

              <Route path="/biblioteca" element={<AppLayout><Biblioteca /></AppLayout>} />
              <Route path="/admin/indexacao" element={<AppLayout><IndexacaoAdmin /></AppLayout>} />
              <Route path="/equipamento" element={<AppLayout><EquipamentoRaioX /></AppLayout>} />
              <Route path="/equipamento/:tag" element={<AppLayout><EquipamentoRaioX /></AppLayout>} />
              <Route path="/meu-desempenho" element={<AppLayout><PerfilTecnico /></AppLayout>} />
              
              <Route path="*" element={<AppLayout><NotFound /></AppLayout>} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

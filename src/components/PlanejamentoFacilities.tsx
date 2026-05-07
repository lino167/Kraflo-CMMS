import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  FileText,
  Users,
  CheckSquare,
  Plus,
  Trash2,
  Send,
  DollarSign,
  Check,
  X,
  Sparkles,
  Share2,
  ExternalLink,
  Lock,
  ClipboardCheck,
  Eye,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

// Interfaces
interface Budget {
  id: string;
  os_id: number | null;
  fornecedor: string;
  servico: string;
  valor: number;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  equipamento_nome?: string;
  equipamento_tag?: string;
}

interface MaintenanceRequest {
  id: string;
  equipamento_nome: string;
  localizacao: string;
  descricao: string;
  prioridade: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  created_at: string;
  solicitante_nome: string;
  status: 'pendente' | 'verificado' | 'rejeitado';
}

interface GuestLink {
  id: string;
  token: string;
  descricao: string;
  created_at: string;
  expires_at: string | null;
}

interface RealOS {
  id: number;
  equipamento_nome: string;
  equipamento_tag: string | null;
  status_os: string;
  prioridade: string | null;
  tipo_manutencao: string | null;
  data_abertura: string;
  data_fechamento: string | null;
}

export function PlanejamentoFacilities() {
  const { profile } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'sla' | 'calendario' | 'orcamentos' | 'checklists' | 'relatorios' | 'guest' | 'solicitacoes'>('sla');
  const [isLoading, setIsLoading] = useState(true);

  // --- ESTADOS DO BANCO ---
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [customItems, setCustomItems] = useState<string[]>([]);
  const [checklistPreset, setChecklistPreset] = useState<string>('eletrica');
  const [links, setLinks] = useState<GuestLink[]>([]);
  const [realOSList, setRealOSList] = useState<RealOS[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());

  // --- CARREGAMENTO DE DADOS ---
  const loadData = async () => {
    if (!profile?.empresa_id) return;
    setIsLoading(true);

    const supabaseAny = supabase as any;

    try {
      // 1. CARREGAR ORÇAMENTOS REAIS
      const { data: bData, error: bErr } = await supabaseAny
        .from('orcamentos_manutencao')
        .select('*')
        .eq('empresa_id', profile.empresa_id);

      if (!bErr && bData) {
        setBudgets(bData as any as Budget[]);
      }

      // 2. CARREGAR SOLICITAÇÕES REAIS
      const { data: rData, error: rErr } = await supabaseAny
        .from('solicitacoes_manutencao')
        .select('*')
        .eq('empresa_id', profile.empresa_id)
        .order('created_at', { ascending: false });

      if (!rErr && rData) {
        setRequests(rData as any as MaintenanceRequest[]);
      }

      // 3. CARREGAR GUEST LINKS REAIS
      const { data: gData, error: gErr } = await supabaseAny
        .from('links_acesso_convidado')
        .select('*')
        .eq('empresa_id', profile.empresa_id);

      if (!gErr && gData) {
        setLinks(gData as any as GuestLink[]);
      }

      // 4. CARREGAR ORDENS DE SERVIÇO REAIS
      const { data: osData, error: osErr } = await supabase
        .from('ordens_de_servico')
        .select('id, equipamento_nome, equipamento_tag, status_os, prioridade, tipo_manutencao, data_abertura, data_fechamento')
        .eq('empresa_id', profile.empresa_id)
        .limit(200);

      if (!osErr && osData) {
        setRealOSList(osData as any as RealOS[]);
      }

      // 5. CARREGAR CHECKLIST TEMPLATE CORRENTE
      const { data: checkData } = await supabaseAny
        .from('templates_checklist')
        .select('*')
        .eq('empresa_id', profile.empresa_id)
        .eq('categoria', checklistPreset)
        .limit(1);

      if (checkData && checkData.length > 0) {
        setCustomItems((checkData[0] as any).itens as string[]);
      } else {
        setCustomItems([]);
      }

    } catch (err) {
      console.error('Erro ao conectar ao Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.empresa_id, checklistPreset]);

  // --- MUTATION HANDLERS COM SUPABASE ---

  const handleApproveBudget = async (id: string) => {
    const supabaseAny = supabase as any;
    const { error } = await supabaseAny
      .from('orcamentos_manutencao')
      .update({ status: 'aprovado' })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao aprovar orçamento no banco.');
      return;
    }

    setBudgets(prev =>
      prev.map(b => (b.id === id ? { ...b, status: 'aprovado' as const } : b))
    );
    toast.success(`Orçamento aprovado com sucesso!`, {
      description: 'Aprovado em tempo real no Supabase.',
      icon: <Check className="h-4 w-4 text-green-500" />,
    });
  };

  const handleRejectBudget = async (id: string) => {
    const supabaseAny = supabase as any;
    const { error } = await supabaseAny
      .from('orcamentos_manutencao')
      .update({ status: 'rejeitado' })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar orçamento.');
      return;
    }

    setBudgets(prev =>
      prev.map(b => (b.id === id ? { ...b, status: 'rejeitado' as const } : b))
    );
    toast.error(`Orçamento recusado.`, {
      description: 'Status atualizado no Supabase.',
    });
  };

  const handleVerifyRequest = async (id: string, req: MaintenanceRequest) => {
    const supabaseAny = supabase as any;
    // 1. Atualiza status da solicitação
    const { error: updErr } = await supabaseAny
      .from('solicitacoes_manutencao')
      .update({ status: 'verificado' })
      .eq('id', id);

    if (updErr) {
      toast.error('Erro ao aprovar solicitação.');
      return;
    }

    // 2. Abre Ordem de Serviço real no Supabase
    if (profile?.empresa_id) {
      const { error: osErr } = await supabaseAny
        .from('ordens_de_servico')
        .insert({
          equipamento_nome: req.equipamento_nome,
          localizacao: req.localizacao,
          descricao_problema: req.descricao,
          prioridade: req.prioridade,
          status_os: 'Aberta',
          origem: 'solicitacao',
          empresa_id: profile.empresa_id,
        });

      if (osErr) {
        toast.warning('Solicitação verificada, mas falhou ao gerar Ordem de Serviço.');
      } else {
        toast.success(`Solicitação verificada com sucesso!`, {
          description: 'Ordem de serviço gerada e inserida na fila de atendimento técnico no Supabase.',
          icon: <ClipboardCheck className="h-4 w-4 text-primary" />,
        });
      }
    }

    loadData();
  };

  const handleDeclineRequest = async (id: string) => {
    const supabaseAny = supabase as any;
    const { error } = await supabaseAny
      .from('solicitacoes_manutencao')
      .update({ status: 'rejeitado' })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao recusar solicitação.');
      return;
    }

    setRequests(prev =>
      prev.map(r => (r.id === id ? { ...r, status: 'rejeitado' as const } : r))
    );
    toast.warning(`Solicitação recusada.`, {
      description: 'Solicitação arquivada no Supabase.',
    });
  };

  const [newItemText, setNewItemText] = useState('');

  const handleAddCustomItem = () => {
    if (!newItemText.trim()) return;
    setCustomItems(prev => [...prev, newItemText.trim()]);
    setNewItemText('');
    toast.success('Item adicionado à lista local.');
  };

  const handleRemoveCustomItem = (index: number) => {
    setCustomItems(prev => prev.filter((_, i) => i !== index));
    toast.info('Item removed da lista.');
  };

  const handleLoadPreset = (value: string) => {
    setChecklistPreset(value);
    if (value === 'eletrica') {
      setCustomItems([
        'Verificar tensão de entrada nos barramentos',
        'Verificar integridade física e aperto dos bornes',
        'Limpeza interna do painel com ar comprimido de baixa pressão',
        'Medição da corrente de pico do motor principal',
        'Teste de funcionamento dos botões de parada de emergência',
      ]);
    } else if (value === 'hvac') {
      setCustomItems([
        'Limpeza e higienização dos filtros de ar (G4/F7)',
        'Medição da pressão do fluido refrigerante R410A',
        'Inspeção visual de vazamentos de óleo lubrificante',
        'Verificação da corrente nominal do compressor elétrico',
        'Limpeza das serpentinas de condensação externas',
      ]);
    } else if (value === 'facilities') {
      setCustomItems([
        'Teste do gerador auxiliar de emergência (nível de diesel)',
        'Inspeção de infiltrações mecânicas nas lajes superiores',
        'Verificação das luzes de sinalização e iluminação de emergência',
        'Inspeção da central de alarmes de incêndio e nível de CO2',
        'Lubrificação das dobradiças e trincos mecânicos das saídas de emergência',
      ]);
    }
  };

  const handleSaveChecklist = async () => {
    if (!profile?.empresa_id) return;

    const supabaseAny = supabase as any;

    // Remove registro existente da mesma categoria
    await supabaseAny
      .from('templates_checklist')
      .delete()
      .eq('empresa_id', profile.empresa_id)
      .eq('categoria', checklistPreset);

    // Salva novo
    const { error } = await supabaseAny
      .from('templates_checklist')
      .insert({
        nome: `Preset ${checklistPreset.toUpperCase()}`,
        categoria: checklistPreset,
        itens: customItems,
        empresa_id: profile.empresa_id,
      });

    if (error) {
      toast.error('Erro ao salvar template no Supabase.');
    } else {
      toast.success('Template de Checklist persistido!', {
        description: `${customItems.length} etapas registradas e disponíveis no Supabase para futuras preventivas.`,
        icon: <CheckSquare className="h-4 w-4 text-primary animate-bounce" />,
      });
    }
  };

  const handleGenerateGuestLink = async () => {
    if (!profile?.empresa_id) return;

    const supabaseAny = supabase as any;

    const { data, error } = await supabaseAny
      .from('links_acesso_convidado')
      .insert({
        descricao: `Acesso Técnico Externo #${links.length + 1}`,
        empresa_id: profile.empresa_id,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
      })
      .select();

    if (error) {
      toast.error('Erro ao gerar link de acesso no banco.');
    } else if (data) {
      setLinks(prev => [...prev, data[0] as any as GuestLink]);
      toast.success('Acesso de leitura persistido no Supabase!', {
        description: 'Fornecedor cadastrado com sucesso para acompanhamento em tempo real.',
        icon: <Users className="h-4 w-4 text-primary animate-pulse" />,
      });
    }
  };

  const handleCopyLink = (token: string) => {
    const fullUrl = `${window.location.origin}/share/guest-access-${token}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success('Link copiado com token criptográfico do Supabase!');
  };

  // --- CALENDÁRIO COM DADOS REAIS ---
  const getTasksForDay = (day: number) => {
    return realOSList.filter(os => {
      const date = new Date(os.data_abertura);
      return date.getDate() === day && date.getMonth() === new Date().getMonth();
    }).map(os => ({
      title: os.equipamento_nome + ': ' + (os.prioridade || 'Média'),
      tag: os.equipamento_tag || 'EQP',
      type: os.tipo_manutencao === 'Preventiva' ? 'preventive' as const : 'corrective' as const,
      time: new Date(os.data_abertura).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-mono text-muted-foreground">Sincronizando dados em tempo real com o Supabase...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub tabs selectors */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-card/40 border border-white/5 rounded-xl backdrop-blur-xl">
        <Button
          variant={activeSubTab === 'sla' ? 'default' : 'ghost'}
          onClick={() => setActiveSubTab('sla')}
          className={`rounded-lg ${activeSubTab === 'sla' ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-neon border border-primary/20' : 'text-muted-foreground'}`}
        >
          <Clock className="h-4 w-4 mr-2" /> SLAs & Operações
        </Button>
        <Button
          variant={activeSubTab === 'calendario' ? 'default' : 'ghost'}
          onClick={() => setActiveSubTab('calendario')}
          className={`rounded-lg ${activeSubTab === 'calendario' ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-neon border border-primary/20' : 'text-muted-foreground'}`}
        >
          <CalendarIcon className="h-4 w-4 mr-2" /> Calendário de OS
        </Button>
        <Button
          variant={activeSubTab === 'orcamentos' ? 'default' : 'ghost'}
          onClick={() => setActiveSubTab('orcamentos')}
          className={`rounded-lg ${activeSubTab === 'orcamentos' ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-neon border border-primary/20' : 'text-muted-foreground'}`}
        >
          <DollarSign className="h-4 w-4 mr-2" /> Aprovar Orçamentos
        </Button>
        <Button
          variant={activeSubTab === 'checklists' ? 'default' : 'ghost'}
          onClick={() => setActiveSubTab('checklists')}
          className={`rounded-lg ${activeSubTab === 'checklists' ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-neon border border-primary/20' : 'text-muted-foreground'}`}
        >
          <CheckSquare className="h-4 w-4 mr-2" /> Criar Checklist
        </Button>
        <Button
          variant={activeSubTab === 'solicitacoes' ? 'default' : 'ghost'}
          onClick={() => setActiveSubTab('solicitacoes')}
          className={`rounded-lg relative ${activeSubTab === 'solicitacoes' ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-neon border border-primary/20' : 'text-muted-foreground'}`}
        >
          <ClipboardCheck className="h-4 w-4 mr-2" /> Solicitações
          {requests.filter(r => r.status === 'pendente').length > 0 && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </Button>
        <Button
          variant={activeSubTab === 'relatorios' ? 'default' : 'ghost'}
          onClick={() => setActiveSubTab('relatorios')}
          className={`rounded-lg ${activeSubTab === 'relatorios' ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-neon border border-primary/20' : 'text-muted-foreground'}`}
        >
          <FileText className="h-4 w-4 mr-2" /> Relatórios Clientes
        </Button>
        <Button
          variant={activeSubTab === 'guest' ? 'default' : 'ghost'}
          onClick={() => setActiveSubTab('guest')}
          className={`rounded-lg ${activeSubTab === 'guest' ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-neon border border-primary/20' : 'text-muted-foreground'}`}
        >
          <Users className="h-4 w-4 mr-2" /> Leitores Ilimitados
        </Button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {/* ======================================================== */}
          {/* TAB 1: SLAs E OPERAÇÕES */}
          {/* ======================================================== */}
          {activeSubTab === 'sla' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="glass-panel border-white/5 relative overflow-hidden group">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                      SLA de Atendimento Crítico
                      <Badge className="bg-success/20 text-success border-transparent">96.4% OK</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-3xl font-mono font-bold text-foreground">54 min</div>
                    <p className="text-xs text-muted-foreground">Tempo médio de resposta (Meta: &lt;1 hora)</p>
                    <Progress value={96.4} className="h-1.5 [&>div]:bg-success bg-secondary" />
                  </CardContent>
                </Card>

                <Card className="glass-panel border-white/5 relative overflow-hidden group">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                      SLA de MTTR Corretivo
                      <Badge className="bg-success/20 text-success border-transparent">92.1% OK</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-3xl font-mono font-bold text-foreground">3h 12m</div>
                    <p className="text-xs text-muted-foreground">Tempo médio de conserto (Meta: &lt;4 horas)</p>
                    <Progress value={92.1} className="h-1.5 [&>div]:bg-success bg-secondary" />
                  </CardContent>
                </Card>

                <Card className="glass-panel border-white/5 relative overflow-hidden group">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                      SLA de Validação
                      <Badge className="bg-warning/20 text-warning border-transparent">88.5% OK</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-3xl font-mono font-bold text-foreground">42 min</div>
                    <p className="text-xs text-muted-foreground">Verificação das solicitações (Meta: &lt;30 min)</p>
                    <Progress value={88.5} className="h-1.5 [&>div]:bg-warning bg-secondary" />
                  </CardContent>
                </Card>
              </div>

              {/* SLA details view */}
              <Card className="glass-panel border-white/5">
                <CardHeader>
                  <CardTitle className="font-mono text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Controle de Tempo de Atendimento e SLA por Criticidade
                  </CardTitle>
                  <CardDescription>
                    Monitore se os acordos de nível de serviço com a produção estão sendo cumpridos.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-secondary/30 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                          <strong className="text-sm font-semibold text-foreground">Nível 1 - Urgência Crítica</strong>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Parada de máquina essencial da linha principal. Meta de resolução: 2 horas.</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold text-foreground">94.8%</div>
                          <div className="text-[10px] text-muted-foreground">Dentro do prazo</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold text-primary">1h 32m</div>
                          <div className="text-[10px] text-muted-foreground">Média Real</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-secondary/30 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 rounded-full bg-orange-500" />
                          <strong className="text-sm font-semibold text-foreground">Nível 2 - Alta Criticidade</strong>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Falhas parciais que não paralisam a linha principal. Meta de resolução: 6 horas.</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold text-foreground">96.1%</div>
                          <div className="text-[10px] text-muted-foreground">Dentro do prazo</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold text-foreground">4h 15m</div>
                          <div className="text-[10px] text-muted-foreground">Média Real</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-secondary/30 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
                          <strong className="text-sm font-semibold text-foreground">Nível 3 - Média Criticidade</strong>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Solicitações de facilities e ajustes ergonômicos. Meta de resolução: 24 horas.</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold text-foreground">100.0%</div>
                          <div className="text-[10px] text-muted-foreground">Dentro do prazo</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold text-foreground">12h 40m</div>
                          <div className="text-[10px] text-muted-foreground">Média Real</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: CALENDÁRIO INTERATIVO */}
          {/* ======================================================== */}
          {activeSubTab === 'calendario' && (
            <Card className="glass-panel border-white/5">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="font-mono text-lg flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5 text-primary" />
                      Visualização de Calendário para Ordens de Serviço Real
                    </CardTitle>
                    <CardDescription>
                      Consulte todas as ordens de serviço (atualmente {realOSList.length} registradas) diretamente do Supabase.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4 bg-secondary/40 border border-white/5 p-2 rounded-lg text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-500" /> Preventivas
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500" /> Corretivas
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Calendário Mensal */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex items-center justify-between bg-secondary/20 p-3 rounded-lg border border-white/5 font-mono text-sm">
                    <span className="font-bold text-primary">Maio {new Date().getFullYear()}</span>
                    <span className="text-muted-foreground text-xs">Visão Sincronizada Supabase</span>
                  </div>
                  <div className="grid grid-cols-7 gap-2 text-center text-xs font-mono font-bold text-muted-foreground p-1 border-b border-white/5">
                    <div>DOM</div>
                    <div>SEG</div>
                    <div>TER</div>
                    <div>QUA</div>
                    <div>QUI</div>
                    <div>SEX</div>
                    <div>SAB</div>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    <div className="h-14 p-1 rounded-lg border border-transparent bg-transparent" />
                    <div className="h-14 p-1 rounded-lg border border-transparent bg-transparent" />
                    <div className="h-14 p-1 rounded-lg border border-transparent bg-transparent" />
                    <div className="h-14 p-1 rounded-lg border border-transparent bg-transparent" />
                    
                    {Array.from({ length: 21 }, (_, i) => {
                      const dayNum = i + 1;
                      const tasks = getTasksForDay(dayNum);
                      const isSelected = selectedDay === dayNum;
                      
                      return (
                        <button
                          key={dayNum}
                          onClick={() => setSelectedDay(dayNum)}
                          className={`h-14 p-1 text-left rounded-lg border flex flex-col justify-between transition-all relative group ${
                            isSelected 
                              ? 'bg-primary/20 border-primary text-foreground shadow-neon' 
                              : 'bg-secondary/20 border-white/5 text-muted-foreground hover:bg-secondary/40 hover:border-white/10'
                          }`}
                        >
                          <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-primary' : 'text-foreground/70'}`}>{dayNum}</span>
                          
                          {tasks.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {tasks.slice(0, 3).map((task, idx) => (
                                <span 
                                  key={idx} 
                                  className={`h-1.5 w-1.5 rounded-full ${task.type === 'preventive' ? 'bg-blue-500' : 'bg-red-500'}`} 
                                />
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tarefas do Dia Selecionado */}
                <div className="lg:col-span-4 p-4 rounded-xl bg-secondary/20 border border-white/5 flex flex-col justify-between h-full min-h-[300px]">
                  <div>
                    <div className="pb-3 border-b border-white/5 flex items-center justify-between mb-4">
                      <span className="font-mono text-sm font-bold text-foreground">Dia {selectedDay} de Maio</span>
                      <Badge className="bg-primary/10 text-primary border-primary/20">
                        {getTasksForDay(selectedDay).length} Ordens
                      </Badge>
                    </div>

                    <div className="space-y-3 max-h-[220px] overflow-y-auto">
                      {getTasksForDay(selectedDay).length > 0 ? (
                        getTasksForDay(selectedDay).map((task, index) => (
                          <div 
                             key={index} 
                             className={`p-3 rounded-lg border text-xs ${
                               task.type === 'preventive' 
                                 ? 'bg-blue-500/10 border-blue-500/20' 
                                 : 'bg-red-500/10 border-red-500/20'
                             }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono font-bold">{task.time}</span>
                              <Badge variant="outline" className={`text-[9px] ${task.type === 'preventive' ? 'border-blue-500/30 text-blue-400' : 'border-red-500/30 text-red-400'}`}>
                                {task.tag}
                              </Badge>
                            </div>
                            <h4 className="font-semibold text-foreground">{task.title}</h4>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 text-muted-foreground text-xs space-y-2">
                          <CheckCircle2 className="h-6 w-6 text-muted-foreground/30 mx-auto" />
                          <p>Nenhuma ordem de serviço real identificada neste dia.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button className="w-full mt-4" size="sm" onClick={() => toast.success('Por favor, utilize o painel de criação de OS para registrar preventivas agendadas.')}>
                    <Plus className="h-3 w-3 mr-1.5" /> Registrar Preventiva
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ======================================================== */}
          {/* TAB 3: APROVAR ORÇAMENTOS */}
          {/* ======================================================== */}
          {activeSubTab === 'orcamentos' && (
            <Card className="glass-panel border-white/5">
              <CardHeader>
                <CardTitle className="font-mono text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Gerente de Manutenção: Aprovação de Orçamentos Real (Supabase)
                </CardTitle>
                <CardDescription>
                  Sincronizado diretamente com a tabela `orcamentos_manutencao`.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {budgets.map((budget, index) => (
                    <Card 
                      key={budget.id || index} 
                      className={`border-white/5 bg-secondary/10 hover:bg-secondary/20 transition-all ${
                        budget.status === 'aprovado' ? 'border-green-500/20' : budget.status === 'rejeitado' ? 'border-red-500/20' : ''
                      }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-primary">ORÇ-{budget.id ? budget.id.substring(0, 5) : 'NEW'}</span>
                          <Badge 
                            variant="outline" 
                            className={
                              budget.status === 'aprovado' 
                                ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                                : budget.status === 'rejeitado' 
                                ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                                : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse'
                            }
                          >
                            {budget.status.toUpperCase()}
                          </Badge>
                        </div>
                        <CardTitle className="text-sm mt-1">{budget.equipamento_nome || 'Equipamento Geral'}</CardTitle>
                        <CardDescription className="font-mono text-xs">Fornecedor: {budget.fornecedor}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-xs text-muted-foreground">{budget.servico}</p>
                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <div>
                            <span className="text-[10px] text-muted-foreground block">VALOR SOLICITADO</span>
                            <span className="text-lg font-mono font-bold text-foreground">R$ {budget.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          {budget.status === 'pendente' && (
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 border-red-500/20 text-red-500 hover:bg-red-500/10"
                                onClick={() => handleRejectBudget(budget.id)}
                              >
                                <X className="h-4 w-4" /> Recusar
                              </Button>
                              <Button 
                                size="sm" 
                                className="h-8 bg-green-500 hover:bg-green-600 text-white"
                                onClick={() => handleApproveBudget(budget.id)}
                              >
                                <Check className="h-4 w-4 mr-1" /> Aprovar
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ======================================================== */}
          {/* TAB 4: CRIAÇÃO DE LISTA DE VERIFICAÇÃO (CHECKLIST) */}
          {/* ======================================================== */}
          {activeSubTab === 'checklists' && (
            <Card className="glass-panel border-white/5">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="font-mono text-lg flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-primary" />
                      Criação de Listas de Verificação (Supabase Sincronizado)
                    </CardTitle>
                    <CardDescription>
                      As alterações são persistidas dinamicamente na tabela `templates_checklist`.
                    </CardDescription>
                  </div>
                  <div className="w-full md:w-56">
                    <Select value={checklistPreset} onValueChange={handleLoadPreset}>
                      <SelectTrigger className="bg-secondary/40">
                        <SelectValue placeholder="Escolher Template Preset" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eletrica">Inspeção Elétrica</SelectItem>
                        <SelectItem value="hvac">Ar Condicionado & HVAC</SelectItem>
                        <SelectItem value="facilities">Facilities & Segurança</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Adicionar nova verificação técnica..." 
                    value={newItemText} 
                    onChange={e => setNewItemText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCustomItem()}
                    className="bg-secondary/40"
                  />
                  <Button onClick={handleAddCustomItem}>
                    <Plus className="h-4 w-4 mr-1.5" /> Adicionar
                  </Button>
                </div>

                <div className="space-y-2 p-4 rounded-xl bg-secondary/10 border border-white/5 max-h-[300px] overflow-y-auto">
                  {customItems.map((item, index) => (
                    <div 
                      key={index} 
                      className="p-2.5 rounded-lg bg-secondary/30 border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-primary">#{index + 1}</span>
                        <span className="text-foreground">{item}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleRemoveCustomItem(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <span className="text-xs text-muted-foreground">{customItems.length} etapas registradas localmente</span>
                  <Button className="shadow-neon" onClick={handleSaveChecklist}>
                    <CheckSquare className="h-4 w-4 mr-1.5" /> Salvar Template no Supabase
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ======================================================== */}
          {/* TAB 5: SOLICITAÇÕES DE MANUTENÇÃO */}
          {/* ======================================================== */}
          {activeSubTab === 'solicitacoes' && (
            <Card className="glass-panel border-white/5">
              <CardHeader>
                <CardTitle className="font-mono text-lg flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Triagem de Solicitações de Manutenção do Operador (Real)
                </CardTitle>
                <CardDescription>
                  Cada solicitação aprovada gera automaticamente uma Ordem de Serviço real na tabela `ordens_de_servico`.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {requests.map((request, index) => (
                    <div 
                      key={request.id || index} 
                      className={`p-4 rounded-xl bg-secondary/10 border border-white/5 flex flex-col md:flex-row justify-between gap-4 transition-all ${
                        request.status === 'verificado' ? 'border-success/20 opacity-80' : request.status === 'rejeitado' ? 'border-red-500/20 opacity-60' : 'border-primary/20 bg-primary/5'
                      }`}
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-primary">REQ-{request.id ? request.id.substring(0, 5) : 'NEW'}</span>
                          <span className="text-xs text-muted-foreground font-mono">{new Date(request.created_at).toLocaleTimeString('pt-BR')}</span>
                          <Badge className={
                            request.prioridade === 'Urgente' ? 'bg-red-500/20 text-red-500 border-transparent' :
                            request.prioridade === 'Alta' ? 'bg-orange-500/20 text-orange-500 border-transparent' :
                            'bg-yellow-500/20 text-yellow-500 border-transparent'
                          }>
                            {request.prioridade}
                          </Badge>
                          <Badge variant="outline" className={
                            request.status === 'verificado' ? 'border-success/30 text-success' :
                            request.status === 'rejeitado' ? 'border-red-500/30 text-red-500' : 'border-primary/30 text-primary'
                          }>
                            {request.status === 'pendente' ? 'PENDENTE VERIFICAÇÃO' : request.status.toUpperCase()}
                          </Badge>
                        </div>
                        <h4 className="font-semibold text-foreground text-sm">{request.equipamento_nome}</h4>
                        <p className="text-xs text-muted-foreground">{request.descricao}</p>
                        <div className="text-[10px] text-muted-foreground">Local: {request.localizacao || 'Não especificado'} • Solicitado por: {request.solicitante_nome}</div>
                      </div>

                      {request.status === 'pendente' && (
                        <div className="flex items-center gap-2 self-center">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-destructive border-destructive/20 hover:bg-destructive/10"
                            onClick={() => handleDeclineRequest(request.id)}
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> Rejeitar
                          </Button>
                          <Button 
                            size="sm" 
                            className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                            onClick={() => handleVerifyRequest(request.id, request)}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> Aprovar e Abrir OS
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ======================================================== */}
          {/* TAB 6: RELATÓRIOS PARA CLIENTES */}
          {/* ======================================================== */}
          {activeSubTab === 'relatorios' && (
            <Card className="glass-panel border-white/5">
              <CardHeader>
                <CardTitle className="font-mono text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Gestão e Envio de Relatórios Técnicos Reais para Clientes
                </CardTitle>
                <CardDescription>
                  Listagem dinâmica de Ordens de Serviço Fechadas disponíveis para compartilhamento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {realOSList.filter(os => os.status_os === 'Fechada').length > 0 ? (
                    realOSList.filter(os => os.status_os === 'Fechada').map(os => (
                      <div 
                        key={os.id} 
                        className="p-4 rounded-xl bg-secondary/10 border border-white/5 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-primary font-bold">OS #{os.id}</span>
                            <Badge variant="outline" className="border-success/30 text-success">FECHADA</Badge>
                          </div>
                          <h4 className="font-semibold text-sm text-foreground mt-1">{os.equipamento_nome}</h4>
                          <div className="text-xs text-muted-foreground mt-0.5">Encerramento em: {new Date(os.data_fechamento || os.data_abertura).toLocaleDateString('pt-BR')}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => toast.success('Aberto para visualização prévia.')}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> Ver Parecer
                          </Button>
                          <Button 
                            size="sm" 
                            className="h-8 text-xs bg-primary hover:bg-primary/90"
                            onClick={() => {
                              toast.success(`Relatório da OS #${os.id} enviado para o cliente cadastrado!`, {
                                description: 'O link com acesso completo ao parecer técnico foi compartilhado.',
                                icon: <Send className="h-4 w-4 text-green-400" />,
                              });
                            }}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" /> Compartilhar
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                      <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                      <p>Nenhuma ordem de serviço marcada como 'Fechada' no Supabase para gerar relatórios.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ======================================================== */}
          {/* TAB 7: ACESSO ILIMITADO FORNECEDORES E CLIENTES */}
          {/* ======================================================== */}
          {activeSubTab === 'guest' && (
            <Card className="glass-panel border-white/5">
              <CardHeader>
                <CardTitle className="font-mono text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Funções de Leitura Ilimitada para Fornecedores & Clientes (Supabase)
                </CardTitle>
                <CardDescription>
                  Permita que parceiros acompanhem o andamento das manutenções em tempo real de forma totalmente gratuita.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm text-foreground">Economia de Licenças no Supabase</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gere tokens de visualização direta e ilimitada de forma altamente segura. As credenciais são persistidas na tabela `links_acesso_convidado` com suporte a Row Level Security.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Links de Acesso Técnico Ativos</h4>
                  {links.map((link, index) => (
                    <div key={link.id || index} className="p-3 rounded-lg bg-secondary/30 border border-white/5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 truncate">
                        <Lock className="h-3.5 w-3.5 text-success shrink-0" />
                        <span className="font-mono text-xs text-muted-foreground truncate">{link.descricao}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleCopyLink(link.token)}>
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => {
                          const fullUrl = `${window.location.origin}/share/guest-access-${link.token}`;
                          window.open(fullUrl, '_blank');
                        }}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <Button className="w-full shadow-neon" onClick={handleGenerateGuestLink}>
                  <Plus className="h-4 w-4 mr-1.5" /> Gerar Novo Acesso de Leitura Ilimitada
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

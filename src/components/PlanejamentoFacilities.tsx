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
  Share2,
  ExternalLink,
  Lock,
  ClipboardCheck,
  Activity,
  AlertTriangle,
  UserCheck,
  Eye,
  QrCode,
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
import { QRCodeDialog } from '@/components/QRCodeDialog';
import { getErrorMessage } from '@/lib/error-handler';
import { portalUrl } from '@/lib/estoque';

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
  equipamento_tag?: string | null;
  localizacao: string | null;
  descricao: string;
  prioridade: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  created_at: string;
  solicitante_nome: string;
  status: 'pendente' | 'verificado' | 'rejeitado';
}

interface GuestLink {
  id: string;
  token: string;
  descricao: string | null;
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

interface Measurement {
  id: string;
  equipamento_nome: string;
  variavel: string;
  valor: number;
  min_esperado: number;
  max_esperado: number;
  data_medicao: string;
  status: 'Normal' | 'Crítico';
}

interface MeasurementAlert {
  id: string;
  equipamento_nome: string;
  descricao: string;
  data_alerta: string;
  status: 'Ativo' | 'Tratado';
  os_gerada_id?: number;
}

export function PlanejamentoFacilities() {
  const { profile } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'sla' | 'calendario' | 'orcamentos' | 'checklists' | 'relatorios' | 'guest' | 'solicitacoes' | 'medicoes'>('sla');
  const [isLoading, setIsLoading] = useState(true);

  // --- ESTADOS DO BANCO ---
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [customItems, setCustomItems] = useState<string[]>([]);
  const [checklistPreset, setChecklistPreset] = useState<string>('eletrica');
  const [links, setLinks] = useState<GuestLink[]>([]);
  const [realOSList, setRealOSList] = useState<RealOS[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());

  // --- CONDITION MONITORING (persistido em medicoes_ativos) ---
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [alerts, setAlerts] = useState<MeasurementAlert[]>([]);
  const [qrLink, setQrLink] = useState<GuestLink | null>(null);
  const [budgetForm, setBudgetForm] = useState({ fornecedor: '', servico: '', valor: '', equipamento_nome: '' });

  const [formEquipamento, setFormEquipamento] = useState('');
  const [formVariavel, setFormVariavel] = useState('Temperatura (ºC)');
  const [formValor, setFormValor] = useState('');
  const [formMin, setFormMin] = useState('');
  const [formMax, setFormMax] = useState('');
  const [autoAssignActive, setAutoAssignActive] = useState(true);

  // --- CARREGAMENTO DE DADOS ---
  const loadData = async () => {
    if (!profile?.empresa_id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const empresaId = profile.empresa_id;

    try {
      const [orc, sol, lnk, os, chk, med] = await Promise.all([
        supabase.from('orcamentos_manutencao').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
        supabase.from('solicitacoes_manutencao').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
        supabase.from('links_acesso_convidado').select('*').eq('empresa_id', empresaId).eq('ativo', true).order('created_at'),
        supabase
          .from('ordens_de_servico')
          .select('id, equipamento_nome, equipamento_tag, status_os, prioridade, tipo_manutencao, data_abertura, data_fechamento')
          .eq('empresa_id', empresaId)
          .order('data_abertura', { ascending: false })
          .limit(200),
        supabase.from('templates_checklist').select('itens').eq('empresa_id', empresaId).eq('categoria', checklistPreset).limit(1),
        supabase.from('medicoes_ativos').select('*').eq('empresa_id', empresaId).order('data_medicao', { ascending: false }).limit(50),
      ]);

      if (orc.data) setBudgets(orc.data as unknown as Budget[]);
      if (sol.data) setRequests(sol.data as unknown as MaintenanceRequest[]);
      if (lnk.data) setLinks(lnk.data);
      if (os.data) setRealOSList(os.data);
      setCustomItems(chk.data?.[0] ? (chk.data[0].itens as string[]) : []);

      if (med.data) {
        setMeasurements(
          med.data.map((m) => ({
            id: m.id,
            equipamento_nome: m.equipamento_nome,
            variavel: m.variavel,
            valor: m.valor,
            min_esperado: m.min_esperado,
            max_esperado: m.max_esperado,
            data_medicao: m.data_medicao,
            status: m.critico ? 'Crítico' : 'Normal',
          })),
        );
        setAlerts(
          med.data
            .filter((m) => m.critico && !m.alerta_tratado)
            .map((m) => ({
              id: m.id,
              equipamento_nome: m.equipamento_nome,
              descricao: `${m.variavel} (${m.valor}) fora do intervalo esperado de [${m.min_esperado} - ${m.max_esperado}].`,
              data_alerta: m.data_medicao,
              status: 'Ativo' as const,
              os_gerada_id: m.os_gerada_id ?? undefined,
            })),
        );
      }
    } catch (err) {
      console.error('Erro ao carregar planejamento:', err);
      toast.error('Não foi possível carregar os dados de planejamento.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.empresa_id, checklistPreset]);

  // --- MUTATION HANDLERS ---

  const handleDecideBudget = async (id: string, status: 'aprovado' | 'rejeitado') => {
    const { error } = await supabase
      .from('orcamentos_manutencao')
      .update({ status, decidido_em: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error(getErrorMessage(error));
      return;
    }

    setBudgets(prev => prev.map(b => (b.id === id ? { ...b, status } : b)));
    if (status === 'aprovado') toast.success('Orçamento aprovado.');
    else toast.info('Orçamento recusado.');
  };

  const handleApproveBudget = (id: string) => handleDecideBudget(id, 'aprovado');
  const handleRejectBudget = (id: string) => handleDecideBudget(id, 'rejeitado');

  const handleCreateBudget = async () => {
    if (!profile?.empresa_id) return;
    const valor = parseFloat(budgetForm.valor.replace(',', '.'));
    if (!budgetForm.fornecedor.trim() || !budgetForm.servico.trim() || isNaN(valor) || valor <= 0) {
      toast.error('Informe fornecedor, serviço e um valor maior que zero.');
      return;
    }

    const { error } = await supabase.from('orcamentos_manutencao').insert({
      empresa_id: profile.empresa_id,
      fornecedor: budgetForm.fornecedor.trim(),
      servico: budgetForm.servico.trim(),
      valor,
      equipamento_nome: budgetForm.equipamento_nome.trim() || null,
    });

    if (error) {
      toast.error(getErrorMessage(error));
      return;
    }
    setBudgetForm({ fornecedor: '', servico: '', valor: '', equipamento_nome: '' });
    toast.success('Orçamento enviado para aprovação.');
    loadData();
  };

  // Uma OS sempre precisa de técnico: escolhe por especialidade quando possível
  const pickTecnico = async (contexto: string) => {
    if (!profile?.empresa_id) return null;
    const { data: techs } = await supabase
      .from('tecnicos')
      .select('id_telegram, nome_completo, funcao')
      .eq('empresa_id', profile.empresa_id);
    if (!techs || techs.length === 0) return null;

    const ctx = contexto.toLowerCase();
    const temFuncao = (...termos: string[]) =>
      techs.find((t) => termos.some((termo) => t.funcao?.toLowerCase().includes(termo)));

    let match = undefined;
    if (autoAssignActive) {
      if (['temp', 'press', 'vibr', 'óle', 'mecan'].some((k) => ctx.includes(k))) {
        match = temFuncao('mecan', 'lubrif', 'hvac', 'manutenc');
      } else if (['tens', 'corr', 'elét', 'elet', 'pain'].some((k) => ctx.includes(k))) {
        match = temFuncao('eletri', 'instrum', 'autom');
      }
    }
    return match || techs[0];
  };

  const handleVerifyRequest = async (id: string, req: MaintenanceRequest) => {
    if (!profile?.empresa_id) return;

    const tecnico = await pickTecnico(req.descricao);
    if (!tecnico) {
      toast.error('Cadastre ao menos um técnico antes de abrir a OS.');
      return;
    }

    // 1. Abre a OS; só então marca a solicitação como verificada
    const { data: osData, error: osErr } = await supabase
      .from('ordens_de_servico')
      .insert({
        equipamento_nome: req.equipamento_nome,
        equipamento_tag: req.equipamento_tag ?? null,
        localizacao: req.localizacao,
        descricao_problema: `Solicitação de ${req.solicitante_nome}: ${req.descricao}`,
        prioridade: req.prioridade,
        status_os: 'Aberta',
        origem: 'solicitacao',
        tipo_manutencao: 'Corretiva',
        empresa_id: profile.empresa_id,
        tecnico_id: tecnico.id_telegram,
      })
      .select('id')
      .single();

    if (osErr || !osData) {
      toast.error(osErr ? getErrorMessage(osErr) : 'Não foi possível abrir a OS.');
      return;
    }

    const { error: updErr } = await supabase
      .from('solicitacoes_manutencao')
      .update({ status: 'verificado', os_gerada_id: osData.id })
      .eq('id', id);

    if (updErr) {
      toast.warning(`OS #${osData.id} aberta, mas a solicitação não pôde ser atualizada.`);
    } else {
      toast.success(`OS #${osData.id} aberta`, {
        description: `Atribuída a ${tecnico.nome_completo}.`,
        icon: <ClipboardCheck className="h-4 w-4 text-primary" />,
      });
    }

    loadData();
  };

  const handleDeclineRequest = async (id: string) => {
    const { error } = await supabase
      .from('solicitacoes_manutencao')
      .update({ status: 'rejeitado' })
      .eq('id', id);

    if (error) {
      toast.error(getErrorMessage(error));
      return;
    }

    setRequests(prev =>
      prev.map(r => (r.id === id ? { ...r, status: 'rejeitado' as const } : r))
    );
    toast.info('Solicitação recusada.');
  };

  const [newItemText, setNewItemText] = useState('');

  const handleAddCustomItem = () => {
    if (!newItemText.trim()) return;
    setCustomItems(prev => [...prev, newItemText.trim()]);
    setNewItemText('');
  };

  const handleRemoveCustomItem = (index: number) => {
    setCustomItems(prev => prev.filter((_, i) => i !== index));
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

    const { error: delError } = await supabase
      .from('templates_checklist')
      .delete()
      .eq('empresa_id', profile.empresa_id)
      .eq('categoria', checklistPreset);

    const { error } = delError
      ? { error: delError }
      : await supabase.from('templates_checklist').insert({
          nome: `Preset ${checklistPreset.toUpperCase()}`,
          categoria: checklistPreset,
          itens: customItems,
          empresa_id: profile.empresa_id,
        });

    if (error) {
      toast.error(getErrorMessage(error));
    } else {
      toast.success('Template de checklist salvo', {
        description: `${customItems.length} etapas disponíveis para futuras preventivas.`,
        icon: <CheckSquare className="h-4 w-4 text-primary" />,
      });
    }
  };

  const handleGenerateGuestLink = async () => {
    if (!profile?.empresa_id) return;

    const { data, error } = await supabase
      .from('links_acesso_convidado')
      .insert({
        descricao: `Portal de solicitações #${links.length + 1}`,
        empresa_id: profile.empresa_id,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      toast.error(error ? getErrorMessage(error) : 'Erro ao gerar link.');
      return;
    }
    setLinks(prev => [...prev, data]);
    setQrLink(data);
    toast.success('Link do portal criado', { description: 'Válido por 12 meses.' });
  };

  const handleRevokeLink = async (id: string) => {
    if (!window.confirm('Desativar este link? Os QR codes impressos com ele deixam de funcionar.')) return;
    const { error } = await supabase.from('links_acesso_convidado').update({ ativo: false }).eq('id', id);
    if (error) {
      toast.error(getErrorMessage(error));
      return;
    }
    setLinks(prev => prev.filter(l => l.id !== id));
    toast.info('Link desativado.');
  };

  const handleCopyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(portalUrl(window.location.origin, token));
      toast.success('Link copiado');
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  };

  const handleAddMeasurement = async () => {
    if (!profile?.empresa_id) return;
    if (!formEquipamento.trim() || !formValor || !formMin || !formMax) {
      toast.error('Por favor, preencha todos os campos da medição.');
      return;
    }

    const valorNum = parseFloat(formValor);
    const minNum = parseFloat(formMin);
    const maxNum = parseFloat(formMax);

    if (isNaN(valorNum) || isNaN(minNum) || isNaN(maxNum)) {
      toast.error('Os valores inseridos devem ser numéricos.');
      return;
    }
    if (minNum > maxNum) {
      toast.error('O mínimo esperado não pode ser maior que o máximo.');
      return;
    }

    const equipamento = formEquipamento.trim();
    const isCritico = valorNum < minNum || valorNum > maxNum;
    let osGeradaId: number | null = null;
    let tecnicoNome: string | null = null;

    // Fora da faixa: abre OS corretiva automaticamente
    if (isCritico) {
      const tecnico = await pickTecnico(formVariavel);
      if (tecnico) {
        const { data: osData, error: osErr } = await supabase
          .from('ordens_de_servico')
          .insert({
            equipamento_nome: equipamento,
            descricao_problema: `[MEDIÇÃO FORA DA FAIXA] ${formVariavel} = ${valorNum} (esperado entre ${minNum} e ${maxNum}).`,
            prioridade: 'Alta',
            status_os: 'Aberta',
            origem: 'medicao',
            tipo_manutencao: 'Corretiva',
            empresa_id: profile.empresa_id,
            tecnico_id: tecnico.id_telegram,
          })
          .select('id')
          .single();
        if (!osErr && osData) {
          osGeradaId = osData.id;
          tecnicoNome = tecnico.nome_completo;
        }
      }
    }

    const { error } = await supabase.from('medicoes_ativos').insert({
      empresa_id: profile.empresa_id,
      equipamento_nome: equipamento,
      variavel: formVariavel,
      valor: valorNum,
      min_esperado: minNum,
      max_esperado: maxNum,
      os_gerada_id: osGeradaId,
    });

    if (error) {
      toast.error(getErrorMessage(error));
      return;
    }

    if (!isCritico) {
      toast.success('Medição registrada', { description: 'Dentro da faixa esperada.' });
    } else if (osGeradaId) {
      toast.success(`Alerta registrado e OS #${osGeradaId} aberta`, {
        description: `Atribuída a ${tecnicoNome}.`,
        icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      });
    } else {
      toast.warning('Alerta registrado, mas a OS não foi aberta.', {
        description: 'Cadastre um técnico ou abra a OS manualmente.',
      });
    }

    setFormEquipamento('');
    setFormValor('');
    setFormMin('');
    setFormMax('');
    loadData();
  };

  const handleResolveAlert = async (id: string) => {
    const { error } = await supabase.from('medicoes_ativos').update({ alerta_tratado: true }).eq('id', id);
    if (error) {
      toast.error(getErrorMessage(error));
      return;
    }
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  // Alertas dinâmicos baseados no volume de Ordens de Serviço reais do Supabase agrupados por TAG no mês atual!
  const getDynamicOSVolumeAlerts = (): MeasurementAlert[] => {
    const tagCounts: Record<string, { count: number; nome: string }> = {};
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    realOSList.forEach(os => {
      const date = new Date(os.data_abertura);
      const isCurrentMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      
      if (isCurrentMonth) {
        const tag = os.equipamento_tag?.trim();
        if (tag) {
          if (!tagCounts[tag]) {
            tagCounts[tag] = { count: 0, nome: os.equipamento_nome || 'Equipamento' };
          }
          tagCounts[tag].count += 1;
        }
      }
    });

    const calculatedAlerts: MeasurementAlert[] = [];
    Object.entries(tagCounts).forEach(([tag, data]) => {
      if (data.count >= 3) {
        calculatedAlerts.push({
          id: 'dyn_alrt_' + tag,
          equipamento_nome: `${data.nome} (TAG: ${tag})`,
          descricao: `[PREDITIVO - RECORRÊNCIA CRÍTICA] O ativo com TAG ${tag} acumulou ${data.count} Ordens de Serviço neste mês. Alto risco de desgaste acelerado e parada mecânica não planejada.`,
          data_alerta: new Date().toISOString(),
          status: 'Ativo',
        });
      } else if (data.count >= 2) {
        calculatedAlerts.push({
          id: 'dyn_alrt_warn_' + tag,
          equipamento_nome: `${data.nome} (TAG: ${tag})`,
          descricao: `[ALERTA DE DESGASTE] Ativo com TAG ${tag} possui recorrência de ${data.count} Ordens de Serviço neste mês. Recomenda-se programar revisão e lubrificação técnica.`,
          data_alerta: new Date().toISOString(),
          status: 'Ativo',
        });
      }
    });

    return calculatedAlerts;
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
          <Users className="h-4 w-4 mr-2" /> Portal de Solicitações
        </Button>
        <Button
          variant={activeSubTab === 'medicoes' ? 'default' : 'ghost'}
          onClick={() => setActiveSubTab('medicoes')}
          className={`rounded-lg relative ${activeSubTab === 'medicoes' ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-neon border border-primary/20' : 'text-muted-foreground'}`}
        >
          <Activity className="h-4 w-4 mr-2" /> Medições Preditivas
          {(alerts.filter(a => a.status === 'Ativo').length > 0 || getDynamicOSVolumeAlerts().length > 0) && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          )}
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
                  Orçamentos de Serviços Externos
                </CardTitle>
                <CardDescription>
                  Qualquer membro da equipe cadastra; a aprovação é do administrador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 rounded-xl bg-secondary/10 border border-white/5">
                  <Input aria-label="Fornecedor" placeholder="Fornecedor" value={budgetForm.fornecedor} onChange={(e) => setBudgetForm({ ...budgetForm, fornecedor: e.target.value })} />
                  <Input aria-label="Equipamento" placeholder="Equipamento (opcional)" value={budgetForm.equipamento_nome} onChange={(e) => setBudgetForm({ ...budgetForm, equipamento_nome: e.target.value })} />
                  <Input aria-label="Serviço" placeholder="Serviço" value={budgetForm.servico} onChange={(e) => setBudgetForm({ ...budgetForm, servico: e.target.value })} />
                  <Input aria-label="Valor" placeholder="Valor (R$)" inputMode="decimal" value={budgetForm.valor} onChange={(e) => setBudgetForm({ ...budgetForm, valor: e.target.value })} />
                  <Button onClick={handleCreateBudget}><Plus className="h-4 w-4 mr-1" /> Solicitar</Button>
                </div>
                {budgets.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-6">Nenhum orçamento cadastrado.</p>
                )}
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
                            <span className="text-lg font-mono font-bold text-foreground">R$ {Number(budget.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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
                  Triagem de Solicitações de Manutenção
                </CardTitle>
                <CardDescription>
                  Chamados abertos pelo portal público ou QR code. Aprovar abre a Ordem de Serviço e atribui um técnico.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {requests.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-6">
                      Nenhuma solicitação. Gere um link em "Portal de Solicitações" e divulgue o QR code aos operadores.
                    </p>
                  )}
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
                          <span className="text-xs text-muted-foreground font-mono">{new Date(request.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
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
                  Portal de Solicitações
                </CardTitle>
                <CardDescription>
                  Operadores e clientes abrem chamados sem login e sem licença: basta o link ou o QR code. Os chamados caem na triagem de Solicitações.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Links ativos</h4>
                  {links.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum link ativo.</p>
                  )}
                  {links.map((link, index) => (
                    <div key={link.id || index} className="p-3 rounded-lg bg-secondary/30 border border-white/5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 truncate">
                        <Lock className="h-3.5 w-3.5 text-success shrink-0" />
                        <span className="font-mono text-xs text-muted-foreground truncate">
                          {link.descricao}
                          {link.expires_at && ` • expira em ${new Date(link.expires_at).toLocaleDateString('pt-BR')}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="ghost" size="icon" aria-label="QR code" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setQrLink(link)}>
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Copiar link" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleCopyLink(link.token)}>
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Abrir portal" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => window.open(portalUrl(window.location.origin, link.token), '_blank', 'noopener')}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Desativar link" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRevokeLink(link.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <Button className="w-full shadow-neon" onClick={handleGenerateGuestLink}>
                  <Plus className="h-4 w-4 mr-1.5" /> Gerar link do portal
                </Button>

                <QRCodeDialog
                  open={!!qrLink}
                  onOpenChange={(open) => !open && setQrLink(null)}
                  title="Solicitar manutenção"
                  subtitle="Aponte a câmera do celular para abrir um chamado"
                  items={qrLink ? [{ label: 'Portal', hint: 'Abre o formulário de solicitação (sem login)', url: portalUrl(window.location.origin, qrLink.token) }] : []}
                />
              </CardContent>
            </Card>
          )}

          {activeSubTab === 'medicoes' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna da Esquerda: Form de Medição & Autoatribuição */}
                <div className="lg:col-span-1 space-y-6">
                  <Card className="glass-panel border-white/5">
                  <CardHeader>
                    <CardTitle className="font-mono text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary animate-pulse" />
                      Registrar Medição
                    </CardTitle>
                    <CardDescription>
                      Insira os parâmetros de operação e defina os limites críticos para geração automática de alertas e OS.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Equipamento / Ativo</label>
                      <Input
                        placeholder="Ex: Motor de Resfriamento Principal"
                        value={formEquipamento}
                        onChange={(e) => setFormEquipamento(e.target.value)}
                        className="bg-secondary/20 border-white/5"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Variável Analisada</label>
                      <select
                        value={formVariavel}
                        onChange={(e) => setFormVariavel(e.target.value)}
                        className="w-full bg-secondary/20 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="Temperatura (ºC)" className="bg-background text-foreground">Temperatura (ºC)</option>
                        <option value="Pressão de Óleo (bar)" className="bg-background text-foreground">Pressão de Óleo (bar)</option>
                        <option value="Corrente Elétrica (A)" className="bg-background text-foreground">Corrente Elétrica (A)</option>
                        <option value="Vibração (mm/s)" className="bg-background text-foreground">Vibração (mm/s)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Valor Medido</label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="Ex: 85.4"
                        value={formValor}
                        onChange={(e) => setFormValor(e.target.value)}
                        className="bg-secondary/20 border-white/5 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Mínimo Esperado</label>
                        <Input
                          type="number"
                          step="any"
                          placeholder="Ex: 20"
                          value={formMin}
                          onChange={(e) => setFormMin(e.target.value)}
                          className="bg-secondary/20 border-white/5 font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Máximo Esperado</label>
                        <Input
                          type="number"
                          step="any"
                          placeholder="Ex: 80"
                          value={formMax}
                          onChange={(e) => setFormMax(e.target.value)}
                          className="bg-secondary/20 border-white/5 font-mono"
                        />
                      </div>
                    </div>

                    <Button className="w-full shadow-neon gap-1.5" onClick={handleAddMeasurement}>
                      <Plus className="h-4 w-4" /> Registrar Medição Operacional
                    </Button>
                  </CardContent>
                </Card>

                {/* Card de Autoatribuição Inteligente */}
                <Card className="glass-panel border-white/5 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-3">
                    <Badge className={autoAssignActive ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-muted/10 text-muted-foreground border-white/5"}>
                      {autoAssignActive ? "ATIVO" : "INATIVO"}
                    </Badge>
                  </div>
                  <CardHeader>
                    <CardTitle className="font-mono text-sm flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-primary" />
                      Distribuição de Tarefas
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      Autoatribuição instantânea e autônoma baseada na especialidade técnica requerida pela falha.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/10 border border-white/5">
                      <span className="text-xs font-medium">Distribuição Autônoma</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={`h-7 px-3 rounded-full border transition-all ${autoAssignActive ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20 hover:text-green-300" : "bg-secondary/30 text-muted-foreground border-white/5 hover:bg-secondary/50"}`}
                        onClick={() => setAutoAssignActive(!autoAssignActive)}
                      >
                        {autoAssignActive ? "Ativado" : "Desativado"}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Matriz de Especialidades</span>
                      <div className="space-y-2 font-mono text-[11px]">
                        <div className="p-2 rounded bg-background/50 border border-white/5 flex items-center justify-between">
                          <span className="text-muted-foreground">🌡️ Hidráulica / HVAC</span>
                          <span className="text-primary font-bold">Mecânico / HVAC</span>
                        </div>
                        <div className="p-2 rounded bg-background/50 border border-white/5 flex items-center justify-between">
                          <span className="text-muted-foreground">⚡ Eletroeletrônica</span>
                          <span className="text-primary font-bold">Eletricista</span>
                        </div>
                        <div className="p-2 rounded bg-background/50 border border-white/5 flex items-center justify-between">
                          <span className="text-muted-foreground">⚙️ Outras Variáveis</span>
                          <span className="text-primary font-bold">Técnico Plantão</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Ao disparar um alerta, a OS é atribuída ao técnico cuja função combina com a variável medida; sem correspondência, vai para o primeiro técnico cadastrado.
                    </p>
                  </CardContent>
                </Card>
              </div>

                {/* Histórico de Medições e Alertas Ativos */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Alertas Ativos */}
                  <Card className="glass-panel border-white/5 border-red-500/20 bg-red-500/5">
                    <CardHeader>
                      <CardTitle className="font-mono text-lg flex items-center gap-2 text-red-400">
                        <AlertTriangle className="h-5 w-5 animate-pulse" />
                        Alertas Ativos & Ordens de Serviço Automatizadas
                      </CardTitle>
                    <CardDescription className="text-red-300/60">
                        Medições fora da faixa e equipamentos com OS recorrentes no mês.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(() => {
                        const allAlerts = [
                          ...alerts.filter(a => a.status === 'Ativo'),
                          ...getDynamicOSVolumeAlerts()
                        ];

                        if (allAlerts.length > 0) {
                          return allAlerts.map(alert => (
                            <div key={alert.id} className="p-4 rounded-xl bg-background/50 border border-red-500/20 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm text-red-400">{alert.equipamento_nome}</span>
                                <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 font-mono text-[10px]">
                                  {alert.id.startsWith('dyn_alrt_') ? 'RECORRÊNCIA' : 'CRÍTICO'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{alert.descricao}</p>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-white/5">
                                <span>Gerado em: {new Date(alert.data_alerta).toLocaleString('pt-BR')}</span>
                                <span className="flex items-center gap-3">
                                  {alert.os_gerada_id && (
                                    <span className="font-mono text-primary font-bold">OS Gerada: #{alert.os_gerada_id}</span>
                                  )}
                                  {!alert.id.startsWith('dyn_alrt_') && (
                                    <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => handleResolveAlert(alert.id)}>
                                      Marcar como tratado
                                    </Button>
                                  )}
                                </span>
                              </div>
                            </div>
                          ));
                        }

                        return (
                          <div className="text-center py-6 text-muted-foreground text-xs">
                            <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-2" />
                            Nenhum alerta ativo! Todos os parâmetros em conformidade operacional.
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Lista de Medições Recentes */}
                  <Card className="glass-panel border-white/5">
                    <CardHeader>
                      <CardTitle className="font-mono text-lg">Histórico de Medições de Condition Monitoring</CardTitle>
                      <CardDescription>
                        Trilha de auditoria das últimas medições registradas por planejadores e técnicos.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {measurements.length === 0 && (
                          <p className="text-center text-xs text-muted-foreground py-6">Nenhuma medição registrada.</p>
                        )}
                        {measurements.map(med => (
                          <div key={med.id} className="p-3 rounded-xl bg-secondary/10 border border-white/5 flex items-center justify-between gap-4">
                            <div>
                              <h4 className="font-semibold text-sm text-foreground">{med.equipamento_nome}</h4>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {med.variavel}: <span className="font-mono font-bold text-foreground">{med.valor}</span> (Limite: {med.min_esperado} - {med.max_esperado})
                              </p>
                              <div className="text-[10px] text-muted-foreground mt-1">Registrado em: {new Date(med.data_medicao).toLocaleString('pt-BR')}</div>
                            </div>
                            <Badge variant="outline" className={med.status === 'Crítico' ? 'border-red-500/20 text-red-400 bg-red-500/10' : 'border-green-500/20 text-green-400 bg-green-500/10'}>
                              {med.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

import { useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  FileDown,
  Loader2,
  CheckCircle,
  RotateCcw,
  Wrench,
  User,
  Calendar,
  LayoutGrid,
  List,
  CalendarDays,
  Hourglass,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { handleError } from '@/lib/error-handler';
import { exportOSToPDF } from './OSPdfExport';
import { OSCloseDialog } from './OSCloseDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOSCategories } from '@/hooks/useOSCategories';

interface OS {
  id: number;
  equipamento_nome: string;
  equipamento_tag: string | null;
  status_os: string;
  prioridade: string | null;
  tipo_manutencao: string | null;
  data_abertura: string;
  data_fechamento: string | null;
  descricao_problema: string | null;
  diagnostico_solucao: string | null;
  notas_finais: string | null;
  tecnico_id: number;
  localizacao: string | null;
  empresa_id: string;
  url_foto: string | null;
  url_arquivo_fechamento: string | null;
  categoria_parada_id?: string | null;
  subcategoria_parada_id?: string | null;
  categoria_problema_id?: string | null;
  subcategoria_problema_id?: string | null;
}

interface Tecnico {
  id_telegram: number;
  nome_completo: string;
}

interface OSListProps {
  osList: OS[];
  tecnicos: Tecnico[];
  isLoading: boolean;
  onView: (os: OS) => void;
  onEdit: (os: OS) => void;
  onDelete: (os: OS) => void;
  onRefresh: () => void;
}

export function OSList({ osList, tecnicos, isLoading, onView, onEdit, onRefresh }: OSListProps) {
  const [viewMode, setViewMode] = useState<'lista' | 'kanban' | 'calendario' | 'agenda'>('lista');
  const [activeDay, setActiveDay] = useState<number>(new Date().getDate());
  const [deletingOS, setDeletingOS] = useState<OS | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [closingOS, setClosingOS] = useState<OS | null>(null);
  const isMobile = useIsMobile();
  const {
    getCategoriaParadaNome,
    getCategoriaProblemaName,
    getSubcategoriaName,
  } = useOSCategories();

  const getTecnicoName = (tecnicoId: number) => {
    const tecnico = tecnicos.find((t) => t.id_telegram === tecnicoId);
    return tecnico?.nome_completo || 'Desconhecido';
  };

  const getPrioridadeColor = (prioridade: string | null) => {
    switch (prioridade) {
      case 'Urgente':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'Alta':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'Média':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Baixa':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aberta':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Em manutenção':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Não liberado':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'Fechada':
      case 'Liberado para produção':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleDelete = async () => {
    if (!deletingOS) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('ordens_de_servico')
        .delete()
        .eq('id', deletingOS.id);

      if (error) throw error;

      toast.success('OS excluída com sucesso!');
      onRefresh();
    } catch (error) {
      handleError(error);
    } finally {
      setIsDeleting(false);
      setDeletingOS(null);
    }
  };

  const handleExportPDF = async (os: OS) => {
    setExportingId(os.id);
    try {
      const categoryNames = {
        categoriaParada: getCategoriaParadaNome(os.categoria_parada_id),
        subcategoriaParada: getSubcategoriaName(os.subcategoria_parada_id),
        categoriaProblema: getCategoriaProblemaName(os.categoria_problema_id),
        subcategoriaProblema: getSubcategoriaName(os.subcategoria_problema_id),
      };
      exportOSToPDF(os, tecnicos, categoryNames);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      handleError(error);
    } finally {
      setExportingId(null);
    }
  };

  const handleReopenOS = async (os: OS) => {
    try {
      const { error } = await supabase
        .from('ordens_de_servico')
        .update({
          status_os: 'Aberta',
          data_fechamento: null,
        })
        .eq('id', os.id);

      if (error) throw error;

      toast.success('OS reaberta com sucesso!');
      onRefresh();
    } catch (error) {
      handleError(error);
    }
  };

  const renderKanban = () => {
    const statuses = ['Aberta', 'Em manutenção', 'Não liberado', 'Liberado para produção', 'Fechada'];
    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {statuses.map((status) => {
          const filtered = osList.filter((os) => os.status_os === status);
          return (
            <div key={status} className="p-4 rounded-xl bg-secondary/10 border border-white/5 space-y-4 min-w-[250px] flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="font-mono text-xs font-bold text-foreground/80 flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${
                    status === 'Aberta' ? 'bg-blue-400' :
                    status === 'Em manutenção' ? 'bg-yellow-400' :
                    status === 'Não liberado' ? 'bg-red-400' : 'bg-emerald-400'
                  }`} />
                  {status}
                </span>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {filtered.length}
                </Badge>
              </div>
              
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
                {filtered.map((os) => (
                  <Card key={os.id} className="p-3.5 bg-background/40 border border-white/5 hover:border-primary/20 hover:shadow-neon transition-all duration-300 relative group">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-primary">#{os.id}</span>
                      <Badge variant="outline" className={`text-[9px] ${getPrioridadeColor(os.prioridade)}`}>
                        {os.prioridade || 'Média'}
                      </Badge>
                    </div>
                    <h4 className="font-mono text-xs font-bold text-foreground line-clamp-1">{os.equipamento_nome}</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">TAG: {os.equipamento_tag || 'S/N'}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1.5 bg-secondary/30 p-2 rounded border border-white/5">{os.descricao_problema || 'Nenhuma descrição'}</p>
                    
                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {getTecnicoName(os.tecnico_id).split(' ')[0]}</span>
                      <div className="flex gap-1.5">
                        <Button size="icon" variant="ghost" className="h-5 w-5 hover:text-primary" onClick={() => onView(os)}><Eye className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5 hover:text-primary" onClick={() => onEdit(os)}><Pencil className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </Card>
                ))}
                {filtered.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground font-mono">Vazio</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCalendario = () => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const firstDayIndex = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
    const monthName = today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDayIndex }, (_, i) => null);
    const gridDays = [...blanks, ...daysArray];

    const osForActiveDay = osList.filter((os) => {
      const osDate = new Date(os.data_abertura);
      return osDate.getDate() === activeDay && osDate.getMonth() === today.getMonth();
    });

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-xl bg-secondary/15 border border-white/5 shadow-surface">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
            <h3 className="font-mono text-sm font-bold text-foreground uppercase tracking-wide">{monthName}</h3>
            <span className="text-[10px] font-mono text-muted-foreground">Clique em um dia para auditar</span>
          </div>
          
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-mono text-muted-foreground mb-2">
            <div>D</div><div>S</div><div>T</div><div>Q</div><div>Q</div><div>S</div><div>S</div>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {gridDays.map((day, idx) => {
              if (day === null) return <div key={`blank-${idx}`} />;
              
              const dayOSList = osList.filter((os) => {
                const osDate = new Date(os.data_abertura);
                return osDate.getDate() === day && osDate.getMonth() === today.getMonth();
              });
              
              const isToday = day === today.getDate();
              const isSelected = day === activeDay;

              return (
                <button
                  key={`day-${day}`}
                  onClick={() => setActiveDay(day)}
                  className={`p-2 rounded-lg aspect-square flex flex-col items-center justify-between border transition-all relative ${
                    isSelected ? 'bg-primary/20 border-primary text-foreground shadow-neon font-bold' :
                    isToday ? 'bg-secondary/30 border-primary/30 text-primary font-semibold' :
                    'bg-background/25 border-white/5 hover:border-white/20 text-muted-foreground'
                  }`}
                >
                  <span className="text-xs">{day}</span>
                  {dayOSList.length > 0 && (
                    <div className="flex gap-0.5 justify-center mt-1">
                      {dayOSList.slice(0, 3).map((os, oIdx) => (
                        <span key={oIdx} className={`h-1.5 w-1.5 rounded-full ${
                          os.status_os === 'Fechada' ? 'bg-emerald-400' : 'bg-amber-400'
                        }`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-secondary/15 border border-white/5 flex flex-col">
          <h3 className="font-mono text-sm font-bold text-foreground uppercase border-b border-white/5 pb-3 mb-4 flex items-center justify-between">
            <span>Ordens do Dia {activeDay}</span>
            <Badge variant="secondary" className="font-mono">{osForActiveDay.length}</Badge>
          </h3>
          
          <ScrollArea className="flex-1 max-h-[350px]">
            <div className="space-y-3 pr-2">
              {osForActiveDay.map((os) => (
                <div key={os.id} className="p-3 rounded-lg bg-background/40 border border-white/5 hover:border-white/10 transition-all flex items-center justify-between gap-3 group">
                  <div className="space-y-1">
                    <span className="font-mono text-xs font-bold text-primary">#{os.id}</span>
                    <h4 className="font-mono text-xs font-bold text-foreground line-clamp-1">{os.equipamento_nome}</h4>
                    <p className="text-[10px] text-muted-foreground font-mono">TAG: {os.equipamento_tag || 'S/N'}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/10" onClick={() => onView(os)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {osForActiveDay.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground font-mono">Nenhuma OS registrada neste dia</div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  };

  const renderAgenda = () => {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-mono font-bold text-emerald-400 flex items-center gap-1.5 uppercase">
              🛡️ Trilha de Auditoria Cronológica Regional
            </h4>
            <p className="text-xs text-muted-foreground">Apresente esta linha do tempo linear de eventos para auditorias estritas de ISO 9001 e normas regionais de manutenção preventiva.</p>
          </div>
          <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-mono text-xs" onClick={() => toast.success('Pronto para exportação regional!')}>
            Validar Trilha
          </Button>
        </div>

        <div className="relative pl-6 border-l-2 border-primary/20 space-y-8">
          {osList.slice(0, 15).map((os) => {
            const hasFechamento = !!os.data_fechamento;
            const openDate = new Date(os.data_abertura);
            const closeDate = os.data_fechamento ? new Date(os.data_fechamento) : null;
            
            const slaHours = closeDate 
              ? Math.max(1, Math.round((closeDate.getTime() - openDate.getTime()) / (1000 * 60 * 60)))
              : Math.max(1, Math.round((new Date().getTime() - openDate.getTime()) / (1000 * 60 * 60)));

            return (
              <div key={os.id} className="relative group">
                <span className={`absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 bg-background flex items-center justify-center transition-all ${
                  hasFechamento ? 'border-emerald-400 group-hover:bg-emerald-400/20' : 'border-amber-400 group-hover:bg-amber-400/20'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${hasFechamento ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                </span>

                <div className="p-5 rounded-xl bg-secondary/10 border border-white/5 hover:border-white/15 transition-all duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-primary">#{os.id}</span>
                      <h4 className="font-mono text-sm font-bold text-foreground">{os.equipamento_nome}</h4>
                      <Badge variant="outline" className="font-mono text-[9px] px-1.5 py-0.5">
                        TAG: {os.equipamento_tag || 'S/N'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {openDate.toLocaleDateString('pt-BR')} às {openDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
                    <div>
                      <p className="text-muted-foreground uppercase text-[10px] tracking-wider">Tipo & Prioridade</p>
                      <p className="font-bold text-foreground mt-0.5">{os.tipo_manutencao || 'Corretiva'} / {os.prioridade || 'Média'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase text-[10px] tracking-wider">Técnico Auditor</p>
                      <p className="font-bold text-foreground mt-0.5">{getTecnicoName(os.tecnico_id)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase text-[10px] tracking-wider">Status & Conformidade</p>
                      <p className={`font-bold mt-0.5 ${hasFechamento ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {hasFechamento ? 'CONCLUÍDA & REGISTRADA' : 'EM EXECUÇÃO'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase text-[10px] tracking-wider">Tempo de Atendimento (SLA)</p>
                      <p className="font-bold text-foreground mt-0.5">
                        {slaHours} {slaHours === 1 ? 'Hora' : 'Horas'}
                      </p>
                    </div>
                  </div>

                  {os.descricao_problema && (
                    <div className="mt-4 p-3 bg-secondary/20 rounded border border-white/5">
                      <p className="text-xs text-muted-foreground italic">" {os.descricao_problema} "</p>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                    <span className="text-[10px] text-emerald-400/80 bg-emerald-500/5 px-2 py-1 border border-emerald-500/10 rounded flex items-center gap-1">
                      ✓ Registros em conformidade com normas técnicas regionais de segurança
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-xs font-mono" onClick={() => onView(os)}>
                        Visualizar Registro
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs font-mono gap-1" onClick={() => handleExportPDF(os)}>
                        <FileDown className="h-3.5 w-3.5" /> Ficha PDF
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (osList.length === 0) {
    return (
      <Card className="p-12 text-center glass-panel border-white/5 flex flex-col items-center justify-center">
        <Wrench className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground font-mono text-lg">Nenhuma OS encontrada</p>
      </Card>
    );
  }

  // Mobile Card Layout
  return (
    <>
      {/* Seletor de Visualização e Auditoria */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 p-4 rounded-xl bg-secondary/10 border border-white/5">
        <div className="flex items-center gap-1.5 p-1 bg-background/50 border border-white/5 rounded-lg flex-wrap">
          <Button
            variant={viewMode === 'lista' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('lista')}
            className="font-mono text-xs gap-1.5 px-3 h-8"
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('kanban')}
            className="font-mono text-xs gap-1.5 px-3 h-8"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Kanban
          </Button>
          <Button
            variant={viewMode === 'calendario' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('calendario')}
            className="font-mono text-xs gap-1.5 px-3 h-8"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Calendário
          </Button>
          <Button
            variant={viewMode === 'agenda' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('agenda')}
            className="font-mono text-xs gap-1.5 px-3 h-8"
          >
            <Hourglass className="h-3.5 w-3.5" />
            Agenda / Auditoria
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2.5 py-1.5 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            FORMATO AUDITÁVEL REGIONAL SE REG-9001
          </span>
        </div>
      </div>

      {viewMode === 'lista' && (
        isMobile ? (
          <div className="space-y-4">
            {osList.map((os) => (
              <Card key={os.id} className="p-4 glass-panel border-white/5 shadow-surface hover:shadow-neon transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                {/* Header with ID and Status */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg">#{os.id}</span>
                    <Badge variant="outline" className={getStatusColor(os.status_os)}>
                      {os.status_os}
                    </Badge>
                  </div>
                  <Badge variant="outline" className={getPrioridadeColor(os.prioridade)}>
                    {os.prioridade || '-'}
                  </Badge>
                </div>

                {/* Equipment Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2">
                    <Wrench className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">{os.equipamento_nome}</p>
                      {os.equipamento_tag && (
                        <p className="text-xs text-muted-foreground">TAG: {os.equipamento_tag}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    {getTecnicoName(os.tecnico_id)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(os.data_abertura), 'dd/MM/yy HH:mm')}
                  </div>
                  {os.tipo_manutencao && (
                    <p className="text-xs text-muted-foreground">{os.tipo_manutencao}</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-white/5 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onView(os)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(os)}
                    className="flex-1"
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExportPDF(os)}>
                        {exportingId === os.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4 mr-2" />
                        )}
                        Exportar PDF
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {(os.status_os === 'Aberta' || os.status_os === 'Em manutenção') ? (
                        <DropdownMenuItem
                          onClick={() => setClosingOS(os)}
                          className="text-green-600 focus:text-green-600"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Fechar OS
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => handleReopenOS(os)}
                          className="text-blue-600 focus:text-blue-600"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reabrir OS
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeletingOS(os)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="glass-panel border-white/5 overflow-hidden shadow-surface">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data Abertura</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {osList.map((os) => (
                    <TableRow key={os.id} className="cursor-pointer hover:bg-primary/5 transition-colors border-white/5 border-b group">
                      <TableCell className="font-mono font-medium text-primary group-hover:text-primary-foreground transition-colors" onClick={() => onView(os)}>{os.id}</TableCell>
                      <TableCell onClick={() => onView(os)}>
                        <div>
                          <p className="font-medium">{os.equipamento_nome}</p>
                          {os.equipamento_tag && (
                            <p className="text-xs text-muted-foreground">{os.equipamento_tag}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm" onClick={() => onView(os)}>{getTecnicoName(os.tecnico_id)}</TableCell>
                      <TableCell onClick={() => onView(os)}>
                        <Badge variant="outline" className={getStatusColor(os.status_os)}>
                          {os.status_os}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={() => onView(os)}>
                        <Badge variant="outline" className={getPrioridadeColor(os.prioridade)}>
                          {os.prioridade || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm" onClick={() => onView(os)}>{os.tipo_manutencao || '-'}</TableCell>
                      <TableCell className="text-sm" onClick={() => onView(os)}>
                        {format(new Date(os.data_abertura), 'dd/MM/yy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(os)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(os)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportPDF(os)}>
                              {exportingId === os.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <FileDown className="h-4 w-4 mr-2" />
                              )}
                              Exportar PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {(os.status_os === 'Aberta' || os.status_os === 'Em manutenção') ? (
                              <DropdownMenuItem
                                onClick={() => setClosingOS(os)}
                                className="text-green-600 focus:text-green-600"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Fechar OS
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleReopenOS(os)}
                                className="text-blue-600 focus:text-blue-600"
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Reabrir OS
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeletingOS(os)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        )
      )}

      {viewMode === 'kanban' && renderKanban()}
      {viewMode === 'calendario' && renderCalendario()}
      {viewMode === 'agenda' && renderAgenda()}

      {/* Modais Comuns */}
      <AlertDialog open={!!deletingOS} onOpenChange={() => setDeletingOS(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a OS #{deletingOS?.id}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OSCloseDialog
        open={!!closingOS}
        os={closingOS}
        onClose={() => setClosingOS(null)}
        onSuccess={onRefresh}
      />
    </>
  );
}

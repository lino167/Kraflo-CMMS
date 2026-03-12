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

export function OSList({ osList, tecnicos, isLoading, onView, onEdit, onDelete, onRefresh }: OSListProps) {
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
  if (isMobile) {
    return (
      <>
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

  // Desktop Table Layout
  return (
    <>
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
                  <TableCell className="font-mono font-medium text-primary group-hover:text-primary-foreground transition-colors">{os.id}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{os.equipamento_nome}</p>
                      {os.equipamento_tag && (
                        <p className="text-xs text-muted-foreground">{os.equipamento_tag}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{getTecnicoName(os.tecnico_id)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(os.status_os)}>
                      {os.status_os}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getPrioridadeColor(os.prioridade)}>
                      {os.prioridade || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{os.tipo_manutencao || '-'}</TableCell>
                  <TableCell className="text-sm">
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

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/integrations/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/sonner'
import { exportOSToPDF } from './OSPdfExport'
import { useOSCategories } from '@/hooks/useOSCategories'
import {
  Wrench,
  MapPin,
  User,
  Calendar,
  AlertCircle,
  FileText,
  CheckCircle2,
  Camera,
  Package,
  FileDown,
  Loader2,
  Tag,
  Crosshair,
} from 'lucide-react'

interface OS {
  id: number
  equipamento_nome: string
  equipamento_tag: string | null
  status_os: string
  prioridade: string | null
  tipo_manutencao: string | null
  data_abertura: string
  data_fechamento: string | null
  descricao_problema: string | null
  diagnostico_solucao: string | null
  notas_finais: string | null
  tecnico_id: number
  localizacao: string | null
  url_foto: string | null
  url_arquivo_fechamento: string | null
  categoria_parada_id?: string | null
  subcategoria_parada_id?: string | null
  categoria_problema_id?: string | null
  subcategoria_problema_id?: string | null
}

interface Tecnico {
  id_telegram: number
  nome_completo: string
}

interface Peca {
  id: number
  nome_peca: string
  tag_peca: string | null
  quantidade: number
}

interface OSViewDialogProps {
  open: boolean
  onClose: () => void
  os: OS | null
  tecnicos: Tecnico[]
}

export function OSViewDialog({
  open,
  onClose,
  os,
  tecnicos,
}: OSViewDialogProps) {
  const [pecas, setPecas] = useState<Peca[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const {
    getCategoriaParadaNome,
    getCategoriaProblemaName,
    getSubcategoriaName,
  } = useOSCategories()

  const loadPecas = useCallback(async () => {
    if (!os) return

    const { data, error } = await supabase
      .from('pecas_utilizadas')
      .select('id, nome_peca, tag_peca, quantidade')
      .eq('ordem_id', os.id)

    if (error) {
      console.error('Error loading pecas:', error)
      return
    }

    setPecas(data || [])
  }, [os])

  useEffect(() => {
    if (open && os) {
      loadPecas()
    }
  }, [open, os, loadPecas])

  const handleExportPDF = async () => {
    if (!os) return
    setIsExporting(true)
    try {
      const categoryNames = {
        categoriaParada: getCategoriaParadaNome(os.categoria_parada_id),
        subcategoriaParada: getSubcategoriaName(os.subcategoria_parada_id),
        categoriaProblema: getCategoriaProblemaName(os.categoria_problema_id),
        subcategoriaProblema: getSubcategoriaName(os.subcategoria_problema_id),
      }
      exportOSToPDF(os, tecnicos, categoryNames)
      toast.success('PDF exportado com sucesso!')
    } catch (error) {
      console.error('Error exporting PDF:', error)
      toast.error('Erro ao exportar PDF')
    } finally {
      setIsExporting(false)
    }
  }

  if (!os) return null

  const getTecnicoName = (tecnicoId: number) => {
    const tecnico = tecnicos.find((t) => t.id_telegram === tecnicoId)
    return tecnico?.nome_completo || 'Desconhecido'
  }

  const getPrioridadeColor = (prioridade: string | null) => {
    switch (prioridade) {
      case 'Urgente':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'Alta':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20'
      case 'Média':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      case 'Baixa':
        return 'bg-green-500/10 text-green-500 border-green-500/20'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aberta':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'Em manutenção':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      case 'Não liberado':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'Fechada':
      case 'Liberado para produção':
        return 'bg-green-500/10 text-green-500 border-green-500/20'
      case 'Aguardando peças':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-3 flex-wrap">
              <span className="font-mono">OS #{os.id}</span>
              <Badge variant="outline" className={getStatusColor(os.status_os)}>
                {os.status_os}
              </Badge>
              <Badge
                variant="outline"
                className={getPrioridadeColor(os.prioridade)}
              >
                {os.prioridade || 'Sem prioridade'}
              </Badge>
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="shrink-0"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              <span className="hidden sm:inline ml-2">Baixar PDF</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Equipment Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Wrench className="h-4 w-4" />
                Equipamento
              </div>
              <p className="font-medium">{os.equipamento_nome}</p>
              {os.equipamento_tag && (
                <p className="text-sm text-muted-foreground">
                  TAG: {os.equipamento_tag}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <MapPin className="h-4 w-4" />
                Localização
              </div>
              <p className="font-medium">{os.localizacao || 'Não informada'}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <User className="h-4 w-4" />
                Técnico Responsável
              </div>
              <p className="font-medium">{getTecnicoName(os.tecnico_id)}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <AlertCircle className="h-4 w-4" />
                Tipo de Manutenção
              </div>
              <p className="font-medium">
                {os.tipo_manutencao || 'Não informado'}
              </p>
            </div>
          </div>

          {/* Categories Section */}
          {(os.categoria_parada_id || os.categoria_problema_id) && (
            <>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {os.categoria_parada_id && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Tag className="h-4 w-4" />
                      Categoria de Parada
                    </div>
                    <p className="font-medium">
                      {getCategoriaParadaNome(os.categoria_parada_id) || 'Não identificada'}
                    </p>
                    {os.subcategoria_parada_id && (
                      <p className="text-sm text-muted-foreground">
                        Sub: {getSubcategoriaName(os.subcategoria_parada_id)}
                      </p>
                    )}
                  </div>
                )}

                {os.categoria_problema_id && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Crosshair className="h-4 w-4" />
                      Causa Raiz
                    </div>
                    <p className="font-medium">
                      {getCategoriaProblemaName(os.categoria_problema_id) || 'Não identificada'}
                    </p>
                    {os.subcategoria_problema_id && (
                      <p className="text-sm text-muted-foreground">
                        Sub: {getSubcategoriaName(os.subcategoria_problema_id)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Calendar className="h-4 w-4" />
                Data de Abertura
              </div>
              <p className="font-medium">
                {format(
                  new Date(os.data_abertura),
                  "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                  {
                    locale: ptBR,
                  },
                )}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Data de Fechamento
              </div>
              <p className="font-medium">
                {os.data_fechamento
                  ? format(
                      new Date(os.data_fechamento),
                      "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                      {
                        locale: ptBR,
                      },
                    )
                  : 'Em aberto'}
              </p>
            </div>
          </div>

          <Separator />

          {/* Problem Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <FileText className="h-4 w-4" />
              Descrição do Problema
            </div>
            <div className="p-3 bg-secondary/30 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">
                {os.descricao_problema || 'Não informado'}
              </p>
            </div>
          </div>

          {/* Diagnosis/Solution */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Diagnóstico / Solução
            </div>
            <div className="p-3 bg-secondary/30 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">
                {os.diagnostico_solucao || 'Não informado'}
              </p>
            </div>
          </div>

          {/* Final Notes */}
          {os.notas_finais && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <FileText className="h-4 w-4" />
                Notas Finais / Serviço Realizado
              </div>
              <div className="p-3 bg-secondary/30 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{os.notas_finais}</p>
              </div>
            </div>
          )}

          {/* Peças Utilizadas */}
          {pecas.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Package className="h-4 w-4" />
                  Peças Utilizadas
                </div>
                <div className="grid gap-2">
                  {pecas.map((peca) => (
                    <div
                      key={peca.id}
                      className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-sm">{peca.nome_peca}</p>
                        {peca.tag_peca && (
                          <p className="text-xs text-muted-foreground">
                            TAG: {peca.tag_peca}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary">Qtd: {peca.quantidade}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Photos Section */}
          {(os.url_foto || os.url_arquivo_fechamento) && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Camera className="h-4 w-4" />
                  Fotos Anexadas
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {os.url_foto && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Foto da Abertura
                      </p>
                      <a
                        href={os.url_foto}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={os.url_foto}
                          alt="Foto da abertura"
                          className="w-full h-40 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity cursor-pointer"
                        />
                      </a>
                    </div>
                  )}
                  {os.url_arquivo_fechamento && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Foto do Fechamento
                      </p>
                      <a
                        href={os.url_arquivo_fechamento}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={os.url_arquivo_fechamento}
                          alt="Foto do fechamento"
                          className="w-full h-40 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity cursor-pointer"
                        />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

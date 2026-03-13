import { useState, useEffect, useCallback, useMemo } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { osFormSchema, OSFormData } from '@/lib/validation-schemas'
import { handleError } from '@/lib/error-handler'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useOSCategories } from '@/hooks/useOSCategories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/sonner'
import { Loader2, X, Image as ImageIcon } from 'lucide-react'
import { ReincidenciaAlert } from '@/components/ReincidenciaAlert'



interface Tecnico {
  id_telegram: number
  nome_completo: string
}

interface OSFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editingOS?: {
    id: number
    equipamento_nome: string
    equipamento_tag?: string | null
    localizacao?: string | null
    tipo_manutencao?: string | null
    prioridade?: string | null
    descricao_problema?: string | null
    diagnostico_solucao?: string | null
    notas_finais?: string | null
    tecnico_id: number
    empresa_id: string
    status_os: string
    url_foto?: string | null
  }
}

interface ReincidenciaData {
  encontrou: boolean
  total_recentes: number
  dias_limite?: number
  ultima_os?: {
    id: number
    descricao_problema: string | null
    diagnostico_solucao: string | null
    data_fechamento: string
    tecnico_id: number
    tecnico_nome: string | null
    dias_desde_fechamento: number
  }
}

import { Control } from 'react-hook-form'

function FormReincidenciaAlert({ control, data }: { control: Control<OSFormData>; data: ReincidenciaData | null }) {
  const tag = useWatch({ control, name: 'equipamento_tag' })
  if (!data?.encontrou) return null
  return <ReincidenciaAlert data={data} tag={tag || ''} />
}

export function OSForm({ open, onClose, onSuccess, editingOS }: OSFormProps) {
  const { profile, isAdminKraflo } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [selectedTecnico, setSelectedTecnico] = useState<string>('')
  const [status, setStatus] = useState<
    | 'Aberta'
    | 'Em manutenção'
    | 'Fechada'
    | 'Liberado para produção'
    | 'Não liberado'
  >('Aberta')
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)

  // Categoria de parada
  const [categoriaParadaId, setCategoriaParadaId] = useState('')
  const [subcategoriaParadaId, setSubcategoriaParadaId] = useState('')
  const { categoriasParada, subcategorias } = useOSCategories()

  // Reincidência
  const [reincidenciaData, setReincidenciaData] = useState<ReincidenciaData | null>(null)
  const [checkingReincidencia, setCheckingReincidencia] = useState(false)

  const subcategoriasFiltradasParada = useMemo(() => {
    if (!categoriaParadaId) return []
    return subcategorias.filter(
      (s) => s.categoria_id === categoriaParadaId && s.tipo_categoria === 'parada'
    )
  }, [categoriaParadaId, subcategorias])

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFoto(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setFotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeFoto = () => {
    setFoto(null)
    setFotoPreview(null)
  }

  // Check reincidência when TAG changes
  const checkReincidencia = useCallback(async (tag: string) => {
    if (!tag || tag.length < 2 || !profile?.empresa_id) {
      setReincidenciaData(null)
      return
    }
    setCheckingReincidencia(true)
    try {
      const { data, error } = await supabase.rpc('fn_check_reincidencia', {
        p_empresa_id: profile.empresa_id,
        p_tag: tag.trim(),
        p_dias_limite: 60,
      })
      if (error) throw error
      setReincidenciaData(data as unknown as ReincidenciaData)
    } catch (error) {
      console.error('Erro ao verificar reincidência:', error)
      setReincidenciaData(null)
    } finally {
      setCheckingReincidencia(false)
    }
  }, [profile?.empresa_id])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    control,
  } = useForm<OSFormData>({
    resolver: zodResolver(osFormSchema),
    defaultValues: {
      tipo_manutencao: undefined,
      prioridade: undefined,
    },
  })

  const loadTecnicos = useCallback(async () => {
    try {
      let query = supabase.from('tecnicos').select('id_telegram, nome_completo')

      if (!isAdminKraflo && profile?.empresa_id) {
        query = query.eq('empresa_id', profile.empresa_id)
      }

      const { data, error } = await query
      if (error) throw error
      setTecnicos(data || [])

      if (data && data.length > 0 && !editingOS) {
        setSelectedTecnico(String(data[0].id_telegram))
      }
    } catch (error) {
      console.error('Error loading tecnicos:', error)
    }
  }, [editingOS, isAdminKraflo, profile?.empresa_id])

  useEffect(() => {
    if (open) {
      loadTecnicos()
      if (editingOS) {
        setValue('equipamento_nome', editingOS.equipamento_nome)
        setValue('equipamento_tag', editingOS.equipamento_tag || '')
        setValue('localizacao', editingOS.localizacao || '')
        setValue('tipo_manutencao', (editingOS.tipo_manutencao as OSFormData['tipo_manutencao']) || undefined)
        setValue('prioridade', (editingOS.prioridade as OSFormData['prioridade']) || undefined)
        setValue('descricao_problema', editingOS.descricao_problema || '')
        setValue('diagnostico_solucao', editingOS.diagnostico_solucao || '')
        setValue('notas_finais', editingOS.notas_finais || '')
        setSelectedTecnico(String(editingOS.tecnico_id))
        const validStatuses = [
          'Aberta',
          'Em manutenção',
          'Fechada',
          'Liberado para produção',
          'Não liberado',
        ] as const
        type StatusType = (typeof validStatuses)[number]
        const osStatus = validStatuses.includes(
          editingOS.status_os as StatusType,
        )
          ? (editingOS.status_os as StatusType)
          : 'Aberta'
        setStatus(osStatus)
        if (editingOS.url_foto) {
          setFotoPreview(editingOS.url_foto)
        }
      } else {
        reset()
        setSelectedTecnico('')
        setStatus('Aberta')
        setFoto(null)
        setFotoPreview(null)
        setCategoriaParadaId('')
        setSubcategoriaParadaId('')
        setReincidenciaData(null)
      }
    }
  }, [open, editingOS, loadTecnicos, reset, setValue])

  // Auto-scroll to first error
  useEffect(() => {
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      const element = document.getElementById(firstError);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
    }
  }, [errors]);

  const onSubmit = async (data: OSFormData) => {
    if (!selectedTecnico) {
      toast.error('Selecione um técnico')
      return
    }

    if (!editingOS && !categoriaParadaId) {
      toast.error('Selecione o motivo de parada')
      return
    }

    setIsLoading(true)
    try {
      const empresaId = editingOS?.empresa_id || profile?.empresa_id
      if (!empresaId && !isAdminKraflo) {
        throw new Error('Empresa não encontrada')
      }

      let urlFoto = editingOS?.url_foto || null

      // Upload foto se existir uma nova
      if (foto) {
        const fileExt = foto.name.split('.').pop()
        const fileName = `abertura_${Date.now()}.${fileExt}`
        const filePath = `${empresaId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('anexos-os')
          .upload(filePath, foto)

        if (uploadError) throw uploadError

        const { data: publicUrl } = supabase.storage
          .from('anexos-os')
          .getPublicUrl(filePath)

        urlFoto = publicUrl.publicUrl
      }

      const osData = {
        equipamento_nome: data.equipamento_nome,
        equipamento_tag: data.equipamento_tag || null,
        localizacao: data.localizacao || null,
        tipo_manutencao: data.tipo_manutencao || null,
        prioridade: data.prioridade || null,
        descricao_problema: data.descricao_problema || null,
        diagnostico_solucao: data.diagnostico_solucao || null,
        notas_finais: data.notas_finais || null,
        tecnico_id: parseInt(selectedTecnico),
        empresa_id: empresaId!,
        status_os: status,
        url_foto: urlFoto,
        categoria_parada_id: categoriaParadaId || null,
        subcategoria_parada_id: subcategoriaParadaId || null,
        data_fechamento:
          status === 'Fechada' || status === 'Liberado para produção'
            ? new Date().toISOString()
            : null,
      }

      if (editingOS) {
        const { error } = await supabase
          .from('ordens_de_servico')
          .update(osData)
          .eq('id', editingOS.id)

        if (error) throw error
        toast.success('OS atualizada com sucesso!')
      } else {
        const { error } = await supabase
          .from('ordens_de_servico')
          .insert([osData])

        if (error) throw error
        toast.success('OS criada com sucesso!')
      }

      onSuccess()
      onClose()
    } catch (error) {
      handleError(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full glass-panel border-white/10 shadow-surface p-6 sm:p-8">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-display text-primary flex items-center gap-2">
            <span className="h-6 w-1 bg-primary rounded-full"></span>
            {editingOS ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Equipamento */}
            <div className="space-y-2">
              <Label
                htmlFor="equipamento_nome"
                className="flex items-center gap-1"
              >
                Nome do Equipamento
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="equipamento_nome"
                {...register('equipamento_nome')}
                placeholder="Ex: Tear Picanol"
              />
              {errors.equipamento_nome && (
                <p className="text-xs text-destructive">
                  {errors.equipamento_nome.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="equipamento_tag">TAG do Equipamento</Label>
              <Input
                id="equipamento_tag"
                {...register('equipamento_tag')}
                placeholder="Ex: TP-001"
                onBlur={(e) => {
                  if (!editingOS) {
                    checkReincidencia(e.target.value)
                  }
                }}
              />
              {checkingReincidencia && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Verificando histórico...
                </p>
              )}
            </div>

            {/* Localização */}
            <div className="space-y-2">
              <Label htmlFor="localizacao">Localização</Label>
              <Input
                id="localizacao"
                {...register('localizacao')}
                placeholder="Ex: Setor A, Linha 3, Galpão 2"
              />
            </div>

            {/* Técnico */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Técnico Responsável
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedTecnico}
                onValueChange={setSelectedTecnico}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o técnico" />
                </SelectTrigger>
                <SelectContent>
                  {tecnicos.map((tecnico) => (
                    <SelectItem
                      key={tecnico.id_telegram}
                      value={String(tecnico.id_telegram)}
                    >
                      {tecnico.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Manutenção */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Tipo de Manutenção
                <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="tipo_manutencao"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => field.onChange(val || undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Corretiva">Corretiva</SelectItem>
                      <SelectItem value="Preventiva">Preventiva</SelectItem>
                      <SelectItem value="Preditiva">Preditiva</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tipo_manutencao && (
                <p className="text-xs text-destructive">
                  {errors.tipo_manutencao.message}
                </p>
              )}
            </div>

            {/* Prioridade */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Prioridade
                <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="prioridade"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => field.onChange(val || undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baixa">Baixa</SelectItem>
                      <SelectItem value="Média">Média</SelectItem>
                      <SelectItem value="Alta">Alta</SelectItem>
                      <SelectItem value="Urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.prioridade && (
                <p className="text-xs text-destructive">
                  {errors.prioridade.message}
                </p>
              )}
            </div>
          </div>

          {/* Reincidência Alert */}
          {!editingOS && (
            <FormReincidenciaAlert control={control} data={reincidenciaData} />
          )}

          {/* Status (only when editing) */}
          {editingOS && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(
                    value as
                      | 'Aberta'
                      | 'Em manutenção'
                      | 'Fechada'
                      | 'Liberado para produção'
                      | 'Não liberado',
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aberta">Aberta</SelectItem>
                  <SelectItem value="Em manutenção">Em manutenção</SelectItem>
                  <SelectItem value="Não liberado">Não liberado</SelectItem>
                  <SelectItem value="Fechada">Fechada</SelectItem>
                  <SelectItem value="Liberado para produção">
                    Liberado para produção
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Motivo de Parada (only on creation) */}
          {!editingOS && (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Motivo de Parada
                  <span className="text-destructive">*</span>
                </Label>
                <Select value={categoriaParadaId} onValueChange={(v) => {
                  setCategoriaParadaId(v)
                  setSubcategoriaParadaId('')
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriasParada.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {subcategoriasFiltradasParada.length > 0 && (
                <div className="space-y-2">
                  <Label>Subcategoria (opcional)</Label>
                  <Select value={subcategoriaParadaId} onValueChange={setSubcategoriaParadaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a subcategoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategoriasFiltradasParada.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>{sub.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Descrição do Problema */}
          <div className="space-y-2">
            <Label
              htmlFor="descricao_problema"
              className="flex items-center gap-1"
            >
              Descrição do Problema
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="descricao_problema"
              {...register('descricao_problema')}
              placeholder="Descreva detalhadamente o problema encontrado..."
              rows={3}
            />
            {errors.descricao_problema && (
              <p className="text-xs text-destructive">
                {errors.descricao_problema.message}
              </p>
            )}
          </div>

          {/* Upload de Foto na Abertura */}
          <div className="space-y-2">
            <Label>Foto do Problema (recomendado)</Label>
            {fotoPreview ? (
              <div className="relative w-full h-40 border border-border rounded-lg overflow-hidden">
                <img
                  src={fotoPreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={removeFoto}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/5 hover:border-primary/50 transition-all duration-300">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-muted-foreground hover:text-primary transition-colors">
                  <ImageIcon className="h-8 w-8 mb-2" />
                  <p className="text-sm">
                    Clique para adicionar foto
                  </p>
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFotoChange}
                />
              </label>
            )}
          </div>

          {/* Diagnóstico/Solução - só mostra na edição */}
          {editingOS && (
            <div className="space-y-2">
              <Label htmlFor="diagnostico_solucao">Diagnóstico / Solução</Label>
              <Textarea
                id="diagnostico_solucao"
                {...register('diagnostico_solucao')}
                placeholder="Descreva o diagnóstico e a solução aplicada..."
                rows={3}
              />
            </div>
          )}

          {/* Notas Finais - só mostra na edição */}
          {editingOS && (
            <div className="space-y-2">
              <Label htmlFor="notas_finais">Notas Finais</Label>
              <Textarea
                id="notas_finais"
                {...register('notas_finais')}
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>
          )}

          <DialogFooter className="mt-8 pt-4 border-t border-white/5 flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} className="hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow transition-all">
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingOS ? 'Salvar Alterações' : 'Criar OS'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

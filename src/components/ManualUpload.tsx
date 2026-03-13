/**
 * Prompt 5: UI de upload de manual com classificação obrigatória
 */

import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/components/ui/sonner'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Upload,
  FileText,
  Loader2,
  X,
  File,
  Tag,
  Plus,
} from 'lucide-react'
import {
  MANUAL_CATEGORIES,
  MANUAL_INDUSTRIES,
  MANUAL_TYPES,
  SUGGESTED_TAGS,
  manualUploadSchema,
  normalizeTag,
  type ManualUploadFormData,
} from '@/lib/manual-taxonomy'
import { useAuth } from '@/hooks/useAuth'

interface PdfTextItem {
  str: string
}
interface PdfTextContent {
  items: PdfTextItem[]
}
interface PdfPage {
  getTextContent(): Promise<PdfTextContent>
}
interface PdfDocument {
  numPages: number
  getPage(page: number): Promise<PdfPage>
}
interface PdfjsLib {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument(params: { data: ArrayBuffer }): { promise: PdfDocument }
}

declare global {
  interface Window {
    pdfjsLib?: PdfjsLib
  }
}

const loadPdfJs = async (): Promise<PdfjsLib> => {
  if (window.pdfjsLib) {
    return window.pdfjsLib
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      const pdfjsLib = window.pdfjsLib as PdfjsLib
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(pdfjsLib)
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export function ManualUpload() {
  const { isAdminKraflo } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [newTag, setNewTag] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<ManualUploadFormData>({
    resolver: zodResolver(manualUploadSchema),
    defaultValues: {
      nome_arquivo: '',
      manual_type: undefined,
      category: '',
      tags: [],
      industry: '',
      fabricante: '',
      modelo: '',
      equipamento_tipo: '',
      is_public: false,
    },
  })

  const watchManualType = form.watch('manual_type')
  const watchTags = form.watch('tags')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast.error('Apenas arquivos PDF são aceitos')
        return
      }
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast.error('O arquivo deve ter no máximo 20MB')
        return
      }
      setFile(selectedFile)
      form.setValue('nome_arquivo', selectedFile.name)
    }
  }

  const extractTextFromPDF = async (
    file: File
  ): Promise<{ text: string; numPages: number }> => {
    const pdfjsLib = await loadPdfJs()
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const numPages = pdf.numPages
    let fullText = ''
    for (let i = 1; i <= numPages; i++) {
      setProgressMessage(`Extraindo texto da página ${i}/${numPages}...`)
      setUploadProgress(10 + Math.floor((i / numPages) * 30))
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: PdfTextItem) => item.str)
        .join(' ')
      fullText += pageText + '\n\n'
    }
    return { text: fullText.trim(), numPages }
  }

  const addTag = (tag: string) => {
    const normalized = normalizeTag(tag)
    if (normalized && !watchTags.includes(normalized)) {
      form.setValue('tags', [...watchTags, normalized])
    }
    setNewTag('')
  }

  const removeTag = (tagToRemove: string) => {
    form.setValue(
      'tags',
      watchTags.filter((t) => t !== tagToRemove)
    )
  }

  const handlePreSubmit = () => {
    if (!file) {
      toast.error('Selecione um arquivo PDF')
      return
    }
    form.handleSubmit(() => setShowConfirmDialog(true))()
  }

  const handleConfirmUpload = async () => {
    setShowConfirmDialog(false)

    if (!file) return

    setIsUploading(true)
    setUploadProgress(5)
    setProgressMessage('Carregando PDF.js...')

    try {
      setUploadProgress(10)
      setProgressMessage('Extraindo texto do PDF...')

      const { text: extractedText, numPages } = await extractTextFromPDF(file)

      if (extractedText.length < 100) {
        throw new Error(
          'Não foi possível extrair texto suficiente do PDF. O arquivo pode estar escaneado ou protegido.'
        )
      }

      setUploadProgress(50)
      setProgressMessage('Enviando para processamento...')

      const formData = form.getValues()

      const { data, error } = await supabase.functions.invoke('upload-manual', {
        body: {
          filename: file.name,
          texto_extraido: extractedText,
          total_paginas: numPages,
          // Novos campos de classificação
          manual_type: formData.manual_type,
          category: formData.category,
          tags: formData.tags,
          industry: formData.industry || null,
          fabricante: formData.fabricante || null,
          modelo: formData.modelo || null,
          equipamento_tipo: formData.equipamento_tipo || null,
          is_public: formData.is_public,
        },
      })

      setUploadProgress(90)

      if (error) throw error

      if (data.error) {
        throw new Error(data.error)
      }

      setUploadProgress(100)
      setProgressMessage('Concluído!')
      toast.success(
        `Manual "${file.name}" processado com sucesso! ${data.chunks_created} chunks criados.`
      )

      // Reset form
      setFile(null)
      form.reset()
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error uploading manual:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao fazer upload do manual'
      )
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      setProgressMessage('')
    }
  }

  const clearFile = () => {
    setFile(null)
    form.setValue('nome_arquivo', '')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-mono flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload de Manual
          </CardTitle>
          <CardDescription>
            Faça upload de manuais técnicos para a base de conhecimento da IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-6">
              {/* File Input */}
              <div className="space-y-2">
                <Label>Arquivo PDF *</Label>
                <div
                  className={`
                    border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                    transition-colors
                    ${
                      file
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-secondary/30'
                    }
                  `}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <File className="h-8 w-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium text-foreground">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          clearFile()
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        Clique para selecionar ou arraste um arquivo PDF
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Máximo 20MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Tipo de Manual */}
              <FormField
                control={form.control}
                name="manual_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Manual *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MANUAL_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Categoria */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MANUAL_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tags */}
              <FormField
                control={form.control}
                name="tags"
                render={() => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <div className="space-y-3">
                      {/* Tags selecionadas */}
                      <div className="flex flex-wrap gap-2">
                        {watchTags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="flex items-center gap-1"
                          >
                            {tag}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => removeTag(tag)}
                            />
                          </Badge>
                        ))}
                      </div>
                      {/* Input para nova tag */}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Adicionar tag..."
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addTag(newTag)
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => addTag(newTag)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* Tags sugeridas */}
                      <div className="flex flex-wrap gap-1">
                        {SUGGESTED_TAGS.filter((t) => !watchTags.includes(t))
                          .slice(0, 10)
                          .map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="cursor-pointer hover:bg-secondary"
                              onClick={() => addTag(tag)}
                            >
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Campos condicionais para equipamento */}
              {watchManualType === 'equipment' && (
                <div className="space-y-4 p-4 rounded-lg bg-secondary/30 border border-border">
                  <p className="text-sm font-medium text-muted-foreground">
                    Informações do Equipamento (preencha pelo menos um)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="fabricante"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fabricante</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: WEG, Siemens" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="modelo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modelo</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: W22 Plus, S7-1200" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="equipamento_tipo"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Tipo de Equipamento</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: Motor elétrico, CLP, Inversor de frequência"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Indústria/Segmento */}
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Segmento (opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o segmento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MANUAL_INDUSTRIES.map((ind) => (
                          <SelectItem key={ind.value} value={ind.value}>
                            {ind.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Deixe em branco para manuais aplicáveis a qualquer segmento
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Toggle is_public - apenas para admin_kraflo */}
              {isAdminKraflo && (
                <FormField
                  control={form.control}
                  name="is_public"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Biblioteca Pública
                        </FormLabel>
                        <FormDescription>
                          Tornar este manual acessível para todas as empresas
                          (somente leitura)
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              {/* Progress Bar */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {progressMessage || 'Processando...'}
                    </span>
                    <span className="text-primary">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Upload Button */}
              <Button
                type="button"
                onClick={handlePreSubmit}
                disabled={!file || isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando Manual...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Revisar e Enviar
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Upload</DialogTitle>
            <DialogDescription>
              Revise as informações antes de enviar o manual para processamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Arquivo:</span>
                <p className="font-medium">{file?.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo:</span>
                <p className="font-medium">
                  {MANUAL_TYPES.find((t) => t.value === watchManualType)?.label}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Categoria:</span>
                <p className="font-medium">
                  {MANUAL_CATEGORIES.find((c) => c.value === form.getValues('category'))
                    ?.label}
                </p>
              </div>
              {form.getValues('industry') && (
                <div>
                  <span className="text-muted-foreground">Segmento:</span>
                  <p className="font-medium">
                    {MANUAL_INDUSTRIES.find((i) => i.value === form.getValues('industry'))
                      ?.label}
                  </p>
                </div>
              )}
            </div>
            {watchTags.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">Tags:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {watchTags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {watchManualType === 'equipment' && (
              <div className="text-sm">
                <span className="text-muted-foreground">Equipamento:</span>
                <p className="font-medium">
                  {[
                    form.getValues('fabricante'),
                    form.getValues('modelo'),
                    form.getValues('equipamento_tipo'),
                  ]
                    .filter(Boolean)
                    .join(' - ') || 'Não especificado'}
                </p>
              </div>
            )}
            {form.getValues('is_public') && (
              <Badge variant="outline" className="text-primary">
                Será adicionado à biblioteca pública
              </Badge>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Voltar e Editar
            </Button>
            <Button onClick={handleConfirmUpload}>
              Confirmar Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

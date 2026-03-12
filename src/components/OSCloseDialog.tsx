import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOSCategories } from '@/hooks/useOSCategories';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Loader2, X, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';

interface OS {
  id: number;
  equipamento_nome: string;
  empresa_id: string;
}

interface Peca {
  nome_peca: string;
  tag_peca: string;
  quantidade: number;
}

interface OSCloseDialogProps {
  open: boolean;
  os: OS | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function OSCloseDialog({ open, os, onClose, onSuccess }: OSCloseDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [diagnostico, setDiagnostico] = useState('');
  const [notasFinais, setNotasFinais] = useState('');
  const [statusFinal, setStatusFinal] = useState<'Fechada' | 'Liberado para produção' | 'Não liberado'>('Fechada');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  
  // Causa raiz
  const [categoriaProblemaId, setCategoriaProblemaId] = useState('');
  const [subcategoriaProblemaId, setSubcategoriaProblemaId] = useState('');
  const { categoriasProblema, subcategorias } = useOSCategories();
  
  const subcategoriasFiltradasProblema = useMemo(() => {
    if (!categoriaProblemaId) return [];
    return subcategorias.filter(
      (s) => s.categoria_id === categoriaProblemaId && s.tipo_categoria === 'problema'
    );
  }, [categoriaProblemaId, subcategorias]);
  
  // Peças utilizadas
  const [usouPecas, setUsouPecas] = useState(false);
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [novaPeca, setNovaPeca] = useState<Peca>({ nome_peca: '', tag_peca: '', quantidade: 1 });

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFoto = () => {
    setFoto(null);
    setFotoPreview(null);
  };

  const adicionarPeca = () => {
    if (!novaPeca.nome_peca.trim()) {
      toast.error('Informe o nome da peça');
      return;
    }
    if (novaPeca.quantidade < 1) {
      toast.error('Quantidade deve ser pelo menos 1');
      return;
    }
    setPecas([...pecas, { ...novaPeca }]);
    setNovaPeca({ nome_peca: '', tag_peca: '', quantidade: 1 });
  };

  const removerPeca = (index: number) => {
    setPecas(pecas.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!os) return;

    if (!categoriaProblemaId) {
      toast.error('Selecione a causa raiz');
      return;
    }

    if (!diagnostico.trim()) {
      toast.error('Preencha o diagnóstico/causa');
      return;
    }

    if (!notasFinais.trim()) {
      toast.error('Preencha as notas finais / serviço realizado');
      return;
    }

    setIsLoading(true);
    try {
      let urlArquivoFechamento = null;

      // Upload foto se existir
      if (foto) {
        const fileExt = foto.name.split('.').pop();
        const fileName = `fechamento_${os.id}_${Date.now()}.${fileExt}`;
        const filePath = `${os.empresa_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('anexos-os')
          .upload(filePath, foto);

        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage
          .from('anexos-os')
          .getPublicUrl(filePath);

        urlArquivoFechamento = publicUrl.publicUrl;
      }

      // Atualizar OS
      const { error } = await supabase
        .from('ordens_de_servico')
        .update({
          status_os: statusFinal,
          data_fechamento: new Date().toISOString(),
          diagnostico_solucao: diagnostico,
          notas_finais: notasFinais,
          url_arquivo_fechamento: urlArquivoFechamento,
          categoria_problema_id: categoriaProblemaId || null,
          subcategoria_problema_id: subcategoriaProblemaId || null,
        })
        .eq('id', os.id);

      if (error) throw error;

      // Inserir peças utilizadas se houver
      if (usouPecas && pecas.length > 0) {
        const pecasData = pecas.map((peca) => ({
          ordem_id: os.id,
          nome_peca: peca.nome_peca,
          tag_peca: peca.tag_peca || null,
          quantidade: peca.quantidade,
        }));

        const { error: pecasError } = await supabase
          .from('pecas_utilizadas')
          .insert(pecasData);

        if (pecasError) throw pecasError;
      }

      toast.success('OS fechada com sucesso!');
      resetForm();
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error closing OS:', error);
      toast.error('Erro ao fechar OS');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setDiagnostico('');
    setNotasFinais('');
    setStatusFinal('Fechada');
    setFoto(null);
    setFotoPreview(null);
    setCategoriaProblemaId('');
    setSubcategoriaProblemaId('');
    setUsouPecas(false);
    setPecas([]);
    setNovaPeca({ nome_peca: '', tag_peca: '', quantidade: 1 });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Fechar OS #{os?.id} - {os?.equipamento_nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Final */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Status Final
              <span className="text-destructive">*</span>
            </Label>
            <Select 
              value={statusFinal} 
              onValueChange={(value) => setStatusFinal(value as 'Fechada' | 'Liberado para produção' | 'Não liberado')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Liberado para produção">Liberado para produção</SelectItem>
                <SelectItem value="Não liberado">Não liberado</SelectItem>
                <SelectItem value="Fechada">Fechada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Causa Raiz */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Causa Raiz
              <span className="text-destructive">*</span>
            </Label>
            <Select value={categoriaProblemaId} onValueChange={(v) => {
              setCategoriaProblemaId(v);
              setSubcategoriaProblemaId('');
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a causa raiz" />
              </SelectTrigger>
              <SelectContent>
                {categoriasProblema.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategoria da Causa Raiz */}
          {subcategoriasFiltradasProblema.length > 0 && (
            <div className="space-y-2">
              <Label>Subcategoria (opcional)</Label>
              <Select value={subcategoriaProblemaId} onValueChange={setSubcategoriaProblemaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a subcategoria" />
                </SelectTrigger>
                <SelectContent>
                  {subcategoriasFiltradasProblema.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>{sub.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Diagnóstico/Causa */}
          <div className="space-y-2">
            <Label htmlFor="diagnostico" className="flex items-center gap-1">
              Diagnóstico / Causa do Problema
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="diagnostico"
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              placeholder="Descreva a causa identificada do problema..."
              rows={3}
            />
          </div>

          {/* Notas Finais / Serviço Realizado */}
          <div className="space-y-2">
            <Label htmlFor="notasFinais" className="flex items-center gap-1">
              Notas Finais / Serviço Realizado
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="notasFinais"
              value={notasFinais}
              onChange={(e) => setNotasFinais(e.target.value)}
              placeholder="Descreva o serviço realizado para solucionar o problema..."
              rows={3}
            />
          </div>

          {/* Peças Utilizadas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="usouPecas">Foram utilizadas peças?</Label>
              <Switch
                id="usouPecas"
                checked={usouPecas}
                onCheckedChange={setUsouPecas}
              />
            </div>

            {usouPecas && (
              <div className="space-y-3 p-3 border border-border rounded-lg bg-secondary/20">
                {/* Lista de peças adicionadas */}
                {pecas.length > 0 && (
                  <div className="space-y-2">
                    {pecas.map((peca, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-background rounded border border-border"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{peca.nome_peca}</p>
                          <p className="text-xs text-muted-foreground">
                            {peca.tag_peca && `TAG: ${peca.tag_peca} • `}
                            Qtd: {peca.quantidade}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removerPeca(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulário para adicionar nova peça */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Nome da peça *"
                      value={novaPeca.nome_peca}
                      onChange={(e) =>
                        setNovaPeca({ ...novaPeca, nome_peca: e.target.value })
                      }
                    />
                    <Input
                      placeholder="TAG (opcional)"
                      value={novaPeca.tag_peca}
                      onChange={(e) =>
                        setNovaPeca({ ...novaPeca, tag_peca: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Quantidade"
                      value={novaPeca.quantidade}
                      onChange={(e) =>
                        setNovaPeca({ ...novaPeca, quantidade: parseInt(e.target.value) || 1 })
                      }
                      className="w-24"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={adicionarPeca}
                      className="flex-1"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Peça
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Upload de Foto */}
          <div className="space-y-2">
            <Label>Foto do Fechamento (opcional)</Label>
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
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary/30 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
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
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Fechar OS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Building2, 
  Cpu, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Settings2,
  Loader2,
  Check
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Setor {
  id: string;
  nome: string;
  descricao: string | null;
}

interface Maquina {
  id: string;
  tag: string | null;
  nome: string;
  fabricante: string | null;
  modelo: string | null;
  setor_id: string | null;
  situacao: string | null;
  setores?: { nome: string };
}

export default function Configuracoes() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('maquinas');
  
  // States for Dialogs
  const [isSetorDialogOpen, setIsSetorDialogOpen] = useState(false);
  const [isMaquinaDialogOpen, setIsMaquinaDialogOpen] = useState(false);
  const [editingSetor, setEditingSetor] = useState<Setor | null>(null);
  const [editingMaquina, setEditingMaquina] = useState<Maquina | null>(null);

  // Queries
  const { data: setores, isLoading: setoresLoading } = useQuery({
    queryKey: ['setores', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      const { data, error } = await (supabase
        .from('setores') as any)
        .select('*')
        .eq('empresa_id', profile.empresa_id as string)
        .order('nome');
      if (error) throw error;
      return data as Setor[];
    },
    enabled: !!profile?.empresa_id
  });

  const { data: maquinas, isLoading: maquinasLoading } = useQuery({
    queryKey: ['maquinas', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      const { data, error } = await (supabase
        .from('maquinas') as any)
        .select('*, setores(nome)')
        .eq('empresa_id', profile.empresa_id as string)
        .order('tag');
      if (error) throw error;
      return (data as any) as (Maquina & { setores: { nome: string } | null })[];
    },
    enabled: !!profile?.empresa_id
  });

  // Mutations - Setor
  const upsertSetor = useMutation({
    mutationFn: async (values: Partial<Setor>) => {
      if (!profile?.empresa_id) throw new Error("Empresa não identificada");
      
      const table = supabase.from('setores') as any;
      if (editingSetor) {
        const { error } = await table
          .update(values)
          .eq('id', editingSetor.id);
        if (error) throw error;
      } else {
        const { error } = await table
          .insert([{ ...values, empresa_id: profile.empresa_id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setores'] });
      setIsSetorDialogOpen(false);
      setEditingSetor(null);
      toast.success('Setor salvo com sucesso!');
    }
  });

  const deleteSetor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('setores') as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setores'] });
      toast.success('Setor removido.');
    }
  });

  // Mutations - Maquina
  const upsertMaquina = useMutation({
    mutationFn: async (values: Partial<Maquina>) => {
      if (!profile?.empresa_id) throw new Error("Empresa não identificada");

      const table = supabase.from('maquinas') as any;
      if (editingMaquina) {
        const { error } = await table
          .update(values)
          .eq('id', editingMaquina.id);
        if (error) throw error;
      } else {
        const { error } = await table
          .insert([{ ...values, empresa_id: profile.empresa_id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
      setIsMaquinaDialogOpen(false);
      setEditingMaquina(null);
      toast.success('Máquina salva com sucesso!');
    }
  });

  const deleteMaquina = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('maquinas') as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
      toast.success('Máquina removida.');
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Settings2 className="h-6 w-6 text-primary shadow-neon" />
          </div>
          <div>
            <h1 className="text-2xl font-mono font-bold tracking-tight text-foreground uppercase">
              Gestão de Ativos
            </h1>
            <p className="text-sm text-muted-foreground">
              Cadastre e gerencie os equipamentos e setores da sua indústria
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 border border-white/5 p-1 rounded-xl">
          <TabsTrigger value="maquinas" className="gap-2 rounded-lg px-6">
            <Cpu className="h-4 w-4" /> Máquinas
          </TabsTrigger>
          <TabsTrigger value="setores" className="gap-2 rounded-lg px-6">
            <Building2 className="h-4 w-4" /> Setores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="maquinas" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar máquina..." className="pl-9 glass-input" />
            </div>
            
            <Dialog open={isMaquinaDialogOpen} onOpenChange={(open) => {
              setIsMaquinaDialogOpen(open);
              if (!open) setEditingMaquina(null);
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-neon-blue">
                  <Plus className="h-4 w-4" /> Nova Máquina
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-panel border-white/10 sm:max-w-[500px]">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  upsertMaquina.mutate({
                    nome: formData.get('nome') as string,
                    tag: formData.get('tag') as string,
                    fabricante: formData.get('fabricante') as string,
                    modelo: formData.get('modelo') as string,
                    setor_id: formData.get('setor_id') as string || null,
                  });
                }}>
                  <DialogHeader>
                    <DialogTitle>{editingMaquina ? 'Editar Máquina' : 'Cadastrar Máquina'}</DialogTitle>
                    <DialogDescription>
                      Insira os detalhes técnicos do equipamento industrial.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="tag" className="text-right">TAG</Label>
                      <Input id="tag" name="tag" defaultValue={editingMaquina?.tag || ''} placeholder="M001" className="col-span-3" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="nome" className="text-right">Nome</Label>
                      <Input id="nome" name="nome" defaultValue={editingMaquina?.nome || ''} placeholder="Tear Circular" className="col-span-3" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="setor_id" className="text-right">Setor</Label>
                      <div className="col-span-3">
                        <Select name="setor_id" defaultValue={editingMaquina?.setor_id || ''}>
                          <SelectTrigger className="glass-input">
                            <SelectValue placeholder="Selecione um setor" />
                          </SelectTrigger>
                          <SelectContent>
                            {setores?.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="fabricante" className="text-right">Fabricante</Label>
                      <Input id="fabricante" name="fabricante" defaultValue={editingMaquina?.fabricante || ''} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="modelo" className="text-right">Modelo</Label>
                      <Input id="modelo" name="modelo" defaultValue={editingMaquina?.modelo || ''} className="col-span-3" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setIsMaquinaDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={upsertMaquina.isPending}>
                      {upsertMaquina.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salvar Máquina
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="glass-panel border-white/5 overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow>
                    <TableHead className="w-[100px]">TAG</TableHead>
                    <TableHead>Máquina</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Fabricante/Modelo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maquinasLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : maquinas?.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma máquina cadastrada.</TableCell></TableRow>
                  ) : maquinas?.map((m) => (
                    <TableRow key={m.id} className="hover:bg-white/5 transition-colors">
                      <TableCell className="font-mono font-bold text-primary">{m.tag}</TableCell>
                      <TableCell className="font-medium">{m.nome}</TableCell>
                      <TableCell>
                        {m.setores ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            {m.setores.nome}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {m.fabricante} {m.modelo && `/ ${m.modelo}`}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingMaquina(m);
                          setIsMaquinaDialogOpen(true);
                        }} className="hover:text-primary">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                          if (window.confirm('Deseja realmente excluir esta máquina?')) {
                            deleteMaquina.mutate(m.id);
                          }
                        }} className="hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="setores" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-dashed border-white/20 bg-transparent hover:bg-white/5 transition-all cursor-pointer group flex flex-col items-center justify-center min-h-[160px]" onClick={() => {
            setEditingSetor(null);
            setIsSetorDialogOpen(true);
          }}>
            <div className="p-3 bg-primary/10 rounded-full group-hover:scale-110 transition-transform">
              <Plus className="h-6 w-6 text-primary shadow-neon" />
            </div>
            <p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted-foreground group-hover:text-primary">Novo Setor</p>
          </Card>

          {setoresLoading ? (
            <div className="col-span-full py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : setores?.map((s) => (
            <Card key={s.id} className="glass-panel border-white/5 hover:border-primary/30 transition-all group overflow-hidden">
              <CardHeader className="p-5 pb-2">
                <div className="flex items-center justify-between">
                  <div className="bg-blue-500/10 p-2 rounded-lg">
                    <Building2 className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button variant="ghost" size="sm" onClick={(e) => {
                      e.stopPropagation();
                      setEditingSetor(s);
                      setIsSetorDialogOpen(true);
                    }}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Excluir este setor removerá o vínculo de todas as máquinas vinculadas a ele. Continuar?')) {
                        deleteSetor.mutate(s.id);
                      }
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="mt-3 text-lg">{s.nome}</CardTitle>
                <CardDescription className="line-clamp-2 min-h-[40px]">
                  {s.descricao || 'Sem descrição cadastrada.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-4 border-t border-white/5 bg-black/20">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3 w-3" /> 
                    {maquinas?.filter(m => m.setor_id === s.id).length || 0} Máquinas
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-green-500" /> Ativo
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Setor Dialog */}
      <Dialog open={isSetorDialogOpen} onOpenChange={(open) => {
        setIsSetorDialogOpen(open);
        if (!open) setEditingSetor(null);
      }}>
        <DialogContent className="glass-panel border-white/10 sm:max-w-[425px]">
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            upsertSetor.mutate({
              nome: formData.get('nome') as string,
              descricao: formData.get('descricao') as string,
            });
          }}>
            <DialogHeader>
              <DialogTitle>{editingSetor ? 'Editar Setor' : 'Novo Setor'}</DialogTitle>
              <DialogDescription>
                Dê um nome e descrição para o setor da fábrica.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="s-nome">Nome do Setor</Label>
                <Input id="s-nome" name="nome" defaultValue={editingSetor?.nome || ''} placeholder="Ex: Tecelagem, Acabamento" required className="glass-input" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="s-desc">Descrição (Opcional)</Label>
                <Input id="s-desc" name="descricao" defaultValue={editingSetor?.descricao || ''} placeholder="Área principal de produção" className="glass-input" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsSetorDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={upsertSetor.isPending}>
                {upsertSetor.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Setor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

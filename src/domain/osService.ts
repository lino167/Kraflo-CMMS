import { supabase } from "@/integrations/supabase/client";

export interface CategoriaParada {
  id: string;
  nome: string;
  descricao: string;
}

export interface CategoriaProblema {
  id: string;
  nome: string;
  descricao: string;
}

export interface Subcategoria {
  id: string;
  nome: string;
  descricao: string;
  categoria_id: string;
  tipo_categoria: 'parada' | 'problema';
}

export class OSService {
  static async getCategoriasParada(): Promise<CategoriaParada[]> {
    const { data, error } = await supabase
      .from('categorias_parada')
      .select('id, nome, descricao')
      .eq('ativo', true)
      .order('ordem');
    
    if (error) throw error;
    return data || [];
  }

  static async getCategoriasProblema(): Promise<CategoriaProblema[]> {
    const { data, error } = await supabase
      .from('categorias_problema')
      .select('id, nome, descricao')
      .eq('ativo', true)
      .order('ordem');
    
    if (error) throw error;
    return data || [];
  }

  static async getSubcategorias(): Promise<Subcategoria[]> {
    const { data, error } = await supabase
      .from('subcategorias')
      .select('id, nome, descricao, categoria_id, tipo_categoria')
      .eq('ativo', true)
      .order('ordem');
    
    if (error) throw error;
    return data as Subcategoria[] || [];
  }

  static async runRetroactiveClassification(empresaId: string): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.functions.invoke('backfill-os-index', {
      body: { empresa_id: empresaId }
    });

    if (error) throw error;
    return data;
  }
}

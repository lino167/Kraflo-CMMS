import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

interface UseOSCategoriesResult {
  categoriasParada: CategoriaParada[];
  categoriasProblema: CategoriaProblema[];
  subcategorias: Subcategoria[];
  isLoading: boolean;
  getCategoriaParadaNome: (id: string | null | undefined) => string | null;
  getCategoriaProblemaName: (id: string | null | undefined) => string | null;
  getSubcategoriaName: (id: string | null | undefined) => string | null;
}

export function useOSCategories(): UseOSCategoriesResult {
  const [categoriasParada, setCategoriasParada] = useState<CategoriaParada[]>([]);
  const [categoriasProblema, setCategoriasProblema] = useState<CategoriaProblema[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const [paradaRes, problemaRes, subRes] = await Promise.all([
        supabase
          .from('categorias_parada')
          .select('id, nome, descricao')
          .eq('ativo', true)
          .order('ordem'),
        supabase
          .from('categorias_problema')
          .select('id, nome, descricao')
          .eq('ativo', true)
          .order('ordem'),
        supabase
          .from('subcategorias')
          .select('id, nome, descricao, categoria_id, tipo_categoria')
          .eq('ativo', true)
          .order('ordem'),
      ]);

      if (paradaRes.data) setCategoriasParada(paradaRes.data);
      if (problemaRes.data) setCategoriasProblema(problemaRes.data);
      if (subRes.data) setSubcategorias(subRes.data as Subcategoria[]);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const getCategoriaParadaNome = useCallback(
    (id: string | null | undefined): string | null => {
      if (!id) return null;
      const cat = categoriasParada.find((c) => c.id === id);
      return cat?.nome ?? null;
    },
    [categoriasParada]
  );

  const getCategoriaProblemaName = useCallback(
    (id: string | null | undefined): string | null => {
      if (!id) return null;
      const cat = categoriasProblema.find((c) => c.id === id);
      return cat?.nome ?? null;
    },
    [categoriasProblema]
  );

  const getSubcategoriaName = useCallback(
    (id: string | null | undefined): string | null => {
      if (!id) return null;
      const sub = subcategorias.find((s) => s.id === id);
      return sub?.nome ?? null;
    },
    [subcategorias]
  );

  return {
    categoriasParada,
    categoriasProblema,
    subcategorias,
    isLoading,
    getCategoriaParadaNome,
    getCategoriaProblemaName,
    getSubcategoriaName,
  };
}

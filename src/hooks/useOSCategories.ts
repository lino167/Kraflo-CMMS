import { useState, useEffect, useCallback } from 'react';
import { OSService, CategoriaParada, CategoriaProblema, Subcategoria } from '@/domain/osService';

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
      const [parada, problema, sub] = await Promise.all([
        OSService.getCategoriasParada(),
        OSService.getCategoriasProblema(),
        OSService.getSubcategorias()
      ]);

      setCategoriasParada(parada);
      setCategoriasProblema(problema);
      setSubcategorias(sub);
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
      return categoriasParada.find((c) => c.id === id)?.nome ?? null;
    },
    [categoriasParada]
  );

  const getCategoriaProblemaName = useCallback(
    (id: string | null | undefined): string | null => {
      if (!id) return null;
      return categoriasProblema.find((c) => c.id === id)?.nome ?? null;
    },
    [categoriasProblema]
  );

  const getSubcategoriaName = useCallback(
    (id: string | null | undefined): string | null => {
      if (!id) return null;
      return subcategorias.find((s) => s.id === id)?.nome ?? null;
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

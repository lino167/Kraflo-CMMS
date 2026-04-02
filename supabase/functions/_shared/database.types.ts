export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ia_conversas: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          tecnico_id: number | null
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          id?: string
          tecnico_id?: number | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          tecnico_id?: number | null
        }
      }
      ia_mensagens: {
        Row: {
          content: string
          conversa_id: string
          created_at: string | null
          fontes: Json | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversa_id: string
          created_at?: string | null
          fontes?: Json | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversa_id?: string
          created_at?: string | null
          fontes?: Json | null
          id?: string
          role?: string
        }
      }
      manuais: {
        Row: {
          id: string
          nome_arquivo: string
          fabricante: string | null
          modelo: string | null
          equipamento_tipo: string | null
          empresa_id: string | null
        }
      }
      manual_chunks: {
        Row: {
          id: string
          manual_id: string
          conteudo: string
          pagina: number | null
          embedding: string | null
        }
      }
      ordens_de_servico: {
        Row: {
          id: number
          equipamento_nome: string
          descricao_problema: string | null
          diagnostico_solucao: string | null
          notas_finais: string | null
          status_os: string
          empresa_id: string
        }
      }
    }
    Functions: {
      is_admin_kraflo: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: { _user_id: string; _role: string }
        Returns: boolean
      }
      search_manual_chunks: {
        Args: { 
            query_embedding: string; 
            match_threshold: number; 
            match_count: number; 
            filter_empresa_id?: string 
        }
        Returns: any[]
      }
      search_os_similares: {
        Args: { 
            query_embedding: string; 
            match_threshold: number; 
            match_count: number; 
            filter_empresa_id?: string 
        }
        Returns: any[]
      }
    }
  }
}

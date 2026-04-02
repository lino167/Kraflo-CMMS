export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bot_user_states: {
        Row: {
          data: Json | null
          id_telegram: number
          state: string
          updated_at: string | null
        }
        Insert: {
          data?: Json | null
          id_telegram: number
          state: string
          updated_at?: string | null
        }
        Update: {
          data?: Json | null
          id_telegram?: number
          state?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      categorias_parada: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string
          empresa_id: string
          exemplos: string[] | null
          id: string
          nome: string
          ordem: number
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao: string
          empresa_id: string
          exemplos?: string[] | null
          id?: string
          nome: string
          ordem: number
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string
          empresa_id?: string
          exemplos?: string[] | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_parada_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_problema: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string
          empresa_id: string
          exemplos: string[] | null
          frequencia: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao: string
          empresa_id: string
          exemplos?: string[] | null
          frequencia?: string | null
          id?: string
          nome: string
          ordem: number
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string
          empresa_id?: string
          exemplos?: string[] | null
          frequencia?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_problema_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_benchmarks: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          mtbf_alvo_dias: number | null
          mttr_alvo_horas: number | null
          peso_falhas: number | null
          peso_mttr: number | null
          peso_reincidencia: number | null
          taxa_resolucao_alvo: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          mtbf_alvo_dias?: number | null
          mttr_alvo_horas?: number | null
          peso_falhas?: number | null
          peso_mttr?: number | null
          peso_reincidencia?: number | null
          taxa_resolucao_alvo?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          mtbf_alvo_dias?: number | null
          mttr_alvo_horas?: number | null
          peso_falhas?: number | null
          peso_mttr?: number | null
          peso_reincidencia?: number | null
          taxa_resolucao_alvo?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_benchmarks_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          created_at: string
          id: string
          nome_empresa: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome_empresa: string
        }
        Update: {
          created_at?: string
          id?: string
          nome_empresa?: string
        }
        Relationships: []
      }
      execucoes_preventivas: {
        Row: {
          agendado_para: string
          checklist_resultado: Json | null
          created_at: string
          empresa_id: string
          executado_em: string | null
          id: string
          notas: string | null
          os_gerada_id: number | null
          status: Database["public"]["Enums"]["execucao_status"]
          tarefa_id: string
          tecnico_id: number | null
          updated_at: string
        }
        Insert: {
          agendado_para: string
          checklist_resultado?: Json | null
          created_at?: string
          empresa_id: string
          executado_em?: string | null
          id?: string
          notas?: string | null
          os_gerada_id?: number | null
          status?: Database["public"]["Enums"]["execucao_status"]
          tarefa_id: string
          tecnico_id?: number | null
          updated_at?: string
        }
        Update: {
          agendado_para?: string
          checklist_resultado?: Json | null
          created_at?: string
          empresa_id?: string
          executado_em?: string | null
          id?: string
          notas?: string | null
          os_gerada_id?: number | null
          status?: Database["public"]["Enums"]["execucao_status"]
          tarefa_id?: string
          tecnico_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "execucoes_preventivas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucoes_preventivas_os_gerada_id_fkey"
            columns: ["os_gerada_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucoes_preventivas_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas_preventivas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucoes_preventivas_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos"
            referencedColumns: ["id_telegram"]
          },
        ]
      }
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
        Relationships: [
          {
            foreignKeyName: "ia_conversas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_conversas_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos"
            referencedColumns: ["id_telegram"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "ia_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "ia_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      manuais: {
        Row: {
          category: Database["public"]["Enums"]["manual_category"] | null
          created_at: string | null
          empresa_id: string | null
          equipamento_id: string | null
          equipamento_tipo: string | null
          fabricante: string | null
          id: string
          industry: string | null
          is_public: boolean
          manual_type: Database["public"]["Enums"]["manual_type"]
          modelo: string | null
          nome_arquivo: string
          processado: boolean | null
          tags: string[] | null
          total_paginas: number | null
          url_arquivo: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["manual_category"] | null
          created_at?: string | null
          empresa_id?: string | null
          equipamento_id?: string | null
          equipamento_tipo?: string | null
          fabricante?: string | null
          id?: string
          industry?: string | null
          is_public?: boolean
          manual_type?: Database["public"]["Enums"]["manual_type"]
          modelo?: string | null
          nome_arquivo: string
          processado?: boolean | null
          tags?: string[] | null
          total_paginas?: number | null
          url_arquivo: string
        }
        Update: {
          category?: Database["public"]["Enums"]["manual_category"] | null
          created_at?: string | null
          empresa_id?: string | null
          equipamento_id?: string | null
          equipamento_tipo?: string | null
          fabricante?: string | null
          id?: string
          industry?: string | null
          is_public?: boolean
          manual_type?: Database["public"]["Enums"]["manual_type"]
          modelo?: string | null
          nome_arquivo?: string
          processado?: boolean | null
          tags?: string[] | null
          total_paginas?: number | null
          url_arquivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "manuais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_chunks: {
        Row: {
          conteudo: string
          created_at: string | null
          embedding: string | null
          id: string
          manual_id: string
          pagina: number | null
        }
        Insert: {
          conteudo: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          manual_id: string
          pagina?: number | null
        }
        Update: {
          conteudo?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          manual_id?: string
          pagina?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_chunks_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "manuais"
            referencedColumns: ["id"]
          },
        ]
      }
      maquinas: {
        Row: {
          created_at: string | null
          data_aquisicao: string | null
          empresa_id: string
          fabricante: string | null
          id: string
          modelo: string | null
          nome: string
          numero_serie: string | null
          setor_id: string | null
          situacao: string | null
          tag: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_aquisicao?: string | null
          empresa_id: string
          fabricante?: string | null
          id?: string
          modelo?: string | null
          nome: string
          numero_serie?: string | null
          setor_id?: string | null
          situacao?: string | null
          tag?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_aquisicao?: string | null
          empresa_id?: string
          fabricante?: string | null
          id?: string
          modelo?: string | null
          nome?: string
          numero_serie?: string | null
          setor_id?: string | null
          situacao?: string | null
          tag?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maquinas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maquinas_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_de_servico: {
        Row: {
          categoria_parada_id: string | null
          categoria_problema_id: string | null
          created_at: string
          data_abertura: string
          data_fechamento: string | null
          descricao_problema: string | null
          diagnostico_solucao: string | null
          embedding_version: number | null
          empresa_id: string
          equipamento_nome: string
          equipamento_tag: string | null
          execucao_origem_id: string | null
          id: number
          index_error: string | null
          index_status: Database["public"]["Enums"]["os_index_status"] | null
          last_indexed_at: string | null
          localizacao: string | null
          notas_finais: string | null
          origem: string | null
          plano_origem_id: string | null
          prioridade: string | null
          status_os: Database["public"]["Enums"]["os_status"]
          subcategoria_parada_id: string | null
          subcategoria_problema_id: string | null
          tecnico_id: number
          tipo_manutencao: string | null
          updated_at: string
          url_arquivo_fechamento: string | null
          url_foto: string | null
        }
        Insert: {
          categoria_parada_id?: string | null
          categoria_problema_id?: string | null
          created_at?: string
          data_abertura?: string
          data_fechamento?: string | null
          descricao_problema?: string | null
          diagnostico_solucao?: string | null
          embedding_version?: number | null
          empresa_id: string
          equipamento_nome: string
          equipamento_tag?: string | null
          execucao_origem_id?: string | null
          id?: number
          index_error?: string | null
          index_status?: Database["public"]["Enums"]["os_index_status"] | null
          last_indexed_at?: string | null
          localizacao?: string | null
          notas_finais?: string | null
          origem?: string | null
          plano_origem_id?: string | null
          prioridade?: string | null
          status_os?: Database["public"]["Enums"]["os_status"]
          subcategoria_parada_id?: string | null
          subcategoria_problema_id?: string | null
          tecnico_id: number
          tipo_manutencao?: string | null
          updated_at?: string
          url_arquivo_fechamento?: string | null
          url_foto?: string | null
        }
        Update: {
          categoria_parada_id?: string | null
          categoria_problema_id?: string | null
          created_at?: string
          data_abertura?: string
          data_fechamento?: string | null
          descricao_problema?: string | null
          diagnostico_solucao?: string | null
          embedding_version?: number | null
          empresa_id?: string
          equipamento_nome?: string
          equipamento_tag?: string | null
          execucao_origem_id?: string | null
          id?: number
          index_error?: string | null
          index_status?: Database["public"]["Enums"]["os_index_status"] | null
          last_indexed_at?: string | null
          localizacao?: string | null
          notas_finais?: string | null
          origem?: string | null
          plano_origem_id?: string | null
          prioridade?: string | null
          status_os?: Database["public"]["Enums"]["os_status"]
          subcategoria_parada_id?: string | null
          subcategoria_problema_id?: string | null
          tecnico_id?: number
          tipo_manutencao?: string | null
          updated_at?: string
          url_arquivo_fechamento?: string | null
          url_foto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_de_servico_categoria_parada_id_fkey"
            columns: ["categoria_parada_id"]
            isOneToOne: false
            referencedRelation: "categorias_parada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_de_servico_categoria_problema_id_fkey"
            columns: ["categoria_problema_id"]
            isOneToOne: false
            referencedRelation: "categorias_problema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_de_servico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_de_servico_execucao_origem_id_fkey"
            columns: ["execucao_origem_id"]
            isOneToOne: false
            referencedRelation: "execucoes_preventivas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_de_servico_plano_origem_id_fkey"
            columns: ["plano_origem_id"]
            isOneToOne: false
            referencedRelation: "planos_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_de_servico_subcategoria_parada_id_fkey"
            columns: ["subcategoria_parada_id"]
            isOneToOne: false
            referencedRelation: "subcategorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_de_servico_subcategoria_problema_id_fkey"
            columns: ["subcategoria_problema_id"]
            isOneToOne: false
            referencedRelation: "subcategorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_de_servico_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos"
            referencedColumns: ["id_telegram"]
          },
        ]
      }
      os_embeddings: {
        Row: {
          created_at: string | null
          embedding: string | null
          embedding_version: number | null
          empresa_id: string | null
          id: string
          ordem_id: number
          texto_indexado: string
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          embedding_version?: number | null
          empresa_id?: string | null
          id?: string
          ordem_id: number
          texto_indexado: string
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          embedding_version?: number | null
          empresa_id?: string | null
          id?: string
          ordem_id?: number
          texto_indexado?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_embeddings_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_embeddings_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: true
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_index_jobs: {
        Row: {
          attempts: number
          created_at: string
          embedding_version: number
          empresa_id: string
          id: string
          last_error: string | null
          next_run_at: string
          os_id: number
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          embedding_version?: number
          empresa_id: string
          id?: string
          last_error?: string | null
          next_run_at?: string
          os_id: number
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          embedding_version?: number
          empresa_id?: string
          id?: string
          last_error?: string | null
          next_run_at?: string
          os_id?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_index_jobs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pecas_utilizadas: {
        Row: {
          created_at: string
          id: number
          nome_peca: string
          ordem_id: number
          quantidade: number
          tag_peca: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          nome_peca: string
          ordem_id: number
          quantidade: number
          tag_peca?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          nome_peca?: string
          ordem_id?: number
          quantidade?: number
          tag_peca?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pecas_utilizadas_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_manutencao: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          empresa_id: string
          equipamento_nome: string | null
          equipamento_tag: string | null
          fabricante: string | null
          id: string
          modelo: string | null
          objetivo: string | null
          periodicidade: Database["public"]["Enums"]["periodicidade_manutencao"]
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          empresa_id: string
          equipamento_nome?: string | null
          equipamento_tag?: string | null
          fabricante?: string | null
          id?: string
          modelo?: string | null
          objetivo?: string | null
          periodicidade?: Database["public"]["Enums"]["periodicidade_manutencao"]
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          equipamento_nome?: string | null
          equipamento_tag?: string | null
          fabricante?: string | null
          id?: string
          modelo?: string | null
          objetivo?: string | null
          periodicidade?: Database["public"]["Enums"]["periodicidade_manutencao"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_manutencao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          codigo_empresa: string | null
          created_at: string
          email: string | null
          empresa_id: string | null
          funcao: string | null
          id: string
          id_telegram: number | null
          nome_completo: string | null
          nome_empresa: string | null
          setor: string | null
          updated_at: string
        }
        Insert: {
          codigo_empresa?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          funcao?: string | null
          id: string
          id_telegram?: number | null
          nome_completo?: string | null
          nome_empresa?: string | null
          setor?: string | null
          updated_at?: string
        }
        Update: {
          codigo_empresa?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          funcao?: string | null
          id?: string
          id_telegram?: number | null
          nome_completo?: string | null
          nome_empresa?: string | null
          setor?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          created_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategorias: {
        Row: {
          ativo: boolean | null
          categoria_id: string
          created_at: string | null
          descricao: string
          empresa_id: string
          exemplos: string[] | null
          id: string
          nome: string
          ordem: number
          tipo_categoria: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria_id: string
          created_at?: string | null
          descricao: string
          empresa_id: string
          exemplos?: string[] | null
          id?: string
          nome: string
          ordem: number
          tipo_categoria: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria_id?: string
          created_at?: string | null
          descricao?: string
          empresa_id?: string
          exemplos?: string[] | null
          id?: string
          nome?: string
          ordem?: number
          tipo_categoria?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcategorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_preventivas: {
        Row: {
          ativo: boolean
          checklist: Json | null
          created_at: string
          descricao: string | null
          id: string
          intervalo_dias: number
          ordem: number | null
          plano_id: string
          tags: string[] | null
          tempo_estimado_minutos: number | null
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          checklist?: Json | null
          created_at?: string
          descricao?: string | null
          id?: string
          intervalo_dias?: number
          ordem?: number | null
          plano_id: string
          tags?: string[] | null
          tempo_estimado_minutos?: number | null
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          checklist?: Json | null
          created_at?: string
          descricao?: string | null
          id?: string
          intervalo_dias?: number
          ordem?: number | null
          plano_id?: string
          tags?: string[] | null
          tempo_estimado_minutos?: number | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_preventivas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_manutencao"
            referencedColumns: ["id"]
          },
        ]
      }
      tecnicos: {
        Row: {
          codigo_empresa: string | null
          created_at: string
          empresa_id: string
          funcao: string | null
          id_telegram: number
          nome_completo: string
          setor: string | null
        }
        Insert: {
          codigo_empresa?: string | null
          created_at?: string
          empresa_id: string
          funcao?: string | null
          id_telegram: number
          nome_completo: string
          setor?: string | null
        }
        Update: {
          codigo_empresa?: string | null
          created_at?: string
          empresa_id?: string
          funcao?: string | null
          id_telegram?: number
          nome_completo?: string
          setor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tecnicos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_empresa_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_kraflo: { Args: { _user_id: string }; Returns: boolean }
      search_manual_chunks: {
        Args: {
          filter_empresa_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          conteudo: string
          equipamento_tipo: string
          id: string
          manual_id: string
          nome_arquivo: string
          pagina: number
          similarity: number
        }[]
      }
      search_os_similares: {
        Args: {
          filter_empresa_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          descricao_problema: string
          diagnostico_solucao: string
          equipamento_nome: string
          id: string
          notas_finais: string
          ordem_id: number
          similarity: number
          texto_indexado: string
        }[]
      }
    }
    Enums: {
      app_role: "admin_kraflo" | "admin_empresa"
      execucao_status:
        | "agendada"
        | "em_andamento"
        | "concluida"
        | "cancelada"
        | "atrasada"
      manual_category:
        | "eletrica"
        | "pneumatica"
        | "hidraulica"
        | "seguranca"
        | "preventiva"
        | "lubrificacao"
        | "troubleshooting"
        | "mecanica"
        | "automacao"
        | "instrumentacao"
        | "geral"
      manual_type: "general" | "equipment"
      os_index_status: "pending" | "queued" | "indexing" | "indexed" | "error"
      os_status:
        | "Aberta"
        | "Em manutenção"
        | "Não liberado"
        | "Fechada"
        | "Liberado para produção"
      periodicidade_manutencao:
        | "diaria"
        | "semanal"
        | "quinzenal"
        | "mensal"
        | "bimestral"
        | "trimestral"
        | "semestral"
        | "anual"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] | DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin_kraflo", "admin_empresa"],
      execucao_status: [
        "agendada",
        "em_andamento",
        "concluida",
        "cancelada",
        "atrasada",
      ],
      manual_category: [
        "eletrica",
        "pneumatica",
        "hidraulica",
        "seguranca",
        "preventiva",
        "lubrificacao",
        "troubleshooting",
        "mecanica",
        "automacao",
        "instrumentacao",
        "geral",
      ],
      manual_type: ["general", "equipment"],
      os_index_status: ["pending", "queued", "indexing", "indexed", "error"],
      os_status: [
        "Aberta",
        "Em manutenção",
        "Não liberado",
        "Fechada",
        "Liberado para produção",
      ],
      periodicidade_manutencao: [
        "diaria",
        "semanal",
        "quinzenal",
        "mensal",
        "bimestral",
        "trimestral",
        "semestral",
        "anual",
      ],
    },
  },
} as const

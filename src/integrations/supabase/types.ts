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
      application_logs: {
        Row: {
          corretor_id: string | null
          created_at: string
          error_stack: string | null
          event: string
          execution_time_ms: number | null
          function_name: string
          id: string
          lead_id: string | null
          level: Database["public"]["Enums"]["log_level"]
          message: string | null
          metadata: Json | null
          request_id: string | null
          timestamp: string
          user_id: string | null
        }
        Insert: {
          corretor_id?: string | null
          created_at?: string
          error_stack?: string | null
          event: string
          execution_time_ms?: number | null
          function_name: string
          id?: string
          lead_id?: string | null
          level: Database["public"]["Enums"]["log_level"]
          message?: string | null
          metadata?: Json | null
          request_id?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          corretor_id?: string | null
          created_at?: string
          error_stack?: string | null
          event?: string
          execution_time_ms?: number | null
          function_name?: string
          id?: string
          lead_id?: string | null
          level?: Database["public"]["Enums"]["log_level"]
          message?: string | null
          metadata?: Json | null
          request_id?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_logs_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_logs_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bairros: {
        Row: {
          ativo: boolean | null
          cidade: string
          created_at: string | null
          estado: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          cidade: string
          created_at?: string | null
          estado?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          cidade?: string
          created_at?: string | null
          estado?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      communication_log: {
        Row: {
          content: string
          corretor_id: string | null
          created_at: string | null
          direction: Database["public"]["Enums"]["communication_direction"]
          id: string
          lead_id: string | null
          message_id: string | null
          metadata: Json | null
          phone_number: string | null
          status: string | null
          type: Database["public"]["Enums"]["communication_type"]
        }
        Insert: {
          content: string
          corretor_id?: string | null
          created_at?: string | null
          direction: Database["public"]["Enums"]["communication_direction"]
          id?: string
          lead_id?: string | null
          message_id?: string | null
          metadata?: Json | null
          phone_number?: string | null
          status?: string | null
          type: Database["public"]["Enums"]["communication_type"]
        }
        Update: {
          content?: string
          corretor_id?: string | null
          created_at?: string | null
          direction?: Database["public"]["Enums"]["communication_direction"]
          id?: string
          lead_id?: string | null
          message_id?: string | null
          metadata?: Json | null
          phone_number?: string | null
          status?: string | null
          type?: Database["public"]["Enums"]["communication_type"]
        }
        Relationships: [
          {
            foreignKeyName: "communication_log_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      construtoras: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      corretor_bairros: {
        Row: {
          bairro_id: string | null
          corretor_id: string | null
          created_at: string | null
          id: string
        }
        Insert: {
          bairro_id?: string | null
          corretor_id?: string | null
          created_at?: string | null
          id?: string
        }
        Update: {
          bairro_id?: string | null
          corretor_id?: string | null
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "corretor_bairros_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corretor_bairros_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corretor_bairros_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      corretor_construtoras: {
        Row: {
          construtora_id: string | null
          corretor_id: string | null
          created_at: string | null
          id: string
        }
        Insert: {
          construtora_id?: string | null
          corretor_id?: string | null
          created_at?: string | null
          id?: string
        }
        Update: {
          construtora_id?: string | null
          corretor_id?: string | null
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "corretor_construtoras_construtora_id_fkey"
            columns: ["construtora_id"]
            isOneToOne: false
            referencedRelation: "construtoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corretor_construtoras_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corretor_construtoras_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      corretores: {
        Row: {
          avg_response_time_minutes: number | null
          cidade: string | null
          cpf: string | null
          created_at: string | null
          creci: string
          data_avaliacao: string | null
          deleted_at: string | null
          email: string | null
          estado: Database["public"]["Enums"]["estado_brasil_enum"] | null
          id: string
          last_activity_at: string | null
          nota_media: number | null
          observacoes: string | null
          profile_id: string
          status: Database["public"]["Enums"]["corretor_status"] | null
          telefone: string | null
          tipo_imovel: Database["public"]["Enums"]["tipo_imovel_enum"] | null
          total_accepts: number | null
          total_rejects: number | null
          total_visitas: number | null
          updated_at: string | null
          whatsapp: string
        }
        Insert: {
          avg_response_time_minutes?: number | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string | null
          creci: string
          data_avaliacao?: string | null
          deleted_at?: string | null
          email?: string | null
          estado?: Database["public"]["Enums"]["estado_brasil_enum"] | null
          id?: string
          last_activity_at?: string | null
          nota_media?: number | null
          observacoes?: string | null
          profile_id: string
          status?: Database["public"]["Enums"]["corretor_status"] | null
          telefone?: string | null
          tipo_imovel?: Database["public"]["Enums"]["tipo_imovel_enum"] | null
          total_accepts?: number | null
          total_rejects?: number | null
          total_visitas?: number | null
          updated_at?: string | null
          whatsapp: string
        }
        Update: {
          avg_response_time_minutes?: number | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string | null
          creci?: string
          data_avaliacao?: string | null
          deleted_at?: string | null
          email?: string | null
          estado?: Database["public"]["Enums"]["estado_brasil_enum"] | null
          id?: string
          last_activity_at?: string | null
          nota_media?: number | null
          observacoes?: string | null
          profile_id?: string
          status?: Database["public"]["Enums"]["corretor_status"] | null
          telefone?: string | null
          tipo_imovel?: Database["public"]["Enums"]["tipo_imovel_enum"] | null
          total_accepts?: number | null
          total_rejects?: number | null
          total_visitas?: number | null
          updated_at?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "corretores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_attempts: {
        Row: {
          attempt_order: number
          corretor_id: string
          created_at: string
          id: string
          lead_id: string
          message_sent_at: string
          queue_id: string | null
          response_message: string | null
          response_received_at: string | null
          response_type: string | null
          status: string
          timeout_at: string
          whatsapp_message_id: string | null
        }
        Insert: {
          attempt_order: number
          corretor_id: string
          created_at?: string
          id?: string
          lead_id: string
          message_sent_at?: string
          queue_id?: string | null
          response_message?: string | null
          response_received_at?: string | null
          response_type?: string | null
          status?: string
          timeout_at: string
          whatsapp_message_id?: string | null
        }
        Update: {
          attempt_order?: number
          corretor_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          message_sent_at?: string
          queue_id?: string | null
          response_message?: string | null
          response_received_at?: string | null
          response_type?: string | null
          status?: string
          timeout_at?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_attempts_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_attempts_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_attempts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_attempts_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "distribution_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_metrics: {
        Row: {
          avg_response_time_minutes: number | null
          created_at: string
          date: string
          failed_distributions: number | null
          id: string
          successful_distributions: number | null
          total_accepts: number | null
          total_attempts: number | null
          total_distributions: number | null
          total_rejects: number | null
          total_timeouts: number | null
          updated_at: string
        }
        Insert: {
          avg_response_time_minutes?: number | null
          created_at?: string
          date: string
          failed_distributions?: number | null
          id?: string
          successful_distributions?: number | null
          total_accepts?: number | null
          total_attempts?: number | null
          total_distributions?: number | null
          total_rejects?: number | null
          total_timeouts?: number | null
          updated_at?: string
        }
        Update: {
          avg_response_time_minutes?: number | null
          created_at?: string
          date?: string
          failed_distributions?: number | null
          id?: string
          successful_distributions?: number | null
          total_accepts?: number | null
          total_attempts?: number | null
          total_distributions?: number | null
          total_rejects?: number | null
          total_timeouts?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      distribution_queue: {
        Row: {
          assigned_corretor_id: string | null
          completed_at: string | null
          created_at: string
          current_attempt: number
          failure_reason: string | null
          id: string
          lead_id: string
          started_at: string
          status: string
        }
        Insert: {
          assigned_corretor_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_attempt?: number
          failure_reason?: string | null
          id?: string
          lead_id: string
          started_at?: string
          status?: string
        }
        Update: {
          assigned_corretor_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_attempt?: number
          failure_reason?: string | null
          id?: string
          lead_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_queue_assigned_corretor_id_fkey"
            columns: ["assigned_corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_queue_assigned_corretor_id_fkey"
            columns: ["assigned_corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_settings: {
        Row: {
          auto_distribution_enabled: boolean
          created_at: string
          fallback_to_admin: boolean
          id: string
          max_attempts: number
          notification_method: string
          timeout_minutes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_distribution_enabled?: boolean
          created_at?: string
          fallback_to_admin?: boolean
          id?: string
          max_attempts?: number
          notification_method?: string
          timeout_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_distribution_enabled?: boolean
          created_at?: string
          fallback_to_admin?: boolean
          id?: string
          max_attempts?: number
          notification_method?: string
          timeout_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      empreendimentos: {
        Row: {
          ativo: boolean | null
          bairro_id: string | null
          construtora_id: string | null
          created_at: string | null
          descricao: string | null
          endereco: string | null
          id: string
          nome: string
          tipo_imovel: Database["public"]["Enums"]["tipo_imovel_enum"] | null
          updated_at: string | null
          valor_max: number | null
          valor_min: number | null
          wp_post_id: number | null
        }
        Insert: {
          ativo?: boolean | null
          bairro_id?: string | null
          construtora_id?: string | null
          created_at?: string | null
          descricao?: string | null
          endereco?: string | null
          id?: string
          nome: string
          tipo_imovel?: Database["public"]["Enums"]["tipo_imovel_enum"] | null
          updated_at?: string | null
          valor_max?: number | null
          valor_min?: number | null
          wp_post_id?: number | null
        }
        Update: {
          ativo?: boolean | null
          bairro_id?: string | null
          construtora_id?: string | null
          created_at?: string | null
          descricao?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          tipo_imovel?: Database["public"]["Enums"]["tipo_imovel_enum"] | null
          updated_at?: string | null
          valor_max?: number | null
          valor_min?: number | null
          wp_post_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "empreendimentos_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empreendimentos_construtora_id_fkey"
            columns: ["construtora_id"]
            isOneToOne: false
            referencedRelation: "construtoras"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_log: {
        Row: {
          corretor_id: string | null
          created_at: string | null
          data_envio: string | null
          data_resposta: string | null
          id: string
          lead_id: string | null
          ordem_prioridade: number
          resposta: string | null
          tempo_resposta_minutos: number | null
        }
        Insert: {
          corretor_id?: string | null
          created_at?: string | null
          data_envio?: string | null
          data_resposta?: string | null
          id?: string
          lead_id?: string | null
          ordem_prioridade: number
          resposta?: string | null
          tempo_resposta_minutos?: number | null
        }
        Update: {
          corretor_id?: string | null
          created_at?: string | null
          data_envio?: string | null
          data_resposta?: string | null
          id?: string
          lead_id?: string | null
          ordem_prioridade?: number
          resposta?: string | null
          tempo_resposta_minutos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_log_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_log_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          corretor_designado_id: string | null
          created_at: string | null
          created_by: string | null
          data_visita_solicitada: string
          email: string | null
          empreendimento_id: string | null
          horario_visita_solicitada: string
          id: string
          nome: string
          observacoes: string | null
          origem: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          telefone: string
          updated_at: string | null
        }
        Insert: {
          corretor_designado_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_visita_solicitada: string
          email?: string | null
          empreendimento_id?: string | null
          horario_visita_solicitada: string
          id?: string
          nome: string
          observacoes?: string | null
          origem?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          telefone: string
          updated_at?: string | null
        }
        Update: {
          corretor_designado_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_visita_solicitada?: string
          email?: string | null
          empreendimento_id?: string | null
          horario_visita_solicitada?: string
          id?: string
          nome?: string
          observacoes?: string | null
          origem?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          telefone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_corretor_designado_id_fkey"
            columns: ["corretor_designado_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_corretor_designado_id_fkey"
            columns: ["corretor_designado_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          button_config: Json | null
          category: Database["public"]["Enums"]["template_category"]
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_system: boolean
          list_config: Json | null
          media_config: Json | null
          metadata: Json | null
          name: string
          subject: string | null
          type: Database["public"]["Enums"]["communication_channel"]
          updated_at: string
          variables: Json | null
        }
        Insert: {
          button_config?: Json | null
          category: Database["public"]["Enums"]["template_category"]
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          list_config?: Json | null
          media_config?: Json | null
          metadata?: Json | null
          name: string
          subject?: string | null
          type: Database["public"]["Enums"]["communication_channel"]
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          button_config?: Json | null
          category?: Database["public"]["Enums"]["template_category"]
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          list_config?: Json | null
          media_config?: Json | null
          metadata?: Json | null
          name?: string
          subject?: string | null
          type?: Database["public"]["Enums"]["communication_channel"]
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          read_at: string | null
          related_corretor_id: string | null
          related_lead_id: string | null
          related_visit_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          read_at?: string | null
          related_corretor_id?: string | null
          related_lead_id?: string | null
          related_visit_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          read_at?: string | null
          related_corretor_id?: string | null
          related_lead_id?: string | null
          related_visit_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_corretor_id_fkey"
            columns: ["related_corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_corretor_id_fkey"
            columns: ["related_corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_visit_id_fkey"
            columns: ["related_visit_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          created_at: string
          expires_at: string
          key: string
        }
        Insert: {
          count?: number
          created_at?: string
          expires_at?: string
          key: string
        }
        Update: {
          count?: number
          created_at?: string
          expires_at?: string
          key?: string
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          template_config: Json
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          template_config: Json
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          template_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          created_at: string
          created_by: string
          email_message: string | null
          email_subject: string
          id: string
          is_active: boolean
          last_run: string | null
          next_run: string
          recipients: Json
          report_template_id: string
          schedule_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email_message?: string | null
          email_subject: string
          id?: string
          is_active?: boolean
          last_run?: string | null
          next_run: string
          recipients: Json
          report_template_id: string
          schedule_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email_message?: string | null
          email_subject?: string
          id?: string
          is_active?: boolean
          last_run?: string | null
          next_run?: string
          recipients?: Json
          report_template_id?: string
          schedule_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_reports_report_template_id_fkey"
            columns: ["report_template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      template_variables: {
        Row: {
          category: string
          created_at: string
          data_type: Database["public"]["Enums"]["variable_data_type"]
          default_value: string | null
          description: string
          id: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          data_type: Database["public"]["Enums"]["variable_data_type"]
          default_value?: string | null
          description: string
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          data_type?: Database["public"]["Enums"]["variable_data_type"]
          default_value?: string | null
          description?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visit_distribution_attempts: {
        Row: {
          attempt_order: number
          corretor_id: string
          created_at: string
          id: string
          message_sent_at: string
          queue_id: string | null
          response_message: string | null
          response_received_at: string | null
          response_type: string | null
          status: string
          timeout_at: string
          visita_id: string
          whatsapp_message_id: string | null
        }
        Insert: {
          attempt_order: number
          corretor_id: string
          created_at?: string
          id?: string
          message_sent_at?: string
          queue_id?: string | null
          response_message?: string | null
          response_received_at?: string | null
          response_type?: string | null
          status?: string
          timeout_at: string
          visita_id: string
          whatsapp_message_id?: string | null
        }
        Update: {
          attempt_order?: number
          corretor_id?: string
          created_at?: string
          id?: string
          message_sent_at?: string
          queue_id?: string | null
          response_message?: string | null
          response_received_at?: string | null
          response_type?: string | null
          status?: string
          timeout_at?: string
          visita_id?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_visit_distribution_attempts_corretor"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visit_distribution_attempts_corretor"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visit_distribution_attempts_visita"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_distribution_attempts_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "visit_distribution_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_distribution_queue: {
        Row: {
          assigned_corretor_id: string | null
          completed_at: string | null
          created_at: string
          current_attempt: number
          failure_reason: string | null
          id: string
          started_at: string
          status: string
          visita_id: string
        }
        Insert: {
          assigned_corretor_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_attempt?: number
          failure_reason?: string | null
          id?: string
          started_at?: string
          status?: string
          visita_id: string
        }
        Update: {
          assigned_corretor_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_attempt?: number
          failure_reason?: string | null
          id?: string
          started_at?: string
          status?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_visit_distribution_queue_corretor"
            columns: ["assigned_corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visit_distribution_queue_corretor"
            columns: ["assigned_corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visit_distribution_queue_visita"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas: {
        Row: {
          avaliacao_lead: number | null
          comentarios_lead: string | null
          corretor_id: string | null
          created_at: string | null
          data_visita: string
          deleted_at: string | null
          empreendimento_id: string | null
          feedback_corretor: string | null
          horario_visita: string
          id: string
          lead_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          avaliacao_lead?: number | null
          comentarios_lead?: string | null
          corretor_id?: string | null
          created_at?: string | null
          data_visita: string
          deleted_at?: string | null
          empreendimento_id?: string | null
          feedback_corretor?: string | null
          horario_visita: string
          id?: string
          lead_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          avaliacao_lead?: number | null
          comentarios_lead?: string | null
          corretor_id?: string | null
          created_at?: string | null
          data_visita?: string
          deleted_at?: string | null
          empreendimento_id?: string | null
          feedback_corretor?: string | null
          horario_visita?: string
          id?: string
          lead_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          instance_name: string | null
          payload: Json
          processed_successfully: boolean | null
          processing_time_ms: number | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          instance_name?: string | null
          payload: Json
          processed_successfully?: boolean | null
          processing_time_ms?: number | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          instance_name?: string | null
          payload?: Json
          processed_successfully?: boolean | null
          processing_time_ms?: number | null
        }
        Relationships: []
      }
      whatsapp_number_verification: {
        Row: {
          created_at: string
          exists_on_whatsapp: boolean
          id: string
          last_verified_at: string
          phone_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exists_on_whatsapp: boolean
          id?: string
          last_verified_at?: string
          phone_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exists_on_whatsapp?: boolean
          id?: string
          last_verified_at?: string
          phone_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      wp_categories_cache: {
        Row: {
          cached_at: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          parent: number | null
          slug: string
          wp_category_id: number
        }
        Insert: {
          cached_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          parent?: number | null
          slug: string
          wp_category_id: number
        }
        Update: {
          cached_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          parent?: number | null
          slug?: string
          wp_category_id?: number
        }
        Relationships: []
      }
      wp_sync_log: {
        Row: {
          created_at: string | null
          error_details: Json | null
          errors_count: number
          id: string
          last_wp_post_id: number | null
          new_empreendimentos: number
          status: string
          sync_date: string | null
          sync_duration_ms: number | null
          total_posts_fetched: number
          updated_empreendimentos: number
        }
        Insert: {
          created_at?: string | null
          error_details?: Json | null
          errors_count?: number
          id?: string
          last_wp_post_id?: number | null
          new_empreendimentos?: number
          status?: string
          sync_date?: string | null
          sync_duration_ms?: number | null
          total_posts_fetched?: number
          updated_empreendimentos?: number
        }
        Update: {
          created_at?: string | null
          error_details?: Json | null
          errors_count?: number
          id?: string
          last_wp_post_id?: number | null
          new_empreendimentos?: number
          status?: string
          sync_date?: string | null
          sync_duration_ms?: number | null
          total_posts_fetched?: number
          updated_empreendimentos?: number
        }
        Relationships: []
      }
      wp_sync_performance: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          empreendimento_id: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          operation_end: string | null
          operation_start: string
          operation_type: string
          post_id: number | null
          success: boolean | null
          sync_log_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          empreendimento_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          operation_end?: string | null
          operation_start: string
          operation_type: string
          post_id?: number | null
          success?: boolean | null
          sync_log_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          empreendimento_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          operation_end?: string | null
          operation_start?: string
          operation_type?: string
          post_id?: number | null
          success?: boolean | null
          sync_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wp_sync_performance_sync_log_id_fkey"
            columns: ["sync_log_id"]
            isOneToOne: false
            referencedRelation: "wp_sync_log"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_rate_limits: {
        Row: {
          count: number | null
          expires_at: string | null
          key: string | null
          status: string | null
          time_remaining: unknown
        }
        Insert: {
          count?: number | null
          expires_at?: string | null
          key?: string | null
          status?: never
          time_remaining?: never
        }
        Update: {
          count?: number | null
          expires_at?: string | null
          key?: string | null
          status?: never
          time_remaining?: never
        }
        Relationships: []
      }
      corretores_public: {
        Row: {
          avatar_url: string | null
          cidade: string | null
          created_at: string | null
          creci: string | null
          estado: Database["public"]["Enums"]["estado_brasil_enum"] | null
          first_name: string | null
          id: string | null
          last_activity_at: string | null
          last_name: string | null
          nota_media: number | null
          profile_id: string | null
          status: Database["public"]["Enums"]["corretor_status"] | null
          tipo_imovel: Database["public"]["Enums"]["tipo_imovel_enum"] | null
          total_visitas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "corretores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_errors: {
        Row: {
          corretor_id: string | null
          event: string | null
          function_name: string | null
          lead_id: string | null
          level: Database["public"]["Enums"]["log_level"] | null
          message: string | null
          metadata: Json | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          corretor_id?: string | null
          event?: string | null
          function_name?: string | null
          lead_id?: string | null
          level?: Database["public"]["Enums"]["log_level"] | null
          message?: string | null
          metadata?: Json | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          corretor_id?: string | null
          event?: string | null
          function_name?: string | null
          lead_id?: string | null
          level?: Database["public"]["Enums"]["log_level"] | null
          message?: string | null
          metadata?: Json | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_logs_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_logs_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cleanup_expired_rate_limits: { Args: never; Returns: number }
      cleanup_old_application_logs: { Args: never; Returns: number }
      cleanup_old_deleted_visitas: { Args: never; Returns: undefined }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      cleanup_old_sync_logs: { Args: never; Returns: undefined }
      cleanup_old_whatsapp_verification: { Args: never; Returns: undefined }
      create_notification: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_related_corretor_id?: string
          p_related_lead_id?: string
          p_related_visit_id?: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: string
      }
      get_corretor_visitas_stats: {
        Args: { corretor_uuid: string }
        Returns: {
          visitas_agendadas: number
          visitas_realizadas: number
        }[]
      }
      get_current_user_role: { Args: never; Returns: string }
      hard_delete_visita: { Args: { visita_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_rate_limit: {
        Args: { p_key: string; p_max?: number; p_window_seconds?: number }
        Returns: {
          current_count: number
          is_allowed: boolean
        }[]
      }
      normalize_brazilian_phone: {
        Args: { phone_input: string }
        Returns: string
      }
      restore_visita: { Args: { visita_id: string }; Returns: undefined }
      soft_delete_visita: { Args: { visita_id: string }; Returns: undefined }
      validate_cpf: { Args: { cpf_input: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "corretor" | "cliente"
      communication_channel: "whatsapp" | "sms" | "email" | "sistema"
      communication_direction: "enviado" | "recebido"
      communication_type: "whatsapp" | "email" | "sms" | "sistema"
      corretor_status: "em_avaliacao" | "ativo" | "inativo" | "bloqueado"
      estado_brasil_enum:
        | "AC"
        | "AL"
        | "AP"
        | "AM"
        | "BA"
        | "CE"
        | "DF"
        | "ES"
        | "GO"
        | "MA"
        | "MT"
        | "MS"
        | "MG"
        | "PA"
        | "PB"
        | "PR"
        | "PE"
        | "PI"
        | "RJ"
        | "RN"
        | "RS"
        | "RO"
        | "RR"
        | "SC"
        | "SP"
        | "SE"
        | "TO"
      lead_status:
        | "novo"
        | "buscando_corretor"
        | "corretor_designado"
        | "visita_agendada"
        | "visita_confirmada"
        | "visita_realizada"
        | "cancelado"
        | "follow_up"
      log_level: "debug" | "info" | "warn" | "error" | "critical"
      notification_type:
        | "new_lead"
        | "lead_distributed"
        | "lead_accepted"
        | "lead_rejected"
        | "lead_timeout"
        | "new_visit"
        | "visit_confirmed"
        | "visit_completed"
        | "visit_cancelled"
        | "distribution_timeout"
        | "system_alert"
        | "info"
      template_category:
        | "lead_distribution"
        | "visit_confirmation"
        | "visit_reminder"
        | "follow_up"
        | "welcome"
        | "admin_notification"
        | "custom"
        | "visit_distribution"
        | "payment_reminder"
        | "feedback_request"
      tipo_imovel_enum:
        | "residencial"
        | "comercial"
        | "terreno"
        | "rural"
        | "todos"
      user_role: "admin" | "corretor" | "cliente"
      variable_data_type: "text" | "date" | "time" | "number" | "boolean"
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
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
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
      app_role: ["admin", "corretor", "cliente"],
      communication_channel: ["whatsapp", "sms", "email", "sistema"],
      communication_direction: ["enviado", "recebido"],
      communication_type: ["whatsapp", "email", "sms", "sistema"],
      corretor_status: ["em_avaliacao", "ativo", "inativo", "bloqueado"],
      estado_brasil_enum: [
        "AC",
        "AL",
        "AP",
        "AM",
        "BA",
        "CE",
        "DF",
        "ES",
        "GO",
        "MA",
        "MT",
        "MS",
        "MG",
        "PA",
        "PB",
        "PR",
        "PE",
        "PI",
        "RJ",
        "RN",
        "RS",
        "RO",
        "RR",
        "SC",
        "SP",
        "SE",
        "TO",
      ],
      lead_status: [
        "novo",
        "buscando_corretor",
        "corretor_designado",
        "visita_agendada",
        "visita_confirmada",
        "visita_realizada",
        "cancelado",
        "follow_up",
      ],
      log_level: ["debug", "info", "warn", "error", "critical"],
      notification_type: [
        "new_lead",
        "lead_distributed",
        "lead_accepted",
        "lead_rejected",
        "lead_timeout",
        "new_visit",
        "visit_confirmed",
        "visit_completed",
        "visit_cancelled",
        "distribution_timeout",
        "system_alert",
        "info",
      ],
      template_category: [
        "lead_distribution",
        "visit_confirmation",
        "visit_reminder",
        "follow_up",
        "welcome",
        "admin_notification",
        "custom",
        "visit_distribution",
        "payment_reminder",
        "feedback_request",
      ],
      tipo_imovel_enum: [
        "residencial",
        "comercial",
        "terreno",
        "rural",
        "todos",
      ],
      user_role: ["admin", "corretor", "cliente"],
      variable_data_type: ["text", "date", "time", "number", "boolean"],
    },
  },
} as const

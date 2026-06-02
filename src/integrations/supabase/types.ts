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
      ab_experiment_assignments: {
        Row: {
          conversation_id: string | null
          converted: boolean | null
          created_at: string | null
          experiment_id: string | null
          id: string
          primary_metric_value: number | null
          secondary_metrics: Json | null
          variant_name: string
        }
        Insert: {
          conversation_id?: string | null
          converted?: boolean | null
          created_at?: string | null
          experiment_id?: string | null
          id?: string
          primary_metric_value?: number | null
          secondary_metrics?: Json | null
          variant_name: string
        }
        Update: {
          conversation_id?: string | null
          converted?: boolean | null
          created_at?: string | null
          experiment_id?: string | null
          id?: string
          primary_metric_value?: number | null
          secondary_metrics?: Json | null
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_experiment_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_experiment_assignments_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "ab_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_experiments: {
        Row: {
          agent_id: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          experiment_type: string
          id: string
          name: string
          primary_metric: string
          results: Json | null
          secondary_metrics: string[] | null
          start_date: string | null
          status: string | null
          traffic_split: Json | null
          updated_at: string | null
          variants: Json
          winner_variant: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          experiment_type: string
          id?: string
          name: string
          primary_metric: string
          results?: Json | null
          secondary_metrics?: string[] | null
          start_date?: string | null
          status?: string | null
          traffic_split?: Json | null
          updated_at?: string | null
          variants: Json
          winner_variant?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          experiment_type?: string
          id?: string
          name?: string
          primary_metric?: string
          results?: Json | null
          secondary_metrics?: string[] | null
          start_date?: string | null
          status?: string | null
          traffic_split?: Json | null
          updated_at?: string | null
          variants?: Json
          winner_variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_experiments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_activity_log: {
        Row: {
          activity_data: Json | null
          activity_type: string
          agent_id: string | null
          conversation_id: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          success: boolean | null
        }
        Insert: {
          activity_data?: Json | null
          activity_type: string
          agent_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          success?: boolean | null
        }
        Update: {
          activity_data?: Json | null
          activity_type?: string
          agent_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_activity_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_activity_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_conversations: {
        Row: {
          agent_id: string | null
          completed_at: string | null
          conversation_summary: string | null
          current_stage: string | null
          customer_name: string | null
          id: string
          interested_properties: string[] | null
          last_intent: string | null
          last_message_at: string | null
          lead_id: string | null
          lead_score: number | null
          phone_number: string
          presented_properties: string[] | null
          qualification_data: Json | null
          started_at: string | null
          status: string | null
          total_messages: number | null
          total_tokens_used: number | null
        }
        Insert: {
          agent_id?: string | null
          completed_at?: string | null
          conversation_summary?: string | null
          current_stage?: string | null
          customer_name?: string | null
          id?: string
          interested_properties?: string[] | null
          last_intent?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          lead_score?: number | null
          phone_number: string
          presented_properties?: string[] | null
          qualification_data?: Json | null
          started_at?: string | null
          status?: string | null
          total_messages?: number | null
          total_tokens_used?: number | null
        }
        Update: {
          agent_id?: string | null
          completed_at?: string | null
          conversation_summary?: string | null
          current_stage?: string | null
          customer_name?: string | null
          id?: string
          interested_properties?: string[] | null
          last_intent?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          lead_score?: number | null
          phone_number?: string
          presented_properties?: string[] | null
          qualification_data?: Json | null
          started_at?: string | null
          status?: string | null
          total_messages?: number | null
          total_tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_followup_log: {
        Row: {
          conversation_id: string | null
          followup_id: string | null
          id: string
          lead_responded: boolean | null
          message_sent: string
          response_received_at: string | null
          sent_at: string | null
          sequence_order: number
        }
        Insert: {
          conversation_id?: string | null
          followup_id?: string | null
          id?: string
          lead_responded?: boolean | null
          message_sent: string
          response_received_at?: string | null
          sent_at?: string | null
          sequence_order: number
        }
        Update: {
          conversation_id?: string | null
          followup_id?: string | null
          id?: string
          lead_responded?: boolean | null
          message_sent?: string
          response_received_at?: string | null
          sent_at?: string | null
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_followup_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_followup_log_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "agent_followups"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_followups: {
        Row: {
          agent_id: string | null
          created_at: string | null
          delay_hours: number
          id: string
          include_property_reminder: boolean | null
          is_active: boolean | null
          max_attempts: number | null
          message_template: string
          message_variables: string[] | null
          only_if_stages: string[] | null
          send_after_hour: number | null
          send_before_hour: number | null
          sequence_order: number
          skip_if_qualified: boolean | null
          template_variant: string | null
          updated_at: string | null
          use_after_objection: string | null
          use_for_temperature: string[] | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          delay_hours?: number
          id?: string
          include_property_reminder?: boolean | null
          is_active?: boolean | null
          max_attempts?: number | null
          message_template: string
          message_variables?: string[] | null
          only_if_stages?: string[] | null
          send_after_hour?: number | null
          send_before_hour?: number | null
          sequence_order: number
          skip_if_qualified?: boolean | null
          template_variant?: string | null
          updated_at?: string | null
          use_after_objection?: string | null
          use_for_temperature?: string[] | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          delay_hours?: number
          id?: string
          include_property_reminder?: boolean | null
          is_active?: boolean | null
          max_attempts?: number | null
          message_template?: string
          message_variables?: string[] | null
          only_if_stages?: string[] | null
          send_after_hour?: number | null
          send_before_hour?: number | null
          sequence_order?: number
          skip_if_qualified?: boolean | null
          template_variant?: string | null
          updated_at?: string | null
          use_after_objection?: string | null
          use_for_temperature?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_followups_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_knowledge_base: {
        Row: {
          access_count: number | null
          agent_id: string | null
          answer: string
          category: string
          chunk_index: number | null
          created_at: string | null
          embedding: string | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          last_accessed_at: string | null
          priority: number | null
          question_patterns: string[]
          relevance_boost: number | null
          summary: string | null
          title: string | null
          total_chunks: number | null
          updated_at: string | null
        }
        Insert: {
          access_count?: number | null
          agent_id?: string | null
          answer: string
          category: string
          chunk_index?: number | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          last_accessed_at?: string | null
          priority?: number | null
          question_patterns: string[]
          relevance_boost?: number | null
          summary?: string | null
          title?: string | null
          total_chunks?: number | null
          updated_at?: string | null
        }
        Update: {
          access_count?: number | null
          agent_id?: string | null
          answer?: string
          category?: string
          chunk_index?: number | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          last_accessed_at?: string | null
          priority?: number | null
          question_patterns?: string[]
          relevance_boost?: number | null
          summary?: string | null
          title?: string | null
          total_chunks?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_knowledge_base_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          action_data: Json | null
          action_taken: string | null
          content: string
          conversation_id: string
          created_at: string | null
          entities_extracted: Json | null
          id: string
          intent_detected: string | null
          role: string
          tokens_used: number | null
        }
        Insert: {
          action_data?: Json | null
          action_taken?: string | null
          content: string
          conversation_id: string
          created_at?: string | null
          entities_extracted?: Json | null
          id?: string
          intent_detected?: string | null
          role: string
          tokens_used?: number | null
        }
        Update: {
          action_data?: Json | null
          action_taken?: string | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          entities_extracted?: Json | null
          id?: string
          intent_detected?: string | null
          role?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_performance_metrics: {
        Row: {
          agent_id: string | null
          avg_bant_score: number | null
          avg_conversation_length: number | null
          avg_messages_per_conversation: number | null
          avg_response_time_ms: number | null
          completed_conversations: number | null
          created_at: string | null
          estimated_cost_usd: number | null
          hot_leads: number | null
          human_handoffs: number | null
          id: string
          leads_qualified: number | null
          metric_date: string
          new_conversations: number | null
          positive_sentiment_rate: number | null
          property_searches: number | null
          total_conversations: number | null
          total_messages_received: number | null
          total_messages_sent: number | null
          total_tokens_used: number | null
          updated_at: string | null
          visits_scheduled: number | null
          warm_leads: number | null
        }
        Insert: {
          agent_id?: string | null
          avg_bant_score?: number | null
          avg_conversation_length?: number | null
          avg_messages_per_conversation?: number | null
          avg_response_time_ms?: number | null
          completed_conversations?: number | null
          created_at?: string | null
          estimated_cost_usd?: number | null
          hot_leads?: number | null
          human_handoffs?: number | null
          id?: string
          leads_qualified?: number | null
          metric_date: string
          new_conversations?: number | null
          positive_sentiment_rate?: number | null
          property_searches?: number | null
          total_conversations?: number | null
          total_messages_received?: number | null
          total_messages_sent?: number | null
          total_tokens_used?: number | null
          updated_at?: string | null
          visits_scheduled?: number | null
          warm_leads?: number | null
        }
        Update: {
          agent_id?: string | null
          avg_bant_score?: number | null
          avg_conversation_length?: number | null
          avg_messages_per_conversation?: number | null
          avg_response_time_ms?: number | null
          completed_conversations?: number | null
          created_at?: string | null
          estimated_cost_usd?: number | null
          hot_leads?: number | null
          human_handoffs?: number | null
          id?: string
          leads_qualified?: number | null
          metric_date?: string
          new_conversations?: number | null
          positive_sentiment_rate?: number | null
          property_searches?: number | null
          total_conversations?: number | null
          total_messages_received?: number | null
          total_messages_sent?: number | null
          total_tokens_used?: number | null
          updated_at?: string | null
          visits_scheduled?: number | null
          warm_leads?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_performance_metrics_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_prompts: {
        Row: {
          agent_id: string
          category: string
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          variables: string[] | null
        }
        Insert: {
          agent_id: string
          category: string
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          variables?: string[] | null
        }
        Update: {
          agent_id?: string
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_prompts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          ai_model: string | null
          conversation_timeout_hours: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          enable_property_search: boolean | null
          evolution_instance_id: string | null
          fallback_action: string | null
          greeting_message: string | null
          humanization_enabled: boolean | null
          id: string
          is_active: boolean | null
          llm_provider: string | null
          max_messages_per_conversation: number | null
          max_properties_to_show: number | null
          max_tokens: number | null
          max_unclear_attempts: number | null
          name: string
          persona_name: string | null
          persona_role: string | null
          qualification_questions: Json | null
          qualification_stages: Json | null
          regional_expressions: string[] | null
          split_long_messages: boolean | null
          system_prompt: string
          temperature: number | null
          tone: string | null
          transfer_keywords: string[] | null
          transfer_message: string | null
          transfer_on_frustration: boolean | null
          transfer_on_request: boolean | null
          transfer_on_unclear: boolean | null
          trigger_keywords: string[] | null
          typing_delay_max_ms: number | null
          typing_delay_min_ms: number | null
          updated_at: string | null
          use_casual_language: boolean | null
        }
        Insert: {
          ai_model?: string | null
          conversation_timeout_hours?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enable_property_search?: boolean | null
          evolution_instance_id?: string | null
          fallback_action?: string | null
          greeting_message?: string | null
          humanization_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          llm_provider?: string | null
          max_messages_per_conversation?: number | null
          max_properties_to_show?: number | null
          max_tokens?: number | null
          max_unclear_attempts?: number | null
          name: string
          persona_name?: string | null
          persona_role?: string | null
          qualification_questions?: Json | null
          qualification_stages?: Json | null
          regional_expressions?: string[] | null
          split_long_messages?: boolean | null
          system_prompt: string
          temperature?: number | null
          tone?: string | null
          transfer_keywords?: string[] | null
          transfer_message?: string | null
          transfer_on_frustration?: boolean | null
          transfer_on_request?: boolean | null
          transfer_on_unclear?: boolean | null
          trigger_keywords?: string[] | null
          typing_delay_max_ms?: number | null
          typing_delay_min_ms?: number | null
          updated_at?: string | null
          use_casual_language?: boolean | null
        }
        Update: {
          ai_model?: string | null
          conversation_timeout_hours?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enable_property_search?: boolean | null
          evolution_instance_id?: string | null
          fallback_action?: string | null
          greeting_message?: string | null
          humanization_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          llm_provider?: string | null
          max_messages_per_conversation?: number | null
          max_properties_to_show?: number | null
          max_tokens?: number | null
          max_unclear_attempts?: number | null
          name?: string
          persona_name?: string | null
          persona_role?: string | null
          qualification_questions?: Json | null
          qualification_stages?: Json | null
          regional_expressions?: string[] | null
          split_long_messages?: boolean | null
          system_prompt?: string
          temperature?: number | null
          tone?: string | null
          transfer_keywords?: string[] | null
          transfer_message?: string | null
          transfer_on_frustration?: boolean | null
          transfer_on_request?: boolean | null
          transfer_on_unclear?: boolean | null
          trigger_keywords?: string[] | null
          typing_delay_max_ms?: number | null
          typing_delay_min_ms?: number | null
          updated_at?: string | null
          use_casual_language?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_evolution_instance_id_fkey"
            columns: ["evolution_instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_lead_qualification: {
        Row: {
          authority_details: Json | null
          bant_authority_score: number | null
          bant_budget_score: number | null
          bant_need_score: number | null
          bant_timeline_score: number | null
          budget_details: Json | null
          conversation_id: string | null
          created_at: string | null
          decision_maker: boolean | null
          disqualification_reason: string | null
          entrada_informada: number | null
          financing_needed: boolean | null
          has_property_to_sell: boolean | null
          id: string
          is_qualified: boolean | null
          lead_id: string | null
          max_bedrooms: number | null
          max_price: number | null
          min_bedrooms: number | null
          min_price: number | null
          need_details: Json | null
          preferred_features: string[] | null
          preferred_neighborhoods: string[] | null
          property_type: string | null
          qualification_score: number | null
          renda_informada: number | null
          timeline_details: Json | null
          updated_at: string | null
          urgency: string | null
        }
        Insert: {
          authority_details?: Json | null
          bant_authority_score?: number | null
          bant_budget_score?: number | null
          bant_need_score?: number | null
          bant_timeline_score?: number | null
          budget_details?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          decision_maker?: boolean | null
          disqualification_reason?: string | null
          entrada_informada?: number | null
          financing_needed?: boolean | null
          has_property_to_sell?: boolean | null
          id?: string
          is_qualified?: boolean | null
          lead_id?: string | null
          max_bedrooms?: number | null
          max_price?: number | null
          min_bedrooms?: number | null
          min_price?: number | null
          need_details?: Json | null
          preferred_features?: string[] | null
          preferred_neighborhoods?: string[] | null
          property_type?: string | null
          qualification_score?: number | null
          renda_informada?: number | null
          timeline_details?: Json | null
          updated_at?: string | null
          urgency?: string | null
        }
        Update: {
          authority_details?: Json | null
          bant_authority_score?: number | null
          bant_budget_score?: number | null
          bant_need_score?: number | null
          bant_timeline_score?: number | null
          budget_details?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          decision_maker?: boolean | null
          disqualification_reason?: string | null
          entrada_informada?: number | null
          financing_needed?: boolean | null
          has_property_to_sell?: boolean | null
          id?: string
          is_qualified?: boolean | null
          lead_id?: string | null
          max_bedrooms?: number | null
          max_price?: number | null
          min_bedrooms?: number | null
          min_price?: number | null
          need_details?: Json | null
          preferred_features?: string[] | null
          preferred_neighborhoods?: string[] | null
          property_type?: string | null
          qualification_score?: number | null
          renda_informada?: number | null
          timeline_details?: Json | null
          updated_at?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_lead_qualification_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_lead_qualification_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
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
      bant_question_templates: {
        Row: {
          agent_id: string | null
          bant_category: string
          created_at: string | null
          follow_up_if: string | null
          follow_up_question: string | null
          id: string
          is_active: boolean | null
          question_text: string
          sequence_order: number | null
        }
        Insert: {
          agent_id?: string | null
          bant_category: string
          created_at?: string | null
          follow_up_if?: string | null
          follow_up_question?: string | null
          id?: string
          is_active?: boolean | null
          question_text: string
          sequence_order?: number | null
        }
        Update: {
          agent_id?: string | null
          bant_category?: string
          created_at?: string | null
          follow_up_if?: string | null
          follow_up_question?: string | null
          id?: string
          is_active?: boolean | null
          question_text?: string
          sequence_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bant_question_templates_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      cache_config: {
        Row: {
          cache_key: string
          cache_type: string
          created_at: string | null
          description: string | null
          id: string
          is_enabled: boolean | null
          max_size_bytes: number | null
          ttl_seconds: number
          updated_at: string | null
        }
        Insert: {
          cache_key: string
          cache_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          max_size_bytes?: number | null
          ttl_seconds?: number
          updated_at?: string | null
        }
        Update: {
          cache_key?: string
          cache_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          max_size_bytes?: number | null
          ttl_seconds?: number
          updated_at?: string | null
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
      conversation_sentiment_log: {
        Row: {
          confidence: number | null
          conversation_id: string | null
          created_at: string | null
          id: string
          message_id: string | null
          sentiment: string
          suggested_action: string | null
          triggers_detected: string[] | null
        }
        Insert: {
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          message_id?: string | null
          sentiment: string
          suggested_action?: string | null
          triggers_detected?: string[] | null
        }
        Update: {
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          message_id?: string | null
          sentiment?: string
          suggested_action?: string | null
          triggers_detected?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sentiment_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_sentiment_log_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "agent_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_funnel_events: {
        Row: {
          agent_id: string | null
          conversation_id: string | null
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
        }
        Insert: {
          agent_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
        }
        Update: {
          agent_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversion_funnel_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_funnel_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
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
      crm_automations: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          nome: string
          pipeline_id: string
          target_stage_id: string | null
          trigger_type: string
          trigger_value: string | null
          updated_at: string | null
        }
        Insert: {
          action_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          pipeline_id: string
          target_stage_id?: string | null
          trigger_type: string
          trigger_value?: string | null
          updated_at?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          pipeline_id?: string
          target_stage_id?: string | null
          trigger_type?: string
          trigger_value?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_automations_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automations_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          created_at: string | null
          google_drive_url: string | null
          id: string
          lead_id: string
          moved_at: string | null
          notas: string | null
          pipeline_id: string
          posicao: number | null
          stage_id: string | null
          updated_at: string | null
          valor_estimado: number | null
        }
        Insert: {
          created_at?: string | null
          google_drive_url?: string | null
          id?: string
          lead_id: string
          moved_at?: string | null
          notas?: string | null
          pipeline_id: string
          posicao?: number | null
          stage_id?: string | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Update: {
          created_at?: string | null
          google_drive_url?: string | null
          id?: string
          lead_id?: string
          moved_at?: string | null
          notas?: string | null
          pipeline_id?: string
          posicao?: number | null
          stage_id?: string | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          auto_add_visits: boolean | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          id: string
          is_default: boolean | null
          nome: string
          updated_at: string | null
        }
        Insert: {
          auto_add_visits?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_default?: boolean | null
          nome: string
          updated_at?: string | null
        }
        Update: {
          auto_add_visits?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_default?: boolean | null
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipelines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stages: {
        Row: {
          cor: string | null
          created_at: string | null
          id: string
          is_final: boolean | null
          nome: string
          pipeline_id: string
          posicao: number
          updated_at: string | null
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          id?: string
          is_final?: boolean | null
          nome: string
          pipeline_id: string
          posicao: number
          updated_at?: string | null
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          id?: string
          is_final?: boolean | null
          nome?: string
          pipeline_id?: string
          posicao?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
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
          score_match_bairro: number | null
          score_match_construtora: number | null
          score_nota_multiplier: number | null
          score_visitas_multiplier: number | null
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
          score_match_bairro?: number | null
          score_match_construtora?: number | null
          score_nota_multiplier?: number | null
          score_visitas_multiplier?: number | null
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
          score_match_bairro?: number | null
          score_match_construtora?: number | null
          score_nota_multiplier?: number | null
          score_visitas_multiplier?: number | null
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
          entrada_sugerida: number | null
          id: string
          nome: string
          renda_sugerida: number | null
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
          entrada_sugerida?: number | null
          id?: string
          nome: string
          renda_sugerida?: number | null
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
          entrada_sugerida?: number | null
          id?: string
          nome?: string
          renda_sugerida?: number | null
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
      evolution_instances: {
        Row: {
          api_token: string
          api_url: string
          connection_status: string | null
          created_at: string | null
          created_by: string | null
          id: string
          instance_name: string
          is_active: boolean | null
          last_health_check: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          api_token: string
          api_url: string
          connection_status?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          instance_name: string
          is_active?: boolean | null
          last_health_check?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          api_token?: string
          api_url?: string
          connection_status?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          instance_name?: string
          is_active?: boolean | null
          last_health_check?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      human_handoff_log: {
        Row: {
          accepted_at: string | null
          assigned_to: string | null
          bant_score_at_handoff: number | null
          conversation_id: string | null
          created_at: string | null
          handoff_reason: string
          id: string
          objections_at_handoff: string[] | null
          outcome: string | null
          recommended_actions: string[] | null
          resolved_at: string | null
          summary: string | null
          temperature_at_handoff: string | null
          urgency_level: string | null
        }
        Insert: {
          accepted_at?: string | null
          assigned_to?: string | null
          bant_score_at_handoff?: number | null
          conversation_id?: string | null
          created_at?: string | null
          handoff_reason: string
          id?: string
          objections_at_handoff?: string[] | null
          outcome?: string | null
          recommended_actions?: string[] | null
          resolved_at?: string | null
          summary?: string | null
          temperature_at_handoff?: string | null
          urgency_level?: string | null
        }
        Update: {
          accepted_at?: string | null
          assigned_to?: string | null
          bant_score_at_handoff?: number | null
          conversation_id?: string | null
          created_at?: string | null
          handoff_reason?: string
          id?: string
          objections_at_handoff?: string[] | null
          outcome?: string | null
          recommended_actions?: string[] | null
          resolved_at?: string | null
          summary?: string | null
          temperature_at_handoff?: string | null
          urgency_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "human_handoff_log_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_handoff_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          endpoint: string | null
          id: string
          metadata: Json | null
          method: string | null
          request_payload: Json | null
          response_body: Json | null
          service: string
          status_code: number | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string | null
          id?: string
          metadata?: Json | null
          method?: string | null
          request_payload?: Json | null
          response_body?: Json | null
          service: string
          status_code?: number | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string | null
          id?: string
          metadata?: Json | null
          method?: string | null
          request_payload?: Json | null
          response_body?: Json | null
          service?: string
          status_code?: number | null
        }
        Relationships: []
      }
      intent_classifications: {
        Row: {
          confidence: number | null
          created_at: string | null
          entities: Json | null
          id: string
          message_hash: string
          primary_intent: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          entities?: Json | null
          id?: string
          message_hash: string
          primary_intent: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          entities?: Json | null
          id?: string
          message_hash?: string
          primary_intent?: string
        }
        Relationships: []
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
      lead_score_history: {
        Row: {
          bant_authority: number | null
          bant_budget: number | null
          bant_need: number | null
          bant_timeline: number | null
          captured_at: string | null
          conversation_id: string | null
          id: string
          message_id: string | null
          qualification_id: string | null
          temperature: string | null
          total_score: number | null
          triggered_by: string | null
        }
        Insert: {
          bant_authority?: number | null
          bant_budget?: number | null
          bant_need?: number | null
          bant_timeline?: number | null
          captured_at?: string | null
          conversation_id?: string | null
          id?: string
          message_id?: string | null
          qualification_id?: string | null
          temperature?: string | null
          total_score?: number | null
          triggered_by?: string | null
        }
        Update: {
          bant_authority?: number | null
          bant_budget?: number | null
          bant_need?: number | null
          bant_timeline?: number | null
          captured_at?: string | null
          conversation_id?: string | null
          id?: string
          message_id?: string | null
          qualification_id?: string | null
          temperature?: string | null
          total_score?: number | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_score_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_score_history_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "agent_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_score_history_qualification_id_fkey"
            columns: ["qualification_id"]
            isOneToOne: false
            referencedRelation: "ai_lead_qualification"
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      lid_phone_map: {
        Row: {
          id: string
          instance_name: string | null
          lid: string
          phone: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          instance_name?: string | null
          lid: string
          phone: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          instance_name?: string | null
          lid?: string
          phone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      media_delivery_log: {
        Row: {
          conversation_id: string | null
          delivered_at: string | null
          empreendimento_id: string | null
          file_url: string
          id: string
          media_id: string | null
          media_type: string
          response_received: boolean | null
          viewed_at: string | null
        }
        Insert: {
          conversation_id?: string | null
          delivered_at?: string | null
          empreendimento_id?: string | null
          file_url: string
          id?: string
          media_id?: string | null
          media_type: string
          response_received?: boolean | null
          viewed_at?: string | null
        }
        Update: {
          conversation_id?: string | null
          delivered_at?: string | null
          empreendimento_id?: string | null
          file_url?: string
          id?: string
          media_id?: string | null
          media_type?: string
          response_received?: boolean | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_delivery_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_delivery_log_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_delivery_log_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "property_media"
            referencedColumns: ["id"]
          },
        ]
      }
      message_queue: {
        Row: {
          attempts: number | null
          created_at: string
          error_message: string | null
          id: string
          instance_id: string | null
          last_attempt: string | null
          message_body: Json
          phone_number: string
          priority: number | null
          processed_at: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          instance_id?: string | null
          last_attempt?: string | null
          message_body: Json
          phone_number: string
          priority?: number | null
          processed_at?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          instance_id?: string | null
          last_attempt?: string | null
          message_body?: Json
          phone_number?: string
          priority?: number | null
          processed_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_queue_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
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
      objection_log: {
        Row: {
          confidence: number | null
          conversation_id: string | null
          counter_points_used: string[] | null
          created_at: string | null
          escalated_to_human: boolean | null
          id: string
          message_id: string | null
          objection_type: string
          response_given: string | null
          was_resolved: boolean | null
        }
        Insert: {
          confidence?: number | null
          conversation_id?: string | null
          counter_points_used?: string[] | null
          created_at?: string | null
          escalated_to_human?: boolean | null
          id?: string
          message_id?: string | null
          objection_type: string
          response_given?: string | null
          was_resolved?: boolean | null
        }
        Update: {
          confidence?: number | null
          conversation_id?: string | null
          counter_points_used?: string[] | null
          created_at?: string | null
          escalated_to_human?: boolean | null
          id?: string
          message_id?: string | null
          objection_type?: string
          response_given?: string | null
          was_resolved?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "objection_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objection_log_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "agent_messages"
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
          is_active: boolean | null
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
          is_active?: boolean | null
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
          is_active?: boolean | null
          last_name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      property_embeddings: {
        Row: {
          content_text: string
          created_at: string | null
          embedding: string | null
          empreendimento_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          content_text: string
          created_at?: string | null
          embedding?: string | null
          empreendimento_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          content_text?: string
          created_at?: string | null
          embedding?: string | null
          empreendimento_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_embeddings_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: true
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      property_media: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          duration_seconds: number | null
          empreendimento_id: string | null
          file_size_bytes: number | null
          file_url: string
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          media_type: string
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_seconds?: number | null
          empreendimento_id?: string | null
          file_size_bytes?: number | null
          file_url: string
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          media_type: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_seconds?: number | null
          empreendimento_id?: string | null
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          media_type?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_media_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_config: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_enabled: boolean | null
          limit_key: string
          limit_type: string
          max_value: number
          window_seconds: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          limit_key: string
          limit_type: string
          max_value: number
          window_seconds: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          limit_key?: string
          limit_type?: string
          max_value?: number
          window_seconds?: number
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
      response_cache: {
        Row: {
          agent_id: string | null
          cache_key: string
          created_at: string | null
          expires_at: string
          hit_count: number | null
          id: string
          last_hit_at: string | null
          model_used: string | null
          query_hash: string
          query_text: string
          response_text: string
          tokens_used: number | null
        }
        Insert: {
          agent_id?: string | null
          cache_key: string
          created_at?: string | null
          expires_at: string
          hit_count?: number | null
          id?: string
          last_hit_at?: string | null
          model_used?: string | null
          query_hash: string
          query_text: string
          response_text: string
          tokens_used?: number | null
        }
        Update: {
          agent_id?: string | null
          cache_key?: string
          created_at?: string | null
          expires_at?: string
          hit_count?: number | null
          id?: string
          last_hit_at?: string | null
          model_used?: string | null
          query_hash?: string
          query_text?: string
          response_text?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "response_cache_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
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
      system_health_metrics: {
        Row: {
          bucket_time: string
          created_at: string | null
          id: string
          metric_type: string
          tags: Json | null
          unit: string
          value: number
        }
        Insert: {
          bucket_time?: string
          created_at?: string | null
          id?: string
          metric_type: string
          tags?: Json | null
          unit?: string
          value: number
        }
        Update: {
          bucket_time?: string
          created_at?: string | null
          id?: string
          metric_type?: string
          tags?: Json | null
          unit?: string
          value?: number
        }
        Relationships: []
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
      vendas: {
        Row: {
          comissao_percentual: number
          comprovantes: string[] | null
          corretor_id: string | null
          created_at: string | null
          created_by: string | null
          data_pagamento: string | null
          data_venda: string
          empreendimento_id: string
          id: string
          imposto_percentual: number
          is_venda_direta: boolean
          lead_id: string
          lembrete_enviado: boolean | null
          observacoes: string | null
          status: Database["public"]["Enums"]["venda_status"]
          updated_at: string | null
          valor_comissao_bruta: number | null
          valor_comissao_liquida: number | null
          valor_corretor: number | null
          valor_imovel: number
          valor_imposto: number | null
          valor_memude: number | null
        }
        Insert: {
          comissao_percentual?: number
          comprovantes?: string[] | null
          corretor_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_pagamento?: string | null
          data_venda?: string
          empreendimento_id: string
          id?: string
          imposto_percentual: number
          is_venda_direta?: boolean
          lead_id: string
          lembrete_enviado?: boolean | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["venda_status"]
          updated_at?: string | null
          valor_comissao_bruta?: number | null
          valor_comissao_liquida?: number | null
          valor_corretor?: number | null
          valor_imovel: number
          valor_imposto?: number | null
          valor_memude?: number | null
        }
        Update: {
          comissao_percentual?: number
          comprovantes?: string[] | null
          corretor_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_pagamento?: string | null
          data_venda?: string
          empreendimento_id?: string
          id?: string
          imposto_percentual?: number
          is_venda_direta?: boolean
          lead_id?: string
          lembrete_enviado?: boolean | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["venda_status"]
          updated_at?: string | null
          valor_comissao_bruta?: number | null
          valor_comissao_liquida?: number | null
          valor_corretor?: number | null
          valor_imovel?: number
          valor_imposto?: number | null
          valor_memude?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
          confirmation_metadata: Json | null
          corretor_confirmou: boolean | null
          corretor_id: string | null
          created_at: string | null
          data_visita: string
          deleted_at: string | null
          empreendimento_id: string | null
          feedback_corretor: string | null
          horario_visita: string
          id: string
          interesse: boolean | null
          lead_confirmou: boolean | null
          lead_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          avaliacao_lead?: number | null
          comentarios_lead?: string | null
          confirmation_metadata?: Json | null
          corretor_confirmou?: boolean | null
          corretor_id?: string | null
          created_at?: string | null
          data_visita: string
          deleted_at?: string | null
          empreendimento_id?: string | null
          feedback_corretor?: string | null
          horario_visita: string
          id?: string
          interesse?: boolean | null
          lead_confirmou?: boolean | null
          lead_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          avaliacao_lead?: number | null
          comentarios_lead?: string | null
          confirmation_metadata?: Json | null
          corretor_confirmou?: boolean | null
          corretor_id?: string | null
          created_at?: string | null
          data_visita?: string
          deleted_at?: string | null
          empreendimento_id?: string | null
          feedback_corretor?: string | null
          horario_visita?: string
          id?: string
          interesse?: boolean | null
          lead_confirmou?: boolean | null
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
          time_remaining: string | null
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
      assign_ab_experiment: {
        Args: { p_conversation_id: string; p_experiment_id: string }
        Returns: string
      }
      cleanup_expired_data: {
        Args: never
        Returns: {
          rows_deleted: number
          table_name: string
        }[]
      }
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
      delete_evolution_instance: {
        Args: { instance_id: string }
        Returns: undefined
      }
      get_ab_test_results: {
        Args: { p_experiment_id: string }
        Returns: {
          avg_metric_value: number
          conversion_rate: number
          is_winner: boolean
          sample_size: number
          variant_name: string
        }[]
      }
      get_agent_dashboard_stats: {
        Args: { p_agent_id?: string; p_days?: number }
        Returns: {
          change_percentage: number
          current_value: number
          metric_name: string
          previous_value: number
        }[]
      }
      get_cached_response: {
        Args: { p_agent_id: string; p_query_text: string }
        Returns: {
          is_fresh: boolean
          response_text: string
          tokens_used: number
        }[]
      }
      get_conversion_funnel: {
        Args: { p_agent_id?: string; p_days?: number }
        Returns: {
          avg_time_to_event_hours: number
          count: number
          event_type: string
          percentage: number
        }[]
      }
      get_corretor_visitas_stats: {
        Args: { corretor_uuid: string }
        Returns: {
          visitas_agendadas: number
          visitas_realizadas: number
        }[]
      }
      get_current_user_role: { Args: never; Returns: string }
      get_lead_temperature_stats: {
        Args: { p_agent_id?: string; p_days?: number }
        Returns: {
          count: number
          percentage: number
          temperature: string
        }[]
      }
      get_objection_stats: {
        Args: { p_agent_id?: string; p_days?: number }
        Returns: {
          escalated_count: number
          objection_type: string
          resolution_rate: number
          resolved_count: number
          total_count: number
        }[]
      }
      get_or_create_conversation: {
        Args: { p_agent_id: string; p_lead_id?: string; p_phone_number: string }
        Returns: string
      }
      get_pending_handoffs: {
        Args: { p_limit?: number }
        Returns: {
          bant_score: number
          conversation_id: string
          created_at: string
          customer_name: string
          handoff_reason: string
          id: string
          phone_number: string
          summary: string
          urgency_level: string
        }[]
      }
      get_property_media: {
        Args: {
          p_empreendimento_id: string
          p_limit?: number
          p_media_type?: string
        }
        Returns: {
          description: string
          file_url: string
          id: string
          is_featured: boolean
          media_type: string
          thumbnail_url: string
          title: string
        }[]
      }
      get_system_health_summary: {
        Args: { p_hours?: number }
        Returns: {
          avg_value: number
          max_value: number
          metric_type: string
          min_value: number
          sample_count: number
        }[]
      }
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
      match_knowledge_base: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_agent_id: string
          p_category?: string
          query_embedding: string
        }
        Returns: {
          answer: string
          category: string
          id: string
          priority: number
          question_patterns: string[]
          similarity: number
        }[]
      }
      match_properties: {
        Args: {
          filter_bairro_id?: string
          filter_max_price?: number
          filter_min_price?: number
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          descricao: string
          empreendimento_id: string
          endereco: string
          nome: string
          similarity: number
          valor_max: number
          valor_min: number
        }[]
      }
      normalize_brazilian_phone: {
        Args: { phone_input: string }
        Returns: string
      }
      restore_visita: { Args: { visita_id: string }; Returns: undefined }
      save_evolution_instance: { Args: { payload: Json }; Returns: Json }
      set_cached_response: {
        Args: {
          p_agent_id: string
          p_model_used?: string
          p_query_text: string
          p_response_text: string
          p_tokens_used?: number
          p_ttl_seconds?: number
        }
        Returns: string
      }
      soft_delete_visita: { Args: { visita_id: string }; Returns: undefined }
      validate_cpf: { Args: { cpf_input: string }; Returns: boolean }
      write_audit_log: {
        Args: {
          p_action: string
          p_agent_id?: string
          p_conversation_id?: string
          p_entity_id?: string
          p_entity_type: string
          p_metadata?: Json
          p_new_value?: Json
          p_previous_value?: Json
          p_user_id?: string
        }
        Returns: string
      }
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
        | "payment_reminder"
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
      venda_status: "pendente" | "aprovada" | "paga" | "cancelada"
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
        "payment_reminder",
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
      venda_status: ["pendente", "aprovada", "paga", "cancelada"],
    },
  },
} as const


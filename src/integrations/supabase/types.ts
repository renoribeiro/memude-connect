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
          target_sample_size: number
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
          target_sample_size?: number
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
          target_sample_size?: number
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
          audio_sent: boolean | null
          conversation_id: string | null
          followup_id: string | null
          id: string
          lead_responded: boolean | null
          media_type: string | null
          message_sent: string
          response_received_at: string | null
          sent_at: string | null
          sequence_order: number
        }
        Insert: {
          audio_sent?: boolean | null
          conversation_id?: string | null
          followup_id?: string | null
          id?: string
          lead_responded?: boolean | null
          media_type?: string | null
          message_sent?: string
          response_received_at?: string | null
          sent_at?: string | null
          sequence_order: number
        }
        Update: {
          audio_sent?: boolean | null
          conversation_id?: string | null
          followup_id?: string | null
          id?: string
          lead_responded?: boolean | null
          media_type?: string | null
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
          audio_caption: string | null
          audio_url: string | null
          created_at: string | null
          delay_hours: number
          id: string
          image_caption: string | null
          image_url: string | null
          include_property_reminder: boolean | null
          is_active: boolean | null
          max_attempts: number | null
          media_type: string | null
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
          audio_caption?: string | null
          audio_url?: string | null
          created_at?: string | null
          delay_hours?: number
          id?: string
          image_caption?: string | null
          image_url?: string | null
          include_property_reminder?: boolean | null
          is_active?: boolean | null
          max_attempts?: number | null
          media_type?: string | null
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
          audio_caption?: string | null
          audio_url?: string | null
          created_at?: string | null
          delay_hours?: number
          id?: string
          image_caption?: string | null
          image_url?: string | null
          include_property_reminder?: boolean | null
          is_active?: boolean | null
          max_attempts?: number | null
          media_type?: string | null
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
          followup_pause_stages: string[] | null
          greeting_message: string | null
          humanization_enabled: boolean | null
          id: string
          is_active: boolean | null
          llm_provider: string | null
          max_followup_attempts: number | null
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
          timezone_offset: number | null
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
          followup_pause_stages?: string[] | null
          greeting_message?: string | null
          humanization_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          llm_provider?: string | null
          max_followup_attempts?: number | null
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
          timezone_offset?: number | null
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
          followup_pause_stages?: string[] | null
          greeting_message?: string | null
          humanization_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          llm_provider?: string | null
          max_followup_attempts?: number | null
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
          timezone_offset?: number | null
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
            foreignKeyName: "audit_logs_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs_default: {
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
        Relationships: []
      }
      audit_logs_y2026m05: {
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
        Relationships: []
      }
      audit_logs_y2026m06: {
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
        Relationships: []
      }
      audit_logs_y2026m07: {
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
        Relationships: []
      }
      audit_logs_y2026m08: {
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
        Relationships: []
      }
      audit_logs_y2026m09: {
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
        Relationships: []
      }
      audit_logs_y2026m10: {
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
        Relationships: []
      }
      audit_logs_y2026m11: {
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
        Relationships: []
      }
      audit_logs_y2026m12: {
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
        Relationships: []
      }
      audit_logs_y2027m01: {
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
        Relationships: []
      }
      audit_logs_y2027m02: {
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
        Relationships: []
      }
      audit_logs_y2027m03: {
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
        Relationships: []
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
      conv_alertas: {
        Row: {
          conversa_id: string | null
          criado_em: string
          detalhe: string | null
          id: string
          lead_id: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          responsavel_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          conversa_id?: string | null
          criado_em?: string
          detalhe?: string | null
          id?: string
          lead_id?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          responsavel_id?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          conversa_id?: string | null
          criado_em?: string
          detalhe?: string | null
          id?: string
          lead_id?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          responsavel_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "conv_alertas_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conv_alertas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      conv_numeros: {
        Row: {
          ativo: boolean
          criado_em: string
          criado_por: string | null
          id: string
          instancia: string
          nome: string
          papel: string
          status: string
          telefone: string | null
          ultimo_evento_em: string | null
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          criado_por?: string | null
          id?: string
          instancia: string
          nome: string
          papel?: string
          status?: string
          telefone?: string | null
          ultimo_evento_em?: string | null
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          criado_por?: string | null
          id?: string
          instancia?: string
          nome?: string
          papel?: string
          status?: string
          telefone?: string | null
          ultimo_evento_em?: string | null
        }
        Relationships: []
      }
      conversa_donos: {
        Row: {
          ator_id: string | null
          conversa_id: string
          criado_em: string
          dono_id: string | null
          dono_papel: string
          id: string
          motivo: string
        }
        Insert: {
          ator_id?: string | null
          conversa_id: string
          criado_em?: string
          dono_id?: string | null
          dono_papel: string
          id?: string
          motivo: string
        }
        Update: {
          ator_id?: string | null
          conversa_id?: string
          criado_em?: string
          dono_id?: string | null
          dono_papel?: string
          id?: string
          motivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversa_donos_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversa_leituras: {
        Row: {
          conversa_id: string
          lida_em: string
          user_id: string
        }
        Insert: {
          conversa_id: string
          lida_em?: string
          user_id: string
        }
        Update: {
          conversa_id?: string
          lida_em?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversa_leituras_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas: {
        Row: {
          aguardando_desde: string | null
          arquivada: boolean
          criada_em: string
          dono_id: string | null
          dono_papel: string
          etapa: string
          foto_em: string | null
          foto_url: string | null
          ia_analisada_em: string | null
          ia_falta: string | null
          ia_pendente_desde: string | null
          id: string
          jid: string
          lead_id: string | null
          nome_contato: string | null
          numero_id: string
          resumo_ia: string | null
          telefone: string
          telefone_chave: string
          temperatura: string | null
          ultima_direcao: string | null
          ultima_mensagem_em: string | null
          ultima_previa: string | null
        }
        Insert: {
          aguardando_desde?: string | null
          arquivada?: boolean
          criada_em?: string
          dono_id?: string | null
          dono_papel?: string
          etapa?: string
          foto_em?: string | null
          foto_url?: string | null
          ia_analisada_em?: string | null
          ia_falta?: string | null
          ia_pendente_desde?: string | null
          id?: string
          jid: string
          lead_id?: string | null
          nome_contato?: string | null
          numero_id: string
          resumo_ia?: string | null
          telefone: string
          telefone_chave: string
          temperatura?: string | null
          ultima_direcao?: string | null
          ultima_mensagem_em?: string | null
          ultima_previa?: string | null
        }
        Update: {
          aguardando_desde?: string | null
          arquivada?: boolean
          criada_em?: string
          dono_id?: string | null
          dono_papel?: string
          etapa?: string
          foto_em?: string | null
          foto_url?: string | null
          ia_analisada_em?: string | null
          ia_falta?: string | null
          ia_pendente_desde?: string | null
          id?: string
          jid?: string
          lead_id?: string | null
          nome_contato?: string | null
          numero_id?: string
          resumo_ia?: string | null
          telefone?: string
          telefone_chave?: string
          temperatura?: string | null
          ultima_direcao?: string | null
          ultima_mensagem_em?: string | null
          ultima_previa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_numero_id_fkey"
            columns: ["numero_id"]
            isOneToOne: false
            referencedRelation: "conv_numeros"
            referencedColumns: ["id"]
          },
        ]
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
          rating_calculado_em: string | null
          rating_detalhe: Json | null
          rating_score: number | null
          status: Database["public"]["Enums"]["corretor_status"] | null
          sugerir_em_visitas: boolean
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
          rating_calculado_em?: string | null
          rating_detalhe?: Json | null
          rating_score?: number | null
          status?: Database["public"]["Enums"]["corretor_status"] | null
          sugerir_em_visitas?: boolean
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
          rating_calculado_em?: string | null
          rating_detalhe?: Json | null
          rating_score?: number | null
          status?: Database["public"]["Enums"]["corretor_status"] | null
          sugerir_em_visitas?: boolean
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
          archived_at: string | null
          completed_at: string | null
          created_at: string | null
          empreendimento_id: string | null
          google_drive_url: string | null
          id: string
          lead_id: string
          moved_at: string | null
          notas: string | null
          pipeline_id: string
          posicao: number | null
          stage_id: string | null
          tag: string | null
          tag_cor: string | null
          updated_at: string | null
          valor_estimado: number | null
          venda_id: string | null
          visita_id: string | null
        }
        Insert: {
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          empreendimento_id?: string | null
          google_drive_url?: string | null
          id?: string
          lead_id: string
          moved_at?: string | null
          notas?: string | null
          pipeline_id: string
          posicao?: number | null
          stage_id?: string | null
          tag?: string | null
          tag_cor?: string | null
          updated_at?: string | null
          valor_estimado?: number | null
          venda_id?: string | null
          visita_id?: string | null
        }
        Update: {
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          empreendimento_id?: string | null
          google_drive_url?: string | null
          id?: string
          lead_id?: string
          moved_at?: string | null
          notas?: string | null
          pipeline_id?: string
          posicao?: number | null
          stage_id?: string | null
          tag?: string | null
          tag_cor?: string | null
          updated_at?: string | null
          valor_estimado?: number | null
          venda_id?: string | null
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "crm_leads_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          auto_add_visits: boolean | null
          completed_stage_id: string | null
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
          completed_stage_id?: string | null
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
          completed_stage_id?: string | null
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
            foreignKeyName: "crm_pipeline_completed_stage_fk"
            columns: ["id", "completed_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["pipeline_id", "id"]
          },
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
          imagem_url: string | null
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
          imagem_url?: string | null
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
          imagem_url?: string | null
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
      fase1_config: {
        Row: {
          chamado_automatico: boolean
          chamado_reaviso_min: number
          chamado_tentativas: number
          closer_user_id: string | null
          escalar_horas: number
          escalar_tentativas: number
          id: boolean
          manual_corretor_url: string
          mensagens_auto: boolean
          min_visitas_historico: number
          pesos: Json
          prazo_aceite_min: number
          prazo_d0_horas_antes: number
          prazo_proximo_passo_horas: number
          prazo_remarcar_horas: number
          prazo_resultado_horas: number
          prazo_retorno_horas: number
          responsaveis: string[]
          site_url: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          chamado_automatico?: boolean
          chamado_reaviso_min?: number
          chamado_tentativas?: number
          closer_user_id?: string | null
          escalar_horas?: number
          escalar_tentativas?: number
          id?: boolean
          manual_corretor_url?: string
          mensagens_auto?: boolean
          min_visitas_historico?: number
          pesos?: Json
          prazo_aceite_min?: number
          prazo_d0_horas_antes?: number
          prazo_proximo_passo_horas?: number
          prazo_remarcar_horas?: number
          prazo_resultado_horas?: number
          prazo_retorno_horas?: number
          responsaveis?: string[]
          site_url?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          chamado_automatico?: boolean
          chamado_reaviso_min?: number
          chamado_tentativas?: number
          closer_user_id?: string | null
          escalar_horas?: number
          escalar_tentativas?: number
          id?: boolean
          manual_corretor_url?: string
          mensagens_auto?: boolean
          min_visitas_historico?: number
          pesos?: Json
          prazo_aceite_min?: number
          prazo_d0_horas_antes?: number
          prazo_proximo_passo_horas?: number
          prazo_remarcar_horas?: number
          prazo_resultado_horas?: number
          prazo_retorno_horas?: number
          responsaveis?: string[]
          site_url?: string
          updated_at?: string
          updated_by?: string | null
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
      ia_sugestoes: {
        Row: {
          conteudo: Json
          conversa_id: string
          criada_em: string
          decidida_em: string | null
          decidida_por: string | null
          id: string
          lead_id: string | null
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          conteudo?: Json
          conversa_id: string
          criada_em?: string
          decidida_em?: string | null
          decidida_por?: string | null
          id?: string
          lead_id?: string | null
          status?: string
          tipo: string
          titulo: string
        }
        Update: {
          conteudo?: Json
          conversa_id?: string
          criada_em?: string
          decidida_em?: string | null
          decidida_por?: string | null
          id?: string
          lead_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_sugestoes_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_sugestoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      import_conflitos: {
        Row: {
          aba: string
          campo: string | null
          criado_em: string
          dados_planilha: Json | null
          id: string
          lead_id: string | null
          linha: number | null
          resolvido: boolean
          telefone_chave: string | null
          valor_core: string | null
          valor_planilha: string | null
          visita_id: string | null
        }
        Insert: {
          aba: string
          campo?: string | null
          criado_em?: string
          dados_planilha?: Json | null
          id?: string
          lead_id?: string | null
          linha?: number | null
          resolvido?: boolean
          telefone_chave?: string | null
          valor_core?: string | null
          valor_planilha?: string | null
          visita_id?: string | null
        }
        Update: {
          aba?: string
          campo?: string | null
          criado_em?: string
          dados_planilha?: Json | null
          id?: string
          lead_id?: string | null
          linha?: number | null
          resolvido?: boolean
          telefone_chave?: string | null
          valor_core?: string | null
          valor_planilha?: string | null
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_conflitos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_conflitos_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
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
      integration_logs_default: {
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
      integration_logs_y2026m05: {
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
      integration_logs_y2026m06: {
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
      integration_logs_y2026m07: {
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
      integration_logs_y2026m08: {
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
      integration_logs_y2026m09: {
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
      integration_logs_y2026m10: {
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
      integration_logs_y2026m11: {
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
      integration_logs_y2026m12: {
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
      integration_logs_y2027m01: {
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
      integration_logs_y2027m02: {
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
      integration_logs_y2027m03: {
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
      lead_eventos: {
        Row: {
          ator_id: string | null
          campo: string | null
          criado_em: string
          de: string | null
          id: string
          lead_id: string
          observacao: string | null
          para: string | null
          tipo: string
        }
        Insert: {
          ator_id?: string | null
          campo?: string | null
          criado_em?: string
          de?: string | null
          id?: string
          lead_id: string
          observacao?: string | null
          para?: string | null
          tipo: string
        }
        Update: {
          ator_id?: string | null
          campo?: string | null
          criado_em?: string
          de?: string | null
          id?: string
          lead_id?: string
          observacao?: string | null
          para?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_eventos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_ia_mudancas: {
        Row: {
          campo: string
          conversa_id: string | null
          criado_em: string
          de: string | null
          desfeita_em: string | null
          desfeita_por: string | null
          evidencia: string | null
          id: string
          lead_id: string
          para: string
        }
        Insert: {
          campo: string
          conversa_id?: string | null
          criado_em?: string
          de?: string | null
          desfeita_em?: string | null
          desfeita_por?: string | null
          evidencia?: string | null
          id?: string
          lead_id: string
          para: string
        }
        Update: {
          campo?: string
          conversa_id?: string | null
          criado_em?: string
          de?: string | null
          desfeita_em?: string | null
          desfeita_por?: string | null
          evidencia?: string | null
          id?: string
          lead_id?: string
          para?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_ia_mudancas_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_ia_mudancas_lead_id_fkey"
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
          data_entrada: string
          data_visita_solicitada: string | null
          deleted_at: string | null
          email: string | null
          empreendimento_id: string | null
          fonte: string | null
          horario_visita_solicitada: string | null
          id: string
          nome: string
          observacoes: string | null
          origem: string | null
          perfil_falta: string | null
          perfil_ia: string | null
          perfil_ia_em: string | null
          perfil_temperatura: string | null
          planilha_extra: Json | null
          qualificacao: Json | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          status_atendimento: string
          telefone: string
          telefone_chave: string | null
          telefone_chave_conflito: boolean
          telefone_exibicao: string | null
          updated_at: string | null
        }
        Insert: {
          corretor_designado_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_entrada?: string
          data_visita_solicitada?: string | null
          deleted_at?: string | null
          email?: string | null
          empreendimento_id?: string | null
          fonte?: string | null
          horario_visita_solicitada?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          origem?: string | null
          perfil_falta?: string | null
          perfil_ia?: string | null
          perfil_ia_em?: string | null
          perfil_temperatura?: string | null
          planilha_extra?: Json | null
          qualificacao?: Json | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          status_atendimento?: string
          telefone: string
          telefone_chave?: string | null
          telefone_chave_conflito?: boolean
          telefone_exibicao?: string | null
          updated_at?: string | null
        }
        Update: {
          corretor_designado_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_entrada?: string
          data_visita_solicitada?: string | null
          deleted_at?: string | null
          email?: string | null
          empreendimento_id?: string | null
          fonte?: string | null
          horario_visita_solicitada?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          origem?: string | null
          perfil_falta?: string | null
          perfil_ia?: string | null
          perfil_ia_em?: string | null
          perfil_temperatura?: string | null
          planilha_extra?: Json | null
          qualificacao?: Json | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          status_atendimento?: string
          telefone?: string
          telefone_chave?: string | null
          telefone_chave_conflito?: boolean
          telefone_exibicao?: string | null
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
      mensagens: {
        Row: {
          autor_id: string | null
          autor_nome: string | null
          conversa_id: string
          criado_em: string
          direcao: string
          duracao_s: number | null
          erro: string | null
          id: string
          midia_bytes: number | null
          midia_mime: string | null
          midia_nome: string | null
          midia_path: string | null
          origem: string
          responde_a: string | null
          status: string
          texto: string | null
          tipo: string
          transcricao: string | null
          wa_id: string | null
        }
        Insert: {
          autor_id?: string | null
          autor_nome?: string | null
          conversa_id: string
          criado_em?: string
          direcao: string
          duracao_s?: number | null
          erro?: string | null
          id?: string
          midia_bytes?: number | null
          midia_mime?: string | null
          midia_nome?: string | null
          midia_path?: string | null
          origem?: string
          responde_a?: string | null
          status?: string
          texto?: string | null
          tipo?: string
          transcricao?: string | null
          wa_id?: string | null
        }
        Update: {
          autor_id?: string | null
          autor_nome?: string | null
          conversa_id?: string
          criado_em?: string
          direcao?: string
          duracao_s?: number | null
          erro?: string | null
          id?: string
          midia_bytes?: number | null
          midia_mime?: string | null
          midia_nome?: string | null
          midia_path?: string | null
          origem?: string
          responde_a?: string | null
          status?: string
          texto?: string | null
          tipo?: string
          transcricao?: string | null
          wa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_responde_a_fkey"
            columns: ["responde_a"]
            isOneToOne: false
            referencedRelation: "mensagens"
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
      push_inscricoes: {
        Row: {
          auth: string
          criado_em: string
          endpoint: string
          id: string
          p256dh: string
          ultimo_uso_em: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          criado_em?: string
          endpoint: string
          id?: string
          p256dh: string
          ultimo_uso_em?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          criado_em?: string
          endpoint?: string
          id?: string
          p256dh?: string
          ultimo_uso_em?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
      relatorios_automaticos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          descricao: string | null
          destinatarios: string[]
          dias_semana: number[]
          enviar_email: boolean
          enviar_whatsapp: boolean
          evolution_instance_id: string | null
          fonte_dados: string
          hora: string
          id: string
          meta_visitas_dia: number
          nome: string
          remetente: string
          whatsapp_destino: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          descricao?: string | null
          destinatarios?: string[]
          dias_semana: number[]
          enviar_email?: boolean
          enviar_whatsapp?: boolean
          evolution_instance_id?: string | null
          fonte_dados?: string
          hora: string
          id: string
          meta_visitas_dia?: number
          nome: string
          remetente?: string
          whatsapp_destino?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          descricao?: string | null
          destinatarios?: string[]
          dias_semana?: number[]
          enviar_email?: boolean
          enviar_whatsapp?: boolean
          evolution_instance_id?: string | null
          fonte_dados?: string
          hora?: string
          id?: string
          meta_visitas_dia?: number
          nome?: string
          remetente?: string
          whatsapp_destino?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_automaticos_evolution_instance_id_fkey"
            columns: ["evolution_instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios_envios: {
        Row: {
          assunto: string | null
          canal: string
          criado_em: string
          criado_por: string | null
          destinatarios: string[] | null
          erro: string | null
          id: number
          referencia: string
          relatorio: string
          status: string
          teste: boolean
        }
        Insert: {
          assunto?: string | null
          canal: string
          criado_em?: string
          criado_por?: string | null
          destinatarios?: string[] | null
          erro?: string | null
          id?: number
          referencia: string
          relatorio: string
          status: string
          teste?: boolean
        }
        Update: {
          assunto?: string | null
          canal?: string
          criado_em?: string
          criado_por?: string | null
          destinatarios?: string[] | null
          erro?: string | null
          id?: number
          referencia?: string
          relatorio?: string
          status?: string
          teste?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_envios_relatorio_fkey"
            columns: ["relatorio"]
            isOneToOne: false
            referencedRelation: "relatorios_automaticos"
            referencedColumns: ["id"]
          },
        ]
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
      respostas_rapidas: {
        Row: {
          atalho: string
          criado_em: string
          dono_id: string | null
          id: string
          texto: string
          titulo: string
        }
        Insert: {
          atalho: string
          criado_em?: string
          dono_id?: string | null
          id?: string
          texto: string
          titulo: string
        }
        Update: {
          atalho?: string
          criado_em?: string
          dono_id?: string | null
          id?: string
          texto?: string
          titulo?: string
        }
        Relationships: []
      }
      sale_deletion_requests: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          created_by: string
          delete_from_finance: boolean
          id: string
          last_error: string | null
          leased_until: string | null
          next_retry_at: string | null
          state: string
          updated_at: string
          venda_id: string
          venda_snapshot: Json
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by: string
          delete_from_finance?: boolean
          id?: string
          last_error?: string | null
          leased_until?: string | null
          next_retry_at?: string | null
          state?: string
          updated_at?: string
          venda_id: string
          venda_snapshot: Json
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string
          delete_from_finance?: boolean
          id?: string
          last_error?: string | null
          leased_until?: string | null
          next_retry_at?: string | null
          state?: string
          updated_at?: string
          venda_id?: string
          venda_snapshot?: Json
        }
        Relationships: []
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
      sheet_sync_execucoes: {
        Row: {
          concluido_em: string | null
          detalhes: Json | null
          enviados: number
          erros: number
          id: number
          iniciado_em: string
          mensagem: string | null
          modo: string
        }
        Insert: {
          concluido_em?: string | null
          detalhes?: Json | null
          enviados?: number
          erros?: number
          id?: number
          iniciado_em?: string
          mensagem?: string | null
          modo: string
        }
        Update: {
          concluido_em?: string | null
          detalhes?: Json | null
          enviados?: number
          erros?: number
          id?: number
          iniciado_em?: string
          mensagem?: string | null
          modo?: string
        }
        Relationships: []
      }
      sheet_sync_queue: {
        Row: {
          aba: string
          criado_em: string
          enviado_em: string | null
          id: number
          lease_ate: string | null
          origem: string
          proxima_tentativa: string
          registro_id: string
          status: string
          tentativas: number
          ultimo_erro: string | null
        }
        Insert: {
          aba: string
          criado_em?: string
          enviado_em?: string | null
          id?: number
          lease_ate?: string | null
          origem?: string
          proxima_tentativa?: string
          registro_id: string
          status?: string
          tentativas?: number
          ultimo_erro?: string | null
        }
        Update: {
          aba?: string
          criado_em?: string
          enviado_em?: string | null
          id?: number
          lease_ate?: string | null
          origem?: string
          proxima_tentativa?: string
          registro_id?: string
          status?: string
          tentativas?: number
          ultimo_erro?: string | null
        }
        Relationships: []
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
      tarefas: {
        Row: {
          concluida_em: string | null
          concluida_por: string | null
          criado_em: string
          disponivel_em: string
          dono_id: string | null
          id: string
          lead_id: string | null
          lembrete_push_em: string | null
          observacao: string | null
          status: string
          tipo: string
          titulo: string
          vence_em: string
          visita_id: string | null
        }
        Insert: {
          concluida_em?: string | null
          concluida_por?: string | null
          criado_em?: string
          disponivel_em?: string
          dono_id?: string | null
          id?: string
          lead_id?: string | null
          lembrete_push_em?: string | null
          observacao?: string | null
          status?: string
          tipo: string
          titulo: string
          vence_em: string
          visita_id?: string | null
        }
        Update: {
          concluida_em?: string | null
          concluida_por?: string | null
          criado_em?: string
          disponivel_em?: string
          dono_id?: string | null
          id?: string
          lead_id?: string | null
          lembrete_push_em?: string | null
          observacao?: string | null
          status?: string
          tipo?: string
          titulo?: string
          vence_em?: string
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
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
      visit_ai_runs: {
        Row: {
          created_at: string
          evidence: Json
          id: string
          kind: string
          latency_ms: number | null
          model: string
          prompt_version: string
          status: string
          tokens: number | null
          trace_id: string | null
        }
        Insert: {
          created_at?: string
          evidence?: Json
          id?: string
          kind: string
          latency_ms?: number | null
          model: string
          prompt_version?: string
          status: string
          tokens?: number | null
          trace_id?: string | null
        }
        Update: {
          created_at?: string
          evidence?: Json
          id?: string
          kind?: string
          latency_ms?: number | null
          model?: string
          prompt_version?: string
          status?: string
          tokens?: number | null
          trace_id?: string | null
        }
        Relationships: []
      }
      visit_automation_config: {
        Row: {
          closer_phone: string
          enabled: boolean
          group_jid: string
          id: boolean
          instance_id: string | null
          intake_enabled: boolean
          match_max_attempts: number
          spreadsheet_id: string
          updated_at: string
        }
        Insert: {
          closer_phone?: string
          enabled?: boolean
          group_jid?: string
          id?: boolean
          instance_id?: string | null
          intake_enabled?: boolean
          match_max_attempts?: number
          spreadsheet_id?: string
          updated_at?: string
        }
        Update: {
          closer_phone?: string
          enabled?: boolean
          group_jid?: string
          id?: boolean
          instance_id?: string | null
          intake_enabled?: boolean
          match_max_attempts?: number
          spreadsheet_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_automation_config_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_cycles: {
        Row: {
          attendance_overdue: boolean
          aviso_corretor: string
          broker_confirmed: boolean | null
          broker_feedback_at: string | null
          chamado_automatico: boolean
          client_confirmed: boolean | null
          confirmation_overdue: boolean
          created_at: string
          feedback: Json | null
          feedback_at: string | null
          match_approved_conflicts: string[]
          match_round: number
          match_status: string
          outcome: string
          previous_visita_id: string | null
          rating: number | null
          reason: string | null
          recovery_open: boolean
          revision: number
          scheduled_at: string
          summary_sent_at: string | null
          updated_at: string
          visita_id: string
        }
        Insert: {
          attendance_overdue?: boolean
          aviso_corretor?: string
          broker_confirmed?: boolean | null
          broker_feedback_at?: string | null
          chamado_automatico?: boolean
          client_confirmed?: boolean | null
          confirmation_overdue?: boolean
          created_at?: string
          feedback?: Json | null
          feedback_at?: string | null
          match_approved_conflicts?: string[]
          match_round?: number
          match_status?: string
          outcome?: string
          previous_visita_id?: string | null
          rating?: number | null
          reason?: string | null
          recovery_open?: boolean
          revision?: number
          scheduled_at: string
          summary_sent_at?: string | null
          updated_at?: string
          visita_id: string
        }
        Update: {
          attendance_overdue?: boolean
          aviso_corretor?: string
          broker_confirmed?: boolean | null
          broker_feedback_at?: string | null
          chamado_automatico?: boolean
          client_confirmed?: boolean | null
          confirmation_overdue?: boolean
          created_at?: string
          feedback?: Json | null
          feedback_at?: string | null
          match_approved_conflicts?: string[]
          match_round?: number
          match_status?: string
          outcome?: string
          previous_visita_id?: string | null
          rating?: number | null
          reason?: string | null
          recovery_open?: boolean
          revision?: number
          scheduled_at?: string
          summary_sent_at?: string | null
          updated_at?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_cycles_previous_visita_id_fkey"
            columns: ["previous_visita_id"]
            isOneToOne: true
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_cycles_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: true
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_delivery_receipts: {
        Row: {
          provider_id: string
          state: string
          updated_at: string
        }
        Insert: {
          provider_id: string
          state: string
          updated_at?: string
        }
        Update: {
          provider_id?: string
          state?: string
          updated_at?: string
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
      visit_events: {
        Row: {
          ator_id: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          revision: number
          visita_id: string
        }
        Insert: {
          ator_id?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          revision: number
          visita_id: string
        }
        Update: {
          ator_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          revision?: number
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_events_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visit_cycles"
            referencedColumns: ["visita_id"]
          },
        ]
      }
      visit_inbound_receipts: {
        Row: {
          created_at: string
          message_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
        }
        Relationships: []
      }
      visit_intake: {
        Row: {
          approved_conflicts: string[] | null
          attempts: number
          author_jid: string
          author_phone: string
          available_at: string
          choices: Json
          conflict_ids: string[] | null
          created_at: string
          fields: Json
          group_jid: string
          id: string
          input_text: string
          instance_id: string
          last_error: string | null
          lease_token: string | null
          leased_until: string | null
          original_message: string
          protocol: string
          protocol_aliases: string[]
          resolution_note: string | null
          revision: number
          status: string
          updated_at: string
          visita_id: string | null
        }
        Insert: {
          approved_conflicts?: string[] | null
          attempts?: number
          author_jid: string
          author_phone?: string
          available_at?: string
          choices?: Json
          conflict_ids?: string[] | null
          created_at?: string
          fields?: Json
          group_jid: string
          id?: string
          input_text: string
          instance_id: string
          last_error?: string | null
          lease_token?: string | null
          leased_until?: string | null
          original_message: string
          protocol?: string
          protocol_aliases?: string[]
          resolution_note?: string | null
          revision?: number
          status?: string
          updated_at?: string
          visita_id?: string | null
        }
        Update: {
          approved_conflicts?: string[] | null
          attempts?: number
          author_jid?: string
          author_phone?: string
          available_at?: string
          choices?: Json
          conflict_ids?: string[] | null
          created_at?: string
          fields?: Json
          group_jid?: string
          id?: string
          input_text?: string
          instance_id?: string
          last_error?: string | null
          lease_token?: string | null
          leased_until?: string | null
          original_message?: string
          protocol?: string
          protocol_aliases?: string[]
          resolution_note?: string | null
          revision?: number
          status?: string
          updated_at?: string
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_intake_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_intake_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_intake_messages: {
        Row: {
          author_jid: string
          body: string
          created_at: string
          intake_id: string | null
          message_key: string
        }
        Insert: {
          author_jid: string
          body: string
          created_at?: string
          intake_id?: string | null
          message_key: string
        }
        Update: {
          author_jid?: string
          body?: string
          created_at?: string
          intake_id?: string | null
          message_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_intake_messages_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "visit_intake"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_intake_outbox: {
        Row: {
          attempts: number
          available_at: string
          body: string
          created_at: string
          delivery_state: string
          destination: string
          id: string
          intake_id: string
          last_error: string | null
          lease_token: string | null
          leased_until: string | null
          notification_kind: string
          provider_id: string | null
          revision: number
          status: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          body: string
          created_at?: string
          delivery_state?: string
          destination: string
          id?: string
          intake_id: string
          last_error?: string | null
          lease_token?: string | null
          leased_until?: string | null
          notification_kind?: string
          provider_id?: string | null
          revision: number
          status?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          body?: string
          created_at?: string
          delivery_state?: string
          destination?: string
          id?: string
          intake_id?: string
          last_error?: string | null
          lease_token?: string | null
          leased_until?: string | null
          notification_kind?: string
          provider_id?: string | null
          revision?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_intake_outbox_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "visit_intake"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_match_attempts: {
        Row: {
          answered_at: string | null
          corretor_id: string
          created_at: string
          id: string
          prompt_id: string | null
          ranking: Json
          revision: number
          round: number
          status: string
          visita_id: string
        }
        Insert: {
          answered_at?: string | null
          corretor_id: string
          created_at?: string
          id?: string
          prompt_id?: string | null
          ranking?: Json
          revision: number
          round: number
          status?: string
          visita_id: string
        }
        Update: {
          answered_at?: string | null
          corretor_id?: string
          created_at?: string
          id?: string
          prompt_id?: string | null
          ranking?: Json
          revision?: number
          round?: number
          status?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_match_attempts_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_match_attempts_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_match_attempts_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: true
            referencedRelation: "visit_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_match_attempts_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visit_cycles"
            referencedColumns: ["visita_id"]
          },
        ]
      }
      visit_outbox: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          delivery_state: string
          destination: string
          event_id: string | null
          id: string
          last_error: string | null
          lease_token: string | null
          leased_until: string | null
          prompt_id: string | null
          provider_id: string | null
          revision: number
          sent_at: string | null
          status: string
          urgent: boolean
          visita_id: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          delivery_state?: string
          destination: string
          event_id?: string | null
          id?: string
          last_error?: string | null
          lease_token?: string | null
          leased_until?: string | null
          prompt_id?: string | null
          provider_id?: string | null
          revision: number
          sent_at?: string | null
          status?: string
          urgent?: boolean
          visita_id: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          delivery_state?: string
          destination?: string
          event_id?: string | null
          id?: string
          last_error?: string | null
          lease_token?: string | null
          leased_until?: string | null
          prompt_id?: string | null
          provider_id?: string | null
          revision?: number
          sent_at?: string | null
          status?: string
          urgent?: boolean
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_outbox_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "visit_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_outbox_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "visit_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_outbox_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visit_cycles"
            referencedColumns: ["visita_id"]
          },
        ]
      }
      visit_prompts: {
        Row: {
          answered_at: string | null
          audience: string
          expires_at: string
          id: string
          kind: string
          phone: string
          revision: number
          sent_at: string | null
          visita_id: string
        }
        Insert: {
          answered_at?: string | null
          audience: string
          expires_at: string
          id?: string
          kind: string
          phone: string
          revision: number
          sent_at?: string | null
          visita_id: string
        }
        Update: {
          answered_at?: string | null
          audience?: string
          expires_at?: string
          id?: string
          kind?: string
          phone?: string
          revision?: number
          sent_at?: string | null
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_prompts_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visit_cycles"
            referencedColumns: ["visita_id"]
          },
        ]
      }
      visit_worker_health: {
        Row: {
          last_completed: string | null
          last_error: string | null
          last_started: string | null
          name: string
        }
        Insert: {
          last_completed?: string | null
          last_error?: string | null
          last_started?: string | null
          name: string
        }
        Update: {
          last_completed?: string | null
          last_error?: string | null
          last_started?: string | null
          name?: string
        }
        Relationships: []
      }
      visita_convites: {
        Row: {
          automatico: boolean
          canal: string
          corretor_id: string
          criado_por: string | null
          enviado_em: string
          id: string
          motivo_sugestao: string | null
          reavisos: number
          respondido_em: string | null
          resposta: string | null
          score: number | null
          visita_id: string
        }
        Insert: {
          automatico?: boolean
          canal?: string
          corretor_id: string
          criado_por?: string | null
          enviado_em?: string
          id?: string
          motivo_sugestao?: string | null
          reavisos?: number
          respondido_em?: string | null
          resposta?: string | null
          score?: number | null
          visita_id: string
        }
        Update: {
          automatico?: boolean
          canal?: string
          corretor_id?: string
          criado_por?: string | null
          enviado_em?: string
          id?: string
          motivo_sugestao?: string | null
          reavisos?: number
          respondido_em?: string | null
          resposta?: string | null
          score?: number | null
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visita_convites_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visita_convites_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visita_convites_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      visita_mensagens_auto: {
        Row: {
          chave: string
          conversa_id: string | null
          criado_em: string
          enviada_em: string | null
          enviar_em: string
          erro: string | null
          id: string
          mensagem_id: string | null
          reivindicada_em: string | null
          status: string
          template: string
          tentativas: number
          visita_id: string
        }
        Insert: {
          chave: string
          conversa_id?: string | null
          criado_em?: string
          enviada_em?: string | null
          enviar_em: string
          erro?: string | null
          id?: string
          mensagem_id?: string | null
          reivindicada_em?: string | null
          status?: string
          template: string
          tentativas?: number
          visita_id: string
        }
        Update: {
          chave?: string
          conversa_id?: string | null
          criado_em?: string
          enviada_em?: string | null
          enviar_em?: string
          erro?: string | null
          id?: string
          mensagem_id?: string | null
          reivindicada_em?: string | null
          status?: string
          template?: string
          tentativas?: number
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visita_mensagens_auto_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visita_mensagens_auto_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "mensagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visita_mensagens_auto_visita_id_fkey"
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
          buffer_minutes: number
          comentarios_lead: string | null
          confirmation_metadata: Json | null
          corretor_confirmou: boolean | null
          corretor_id: string | null
          created_at: string | null
          criado_por: string | null
          customer_profile: string | null
          data_venda: string | null
          data_visita: string
          deleted_at: string | null
          duration_minutes: number
          empreendimento_id: string | null
          escalada_em: string | null
          fase1: boolean
          feedback_corretor: string | null
          horario_visita: string
          id: string
          intake_source: string | null
          interesse: boolean | null
          lead_confirmou: boolean | null
          lead_id: string
          local_nome: string | null
          meeting_address: string | null
          meeting_neighborhood: string | null
          motivo_cancelamento: string | null
          no_show_em: string | null
          planilha_extra: Json | null
          proximo_passo: string | null
          resultado_cliente: string | null
          status: string | null
          tentativas_remarcar: number
          ultima_tentativa_remarcar: string | null
          updated_at: string | null
          visit_code: string
        }
        Insert: {
          avaliacao_lead?: number | null
          buffer_minutes?: number
          comentarios_lead?: string | null
          confirmation_metadata?: Json | null
          corretor_confirmou?: boolean | null
          corretor_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          customer_profile?: string | null
          data_venda?: string | null
          data_visita: string
          deleted_at?: string | null
          duration_minutes?: number
          empreendimento_id?: string | null
          escalada_em?: string | null
          fase1?: boolean
          feedback_corretor?: string | null
          horario_visita: string
          id?: string
          intake_source?: string | null
          interesse?: boolean | null
          lead_confirmou?: boolean | null
          lead_id: string
          local_nome?: string | null
          meeting_address?: string | null
          meeting_neighborhood?: string | null
          motivo_cancelamento?: string | null
          no_show_em?: string | null
          planilha_extra?: Json | null
          proximo_passo?: string | null
          resultado_cliente?: string | null
          status?: string | null
          tentativas_remarcar?: number
          ultima_tentativa_remarcar?: string | null
          updated_at?: string | null
          visit_code?: string
        }
        Update: {
          avaliacao_lead?: number | null
          buffer_minutes?: number
          comentarios_lead?: string | null
          confirmation_metadata?: Json | null
          corretor_confirmou?: boolean | null
          corretor_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          customer_profile?: string | null
          data_venda?: string | null
          data_visita?: string
          deleted_at?: string | null
          duration_minutes?: number
          empreendimento_id?: string | null
          escalada_em?: string | null
          fase1?: boolean
          feedback_corretor?: string | null
          horario_visita?: string
          id?: string
          intake_source?: string | null
          interesse?: boolean | null
          lead_confirmou?: boolean | null
          lead_id?: string
          local_nome?: string | null
          meeting_address?: string | null
          meeting_neighborhood?: string | null
          motivo_cancelamento?: string | null
          no_show_em?: string | null
          planilha_extra?: Json | null
          proximo_passo?: string | null
          resultado_cliente?: string | null
          status?: string | null
          tentativas_remarcar?: number
          ultima_tentativa_remarcar?: string | null
          updated_at?: string | null
          visit_code?: string
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
      leads_duplicados: {
        Row: {
          lead_ids: string[] | null
          nomes: string[] | null
          primeiro_cadastro: string | null
          quantidade: number | null
          telefone_chave: string | null
          ultimo_cadastro: string | null
        }
        Relationships: []
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
      accept_lead_distribution: {
        Args: { p_attempt_id: string; p_corretor_id: string }
        Returns: boolean
      }
      accept_visit_distribution: {
        Args: { p_attempt_id: string; p_corretor_id: string }
        Returns: boolean
      }
      assign_ab_experiment: {
        Args: { p_conversation_id: string; p_experiment_id: string }
        Returns: string
      }
      can_send_followup: {
        Args: { p_agent_id: string; p_conversation_id: string }
        Returns: boolean
      }
      claim_sale_deletion_requests: {
        Args: { _limit?: number; _request_id?: string }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          created_by: string
          delete_from_finance: boolean
          id: string
          last_error: string | null
          leased_until: string | null
          next_retry_at: string | null
          state: string
          updated_at: string
          venda_id: string
          venda_snapshot: Json
        }[]
        SetofOptions: {
          from: "*"
          to: "sale_deletion_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_database_operational_history: {
        Args: never
        Returns: {
          cron_runs_deleted: number
          health_metrics_deleted: number
          rate_limits_deleted: number
          response_cache_deleted: number
        }[]
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
      cleanup_old_technical_logs: {
        Args: never
        Returns: {
          application_logs_deleted: number
          integration_logs_deleted: number
          webhook_logs_deleted: number
        }[]
      }
      cleanup_old_whatsapp_verification: { Args: never; Returns: undefined }
      compact_operational_tables_if_needed: {
        Args: never
        Returns: {
          cron_compacted: boolean
          cron_rows_preserved: number
          net_compacted: boolean
          net_rows_preserved: number
        }[]
      }
      complete_crm_sale: {
        Args: { p_crm_lead_id: string; p_sale: Json }
        Returns: string
      }
      conv_alerta_resolver: { Args: { p_alerta: string }; Returns: undefined }
      conv_atualizar_status: {
        Args: { p_instancia: string; p_status: string; p_wa_id: string }
        Returns: undefined
      }
      conv_foto_gravar: {
        Args: { p_conversa: string; p_url: string }
        Returns: undefined
      }
      conv_fotos_pendentes: {
        Args: { p_limite?: number }
        Returns: {
          conversa_id: string
          instancia: string
          telefone: string
        }[]
      }
      conv_ia_proximas: {
        Args: { p_limite?: number }
        Returns: {
          aguardando_desde: string | null
          arquivada: boolean
          criada_em: string
          dono_id: string | null
          dono_papel: string
          etapa: string
          foto_em: string | null
          foto_url: string | null
          ia_analisada_em: string | null
          ia_falta: string | null
          ia_pendente_desde: string | null
          id: string
          jid: string
          lead_id: string | null
          nome_contato: string | null
          numero_id: string
          resumo_ia: string | null
          telefone: string
          telefone_chave: string
          temperatura: string | null
          ultima_direcao: string | null
          ultima_mensagem_em: string | null
          ultima_previa: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "conversas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      conv_mensagem_resultado: {
        Args: { p_erro?: string; p_id: string; p_wa_id: string }
        Returns: undefined
      }
      conv_mensagem_saida: { Args: { p: Json }; Returns: string }
      conv_numero_status: {
        Args: { p_instancia: string; p_status: string; p_telefone?: string }
        Returns: undefined
      }
      conv_registrar_mensagem: { Args: { p: Json }; Returns: Json }
      conv_segredo: { Args: { p_nome: string }; Returns: string }
      conv_segredo_salvar: {
        Args: { p_nome: string; p_valor: string }
        Returns: string
      }
      conversa_arquivar: {
        Args: { p_arquivar: boolean; p_conversa: string }
        Returns: undefined
      }
      conversa_assumir: { Args: { p_conversa: string }; Returns: Json }
      conversa_iniciar: {
        Args: { p_lead: string; p_numero?: string }
        Returns: string
      }
      conversa_marcar_lida: { Args: { p_conversa: string }; Returns: undefined }
      conversa_mover_etapa: {
        Args: { p_conversa: string; p_etapa: string }
        Returns: undefined
      }
      conversa_nota: {
        Args: { p_conversa: string; p_texto: string }
        Returns: string
      }
      conversa_preparar_envio: { Args: { p_conversa: string }; Returns: Json }
      conversa_transferir: {
        Args: {
          p_conversa: string
          p_motivo?: string
          p_papel: string
          p_para: string
        }
        Returns: Json
      }
      conversa_vincular_lead: {
        Args: { p_conversa: string; p_lead: string }
        Returns: undefined
      }
      conversas_desempenho: {
        Args: { p_dias?: number }
        Returns: {
          aguardando: number
          alertas_sem_resposta: number
          conversas_ativas: number
          corretor_id: string
          mensagens_enviadas: number
          nome: string
          respondidas_15min_pct: number
          sem_contato_3d: number
          tempo_medio_resposta_min: number
          user_id: string
          vendas: number
          visitas_agendadas: number
          visitas_realizadas: number
        }[]
      }
      conversas_listar: {
        Args: { p_busca?: string; p_filtro?: string; p_limite?: number }
        Returns: {
          aguardando_desde: string
          alertas_abertos: number
          arquivada: boolean
          dono_id: string
          dono_nome: string
          dono_papel: string
          etapa: string
          foto_url: string
          id: string
          lead_id: string
          lead_nome: string
          lead_status: string
          nao_lidas: number
          nome_contato: string
          numero_id: string
          numero_nome: string
          numero_status: string
          resumo_ia: string
          sugestoes_abertas: number
          telefone: string
          temperatura: string
          ultima_direcao: string
          ultima_mensagem_em: string
          ultima_previa: string
        }[]
      }
      corretor_meus_clientes: {
        Args: never
        Returns: {
          aguardando_desde: string
          conversa_id: string
          empreendimento: string
          etapa: string
          foto_url: string
          lead_id: string
          nome: string
          proxima_visita: Json
          resumo_ia: string
          telefone: string
          temperatura: string
          ultima_direcao: string
          ultima_mensagem_em: string
          ultima_previa: string
        }[]
      }
      corretor_meus_convites: {
        Args: never
        Returns: {
          bairro: string
          convite_id: string
          data_visita: string
          empreendimento: string
          enviado_em: string
          fonte: string
          horario_visita: string
          imagem: string
          lead_nome: string
          local_nome: string
          perfil: string
          prazo_em: string
          renda: string
          visita_id: string
        }[]
      }
      corretor_minhas_comissoes: {
        Args: never
        Returns: {
          atualizado_em: string
          cliente: string
          comissao_percentual: number
          data_pagamento: string
          data_venda: string
          empreendimento: string
          imagem: string
          imposto_percentual: number
          observacoes: string
          status: string
          tem_comprovante: boolean
          valor_comissao_bruta: number
          valor_corretor: number
          valor_imovel: number
          valor_imposto: number
          venda_id: string
        }[]
      }
      corretor_registrar_visita: {
        Args: { p_observacao?: string; p_resultado: string; p_visita: string }
        Returns: Json
      }
      corretor_responder_convite: {
        Args: { p_aceitar: boolean; p_convite: string; p_observacao?: string }
        Returns: Json
      }
      corretores_ranking: {
        Args: never
        Returns: {
          aceite: number
          conversao: number
          corretor_id: string
          detalhe: Json
          motivo: string
          nome: string
          nota: number
          realizadas: number
          score: number
          vendas: number
        }[]
      }
      corretores_sugeridos: {
        Args: {
          p_data?: string
          p_empreendimento_id: string
          p_excluir?: string[]
          p_hora?: string
          p_limite?: number
          p_visita_id?: string
        }
        Returns: {
          aceite: number
          aderencia: number
          conversao: number
          corretor_id: string
          detalhe: Json
          disponivel: boolean
          ja_convidado: boolean
          motivo: string
          nome: string
          nota: number
          realizadas: number
          score: number
          vendas: number
          whatsapp: string
        }[]
      }
      create_crm_opportunity: {
        Args: {
          p_empreendimento_id?: string
          p_lead_id: string
          p_notas?: string
          p_pipeline_id: string
          p_stage_id: string
          p_valor_estimado?: number
        }
        Returns: string
      }
      create_lead_with_crm_opportunity: {
        Args: { p_input: Json }
        Returns: Json
      }
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
      dequeue_pending_messages: {
        Args: { p_limit: number }
        Returns: {
          attempts: number
          id: string
          instance_id: string
          message_body: Json
          phone_number: string
          priority: number
        }[]
      }
      ensure_monthly_log_partitions: {
        Args: { p_months_ahead?: number }
        Returns: number
      }
      equipe_comercial: {
        Args: never
        Returns: {
          closer: boolean
          nome: string
          papel: string
          responsavel: boolean
          user_id: string
        }[]
      }
      fase1_robo_definir: { Args: { p_ativo: boolean }; Returns: Json }
      finish_sale_deletion_request: {
        Args: { _error?: string; _request_id: string; _success: boolean }
        Returns: undefined
      }
      fonte_from_origem: { Args: { p_origem: string }; Returns: string }
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
      get_finance_webhook_config: { Args: never; Returns: Json }
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
      ia_aplicar_ficha: {
        Args: {
          p_conversa: string
          p_evidencias: Json
          p_lead: string
          p_qualificacao: Json
          p_status: string
        }
        Returns: Json
      }
      ia_mudanca_desfazer: { Args: { p_mudanca: string }; Returns: Json }
      ia_sugestao_decidir: {
        Args: { p_aceitar: boolean; p_sugestao: string; p_valor?: Json }
        Returns: Json
      }
      import_conflito_resolver: { Args: { p_id: string }; Returns: undefined }
      increment_rate_limit: {
        Args: { p_key: string; p_max?: number; p_window_seconds?: number }
        Returns: {
          current_count: number
          is_allowed: boolean
        }[]
      }
      lead_adicionar_nota: {
        Args: { p_lead_id: string; p_texto: string }
        Returns: Json
      }
      lead_atualizar: {
        Args: { p_campos: Json; p_lead_id: string }
        Returns: Json
      }
      lead_buscar_por_telefone: { Args: { p_telefone: string }; Returns: Json }
      lead_criar: { Args: { p_dados: Json }; Returns: Json }
      lead_lembrete: {
        Args: { p_dias: number; p_lead_id: string; p_observacao?: string }
        Returns: Json
      }
      leads_em_massa: {
        Args: { p_campos: Json; p_ids: string[] }
        Returns: Json
      }
      leads_excluir: { Args: { p_ids: string[] }; Returns: Json }
      leads_responsaveis_pendentes: {
        Args: never
        Returns: {
          nome: string
          quantidade: number
        }[]
      }
      leads_restaurar: { Args: { p_ids: string[] }; Returns: Json }
      leads_vincular_responsavel_importado: {
        Args: { p_nome_planilha: string; p_user: string }
        Returns: number
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
      mensagem_registrar_uso: {
        Args: {
          p_acao: string
          p_destino: string
          p_template: string
          p_visita_id: string
        }
        Returns: undefined
      }
      meu_avatar_definir: { Args: { p_caminho: string }; Returns: string }
      minha_atividade_concluir: {
        Args: { p_tarefa: string }
        Returns: undefined
      }
      minha_atividade_criar: {
        Args: {
          p_conversa?: string
          p_lead?: string
          p_quando: string
          p_titulo: string
        }
        Returns: string
      }
      minhas_atividades: {
        Args: never
        Returns: {
          conversa_id: string
          disponivel_em: string
          id: string
          lead_id: string
          lead_nome: string
          titulo: string
          vence_em: string
        }[]
      }
      normalize_brazilian_phone: {
        Args: { phone_input: string }
        Returns: string
      }
      normalize_phone: {
        Args: { raw: string }
        Returns: {
          canonico: string
          chave: string
          exibicao: string
        }[]
      }
      normalize_phone_canonical: { Args: { raw: string }; Returns: string }
      normalize_phone_display: { Args: { raw: string }; Returns: string }
      normalize_phone_key: { Args: { raw: string }; Returns: string }
      painel_apresentacao: {
        Args: { p_ate: string; p_de: string }
        Returns: Json
      }
      painel_comercial: { Args: { p_ate: string; p_de: string }; Returns: Json }
      painel_historico: {
        Args: { p_ate: string; p_meses?: number }
        Returns: Json
      }
      permanently_delete_lead: { Args: { p_lead_id: string }; Returns: boolean }
      planilha_importar_lote: {
        Args: { p_aba: string; p_linhas: Json }
        Returns: Json
      }
      planilha_puxar: {
        Args: { p_aba: string; p_aplicar?: boolean; p_linhas: Json }
        Returns: Json
      }
      planilha_sincronizar_agora: { Args: never; Returns: Json }
      push_inscrever: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      push_remover: { Args: { p_endpoint: string }; Returns: undefined }
      relatorio_salvar: {
        Args: { p_dados: Json; p_id: string }
        Returns: undefined
      }
      request_sale_deletion: {
        Args: {
          _actor_id: string
          _delete_from_finance: boolean
          _venda_id: string
        }
        Returns: Json
      }
      resposta_rapida_excluir: { Args: { p_id: string }; Returns: undefined }
      resposta_rapida_salvar: {
        Args: {
          p_atalho: string
          p_equipe?: boolean
          p_id: string
          p_texto: string
          p_titulo: string
        }
        Returns: string
      }
      restore_visita: { Args: { visita_id: string }; Returns: undefined }
      save_crm_pipeline_configuration: {
        Args: {
          p_auto_add_visits: boolean
          p_descricao: string
          p_nome: string
          p_pipeline_id: string
          p_stages: Json
        }
        Returns: undefined
      }
      save_crm_pipeline_settings: {
        Args: {
          p_auto_add_visits: boolean
          p_completed_stage_id: string
          p_descricao: string
          p_nome: string
          p_pipeline_id: string
          p_stages: Json
        }
        Returns: undefined
      }
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
      sheet_ids_existentes: {
        Args: { p_aba: string; p_ids: string[] }
        Returns: string[]
      }
      sheet_status_visita: { Args: { p_status: string }; Returns: string }
      sheet_sync_claim: {
        Args: { p_limite?: number }
        Returns: {
          aba: string
          id: number
          linha: Json
          registro_id: string
          tentativas: number
        }[]
      }
      sheet_sync_concluir: {
        Args: { p_falhas?: Json; p_ok: number[] }
        Returns: undefined
      }
      sheet_sync_enfileirar_ids: {
        Args: { p_aba: string; p_ids: string[]; p_origem: string }
        Returns: number
      }
      sheet_sync_enfileirar_todos: {
        Args: { p_aba: string; p_origem: string }
        Returns: number
      }
      sheet_sync_execucao: {
        Args: {
          p_detalhes: Json
          p_enviados: number
          p_erros: number
          p_inicio: string
          p_mensagem: string
          p_modo: string
        }
        Returns: undefined
      }
      sheet_sync_ids: {
        Args: { p_aba: string }
        Returns: {
          linha: Json
          registro_id: string
        }[]
      }
      sheet_sync_painel: { Args: never; Returns: Json }
      sheet_sync_reenviar: { Args: never; Returns: number }
      soft_delete_visita: { Args: { visita_id: string }; Returns: undefined }
      tarefa_concluir: {
        Args: { p_observacao?: string; p_tarefa_id: string }
        Returns: Json
      }
      usuario_creci_em_uso: { Args: { p_creci: string }; Returns: string }
      usuario_historico: { Args: { p_user: string }; Returns: Json }
      usuario_por_email: { Args: { p_email: string }; Returns: string }
      validate_cpf: { Args: { cpf_input: string }; Returns: boolean }
      verify_internal_function_secret: {
        Args: { _candidate: string }
        Returns: boolean
      }
      visit_delivery_receipt: {
        Args: { p_provider: string; p_state: string }
        Returns: undefined
      }
      visit_intake_claim: {
        Args: never
        Returns: {
          approved_conflicts: string[] | null
          attempts: number
          author_jid: string
          author_phone: string
          available_at: string
          choices: Json
          conflict_ids: string[] | null
          created_at: string
          fields: Json
          group_jid: string
          id: string
          input_text: string
          instance_id: string
          last_error: string | null
          lease_token: string | null
          leased_until: string | null
          original_message: string
          protocol: string
          protocol_aliases: string[]
          resolution_note: string | null
          revision: number
          status: string
          updated_at: string
          visita_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "visit_intake"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      visit_intake_delivery_claim: {
        Args: never
        Returns: {
          attempts: number
          available_at: string
          body: string
          created_at: string
          delivery_state: string
          destination: string
          id: string
          intake_id: string
          last_error: string | null
          lease_token: string | null
          leased_until: string | null
          notification_kind: string
          provider_id: string | null
          revision: number
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "visit_intake_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      visit_intake_delivery_finish: {
        Args: {
          p_error?: string
          p_id: string
          p_lease: string
          p_provider?: string
        }
        Returns: undefined
      }
      visit_intake_fail: {
        Args: { p_error: string; p_id: string; p_lease: string }
        Returns: undefined
      }
      visit_intake_find_leads: {
        Args: { p_phone: string }
        Returns: {
          id: string
          nome: string
        }[]
      }
      visit_intake_finish: {
        Args: {
          p_broker?: string
          p_choices: Json
          p_fields: Json
          p_id: string
          p_lease: string
          p_property?: string
          p_questions: string
        }
        Returns: string
      }
      visit_intake_receive: {
        Args: {
          p_action?: string
          p_admin?: string
          p_author: string
          p_group: string
          p_instance: string
          p_message: string
          p_phone: string
          p_protocol?: string
          p_revision?: number
          p_text: string
        }
        Returns: string
      }
      visit_lifecycle_action: {
        Args: {
          p_action: string
          p_actor: string
          p_data: Json
          p_visit: string
        }
        Returns: string
      }
      visit_lifecycle_claim: {
        Args: { p_channel?: string; p_limit?: number }
        Returns: {
          attempts: number
          available_at: string
          created_at: string
          delivery_state: string
          destination: string
          event_id: string | null
          id: string
          last_error: string | null
          lease_token: string | null
          leased_until: string | null
          prompt_id: string | null
          provider_id: string | null
          revision: number
          sent_at: string | null
          status: string
          urgent: boolean
          visita_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "visit_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      visit_lifecycle_finish: {
        Args: {
          p_error?: string
          p_id: string
          p_lease: string
          p_provider?: string
          p_status: string
        }
        Returns: undefined
      }
      visit_lifecycle_remind: { Args: { p_visit: string }; Returns: undefined }
      visit_lifecycle_reply: {
        Args: {
          p_answer: string
          p_message: string
          p_phone: string
          p_prompt: string
        }
        Returns: boolean
      }
      visit_lifecycle_reply_before_match: {
        Args: {
          p_answer: string
          p_message: string
          p_phone: string
          p_prompt: string
        }
        Returns: boolean
      }
      visit_lifecycle_tick: { Args: never; Returns: undefined }
      visit_lifecycle_tick_before_match: { Args: never; Returns: undefined }
      visit_match_manual: {
        Args: { p_actor: string; p_broker: string; p_visit: string }
        Returns: undefined
      }
      visita_agendar: { Args: { p_dados: Json }; Returns: Json }
      visita_atualizar_local: {
        Args: { p_dados: Json; p_visita_id: string }
        Returns: Json
      }
      visita_cancelar: {
        Args: { p_motivo: string; p_visita_id: string }
        Returns: Json
      }
      visita_confirmar: {
        Args: {
          p_confirmou?: boolean
          p_etapa: string
          p_observacao?: string
          p_visita_id: string
        }
        Returns: Json
      }
      visita_convidar_corretor: {
        Args: {
          p_corretor_id: string
          p_motivo?: string
          p_score?: number
          p_visita_id: string
        }
        Returns: Json
      }
      visita_escalar: {
        Args: { p_observacao?: string; p_visita_id: string }
        Returns: Json
      }
      visita_reagendar: {
        Args: {
          p_corretor_id?: string
          p_data: string
          p_hora: string
          p_observacao?: string
          p_visita_id: string
        }
        Returns: Json
      }
      visita_registrar_resultado: {
        Args: {
          p_observacao?: string
          p_resultado: string
          p_visita_id: string
        }
        Returns: Json
      }
      visita_registrar_retorno: {
        Args: { p_dados: Json; p_visita_id: string }
        Returns: Json
      }
      visita_resposta_corretor: {
        Args: { p_aceitou: boolean; p_observacao?: string; p_visita_id: string }
        Returns: Json
      }
      visita_tentativa_remarcar: {
        Args: { p_observacao?: string; p_visita_id: string }
        Returns: Json
      }
      vma_reivindicar: { Args: { p_limite?: number }; Returns: Json }
      vma_resultado: {
        Args: { p_erro?: string; p_id: string; p_wa_id: string }
        Returns: undefined
      }
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
      app_role: "admin" | "corretor" | "cliente" | "sdr" | "closer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "corretor", "cliente", "sdr", "closer"],
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

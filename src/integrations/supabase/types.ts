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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      archive_reasons: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          organization_id: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          organization_id: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          organization_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "archive_reasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action_funnel_id: string
          action_stage_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          trigger_funnel_id: string
          trigger_stage_id: string
          updated_at: string
        }
        Insert: {
          action_funnel_id: string
          action_stage_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          trigger_funnel_id: string
          trigger_stage_id: string
          updated_at?: string
        }
        Update: {
          action_funnel_id?: string
          action_stage_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          trigger_funnel_id?: string
          trigger_stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_action_funnel_id_fkey"
            columns: ["action_funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_action_stage_id_fkey"
            columns: ["action_stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_trigger_funnel_id_fkey"
            columns: ["trigger_funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_trigger_stage_id_fkey"
            columns: ["trigger_stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          instagram: string | null
          legal_name: string | null
          match_key: string | null
          organization_id: string
          segment: string | null
          trade_name: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          legal_name?: string | null
          match_key?: string | null
          organization_id: string
          segment?: string | null
          trade_name: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          legal_name?: string | null
          match_key?: string | null
          organization_id?: string
          segment?: string | null
          trade_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          lead_id: string | null
          name: string
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          field_label: string
          field_name: string
          field_type: string
          id: string
          is_active: boolean
          is_required: boolean
          options: Json | null
          organization_id: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_label: string
          field_name: string
          field_type: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          options?: Json | null
          organization_id: string
          position: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_label?: string
          field_name?: string
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          options?: Json | null
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          created_at: string
          field_definition_id: string
          id: string
          lead_id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          field_definition_id: string
          id?: string
          lead_id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          field_definition_id?: string
          id?: string
          lead_id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lead"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_webhook_logs: {
        Row: {
          action: string
          changes_applied: Json | null
          created_at: string
          error_message: string | null
          id: string
          inbound_webhook_id: string
          ip_address: string | null
          lead_id: string | null
          mapped_data: Json | null
          organization_id: string
          raw_payload: Json
        }
        Insert: {
          action: string
          changes_applied?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          inbound_webhook_id: string
          ip_address?: string | null
          lead_id?: string | null
          mapped_data?: Json | null
          organization_id: string
          raw_payload: Json
        }
        Update: {
          action?: string
          changes_applied?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          inbound_webhook_id?: string
          ip_address?: string | null
          lead_id?: string | null
          mapped_data?: Json | null
          organization_id?: string
          raw_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "inbound_webhook_logs_inbound_webhook_id_fkey"
            columns: ["inbound_webhook_id"]
            isOneToOne: false
            referencedRelation: "inbound_webhooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_webhook_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_webhooks: {
        Row: {
          api_key: string
          created_at: string
          default_assigned_to: string | null
          default_source: string
          default_tags: string[]
          duplicate_strategy: string
          field_mapping: Json
          funnel_id: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          target_stage: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          default_assigned_to?: string | null
          default_source?: string
          default_tags?: string[]
          duplicate_strategy?: string
          field_mapping?: Json
          funnel_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          target_stage?: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          default_assigned_to?: string | null
          default_source?: string
          default_tags?: string[]
          duplicate_strategy?: string
          field_mapping?: Json
          funnel_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          target_stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_webhooks_default_assigned_to_fkey"
            columns: ["default_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_webhooks_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          lead_id: string
          metadata: Json | null
          organization_id: string
          title: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          organization_id: string
          title: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          organization_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_primary: boolean
          lead_id: string
          organization_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          lead_id: string
          organization_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          lead_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archive_details: string | null
          archive_reason_id: string | null
          archived_at: string | null
          assigned_to: string | null
          company: string | null
          company_id: string | null
          company_instagram: string | null
          company_name: string | null
          created_at: string
          email: string | null
          funnel_id: string
          id: string
          last_activity_at: string
          merged_at: string | null
          merged_into_lead_id: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          priority: string
          qualification: number | null
          source: string | null
          stage_entered_at: string
          stage_id: string
          status: string
          tags: string[]
          updated_at: string
          value: number
        }
        Insert: {
          archive_details?: string | null
          archive_reason_id?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          company?: string | null
          company_id?: string | null
          company_instagram?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          funnel_id: string
          id?: string
          last_activity_at?: string
          merged_at?: string | null
          merged_into_lead_id?: string | null
          name?: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          priority?: string
          qualification?: number | null
          source?: string | null
          stage_entered_at?: string
          stage_id: string
          status?: string
          tags?: string[]
          updated_at?: string
          value?: number
        }
        Update: {
          archive_details?: string | null
          archive_reason_id?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          company?: string | null
          company_id?: string | null
          company_instagram?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          funnel_id?: string
          id?: string
          last_activity_at?: string
          merged_at?: string | null
          merged_into_lead_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          priority?: string
          qualification?: number | null
          source?: string | null
          stage_entered_at?: string
          stage_id?: string
          status?: string
          tags?: string[]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_archive_reason_id_fkey"
            columns: ["archive_reason_id"]
            isOneToOne: false
            referencedRelation: "archive_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_merged_into_lead_id_fkey"
            columns: ["merged_into_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invite_logs: {
        Row: {
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          invite_id: string | null
          invite_token_preview: string | null
          metadata: Json
          organization_id: string
          role: Database["public"]["Enums"]["org_role"] | null
        }
        Insert: {
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          invite_id?: string | null
          invite_token_preview?: string | null
          metadata?: Json
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"] | null
        }
        Update: {
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          invite_id?: string | null
          invite_token_preview?: string | null
          metadata?: Json
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"] | null
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number | null
          organization_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["org_role"]
          token: string
          uses_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          organization_id: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["org_role"]
          token: string
          uses_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          organization_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
          uses_count?: number
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string | null
          invited_email: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_email?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_email?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_filters: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_shared: boolean
          name: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters: Json
          id?: string
          is_shared?: boolean
          name: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_shared?: boolean
          name?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_filters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_filters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_task_templates: {
        Row: {
          action_type: string
          assign_to_lead_owner: boolean
          created_at: string
          description: string | null
          due_hours: number
          id: string
          is_active: boolean
          organization_id: string
          priority: string
          stage_id: string | null
          target_funnel_id: string | null
          target_stage_id: string | null
          task_type: string
          title: string
          trigger_status: string | null
          trigger_type: string
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          action_type?: string
          assign_to_lead_owner?: boolean
          created_at?: string
          description?: string | null
          due_hours?: number
          id?: string
          is_active?: boolean
          organization_id: string
          priority?: string
          stage_id?: string | null
          target_funnel_id?: string | null
          target_stage_id?: string | null
          task_type?: string
          title: string
          trigger_status?: string | null
          trigger_type?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          action_type?: string
          assign_to_lead_owner?: boolean
          created_at?: string
          description?: string | null
          due_hours?: number
          id?: string
          is_active?: boolean
          organization_id?: string
          priority?: string
          stage_id?: string | null
          target_funnel_id?: string | null
          target_stage_id?: string | null
          task_type?: string
          title?: string
          trigger_status?: string | null
          trigger_type?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stage_task_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_task_templates_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_task_templates_target_funnel_id_fkey"
            columns: ["target_funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_task_templates_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          color: string
          created_at: string
          funnel_id: string
          id: string
          name: string
          organization_id: string
          position: number
          sla_hours: number | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          funnel_id: string
          id?: string
          name: string
          organization_id: string
          position: number
          sla_hours?: number | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          funnel_id?: string
          id?: string
          name?: string
          organization_id?: string
          position?: number
          sla_hours?: number | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string
          id: string
          lead_id: string
          organization_id: string
          priority: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          lead_id: string
          organization_id: string
          priority?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          lead_id?: string
          organization_id?: string
          priority?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          attempt_number: number
          created_at: string
          error_message: string | null
          id: string
          lead_id: string | null
          organization_id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          stage_id: string
          success: boolean
          webhook_url: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          organization_id: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          stage_id: string
          success: boolean
          webhook_url: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          stage_id?: string
          success?: boolean
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: Json }
      add_archive_reason: {
        Args: { p_label: string; p_org_id: string }
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          organization_id: string
          position: number
        }
        SetofOptions: {
          from: "*"
          to: "archive_reasons"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_custom_field_option: {
        Args: { p_field_id: string; p_option: string }
        Returns: string[]
      }
      company_match_key: {
        Args: { p_company: string; p_company_name: string }
        Returns: string
      }
      company_segment_from_value: {
        Args: { p_org: string; p_value: string }
        Returns: string
      }
      create_funnel_with_default_stages: {
        Args: { p_description?: string; p_name: string; p_org_id: string }
        Returns: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "funnels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_organization_with_owner: {
        Args: { p_name: string; p_slug: string }
        Returns: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_company_contact: {
        Args: {
          p_company: string
          p_email: string
          p_exclude?: string
          p_name: string
          p_phone: string
        }
        Returns: string
      }
      get_archive_reasons_summary: {
        Args: {
          p_assigned_to?: string[]
          p_date_from: string
          p_date_to: string
          p_funnel_id: string
          p_org_id: string
        }
        Returns: {
          archive_reason_id: string
          count: number
          label: string
        }[]
      }
      get_dashboard_summary: {
        Args: {
          p_date_from: string
          p_date_to: string
          p_funnel_id: string
          p_org_id: string
        }
        Returns: Json
      }
      get_funnel_metrics:
        | {
            Args: { p_funnel_id: string; p_org_id: string }
            Returns: {
              lead_count: number
              stage_color: string
              stage_id: string
              stage_name: string
              stage_position: number
              total_value: number
            }[]
          }
        | {
            Args: {
              p_date_from?: string
              p_date_to?: string
              p_funnel_id: string
              p_org_id: string
            }
            Returns: {
              lead_count: number
              stage_color: string
              stage_id: string
              stage_name: string
              stage_position: number
              total_value: number
            }[]
          }
      get_invite_by_token: { Args: { p_token: string }; Returns: Json }
      get_leads_by_period: {
        Args: {
          p_date_from: string
          p_date_to: string
          p_funnel_id: string
          p_interval: string
          p_org_id: string
        }
        Returns: {
          lead_count: number
          period_start: string
        }[]
      }
      get_team_ranking: {
        Args: {
          p_date_from: string
          p_date_to: string
          p_funnel_id: string
          p_org_id: string
        }
        Returns: {
          avatar_url: string
          converted_count: number
          full_name: string
          leads_count: number
          total_value: number
          user_id: string
        }[]
      }
      get_user_org_ids: { Args: never; Returns: string[] }
      get_user_org_role: { Args: { org_id: string }; Returns: string }
      is_blank_company_value: { Args: { p_value: string }; Returns: boolean }
      lead_company_key: {
        Args: { p_company: string; p_company_name: string; p_org: string }
        Returns: string
      }
      log_invite_event: {
        Args: {
          p_event: string
          p_invite_id: string
          p_metadata?: Json
          p_org_id: string
          p_role: Database["public"]["Enums"]["org_role"]
          p_token: string
        }
        Returns: undefined
      }
      merge_companies: {
        Args: { p_source: string; p_target: string }
        Returns: Json
      }
      merge_leads: {
        Args: { p_duplicate_ids: string[]; p_primary_id: string }
        Returns: Json
      }
      normalize_company_key: { Args: { p: string }; Returns: string }
      record_invite_event: {
        Args: { p_event: string; p_invite_id: string; p_metadata?: Json }
        Returns: undefined
      }
      reorder_custom_fields: { Args: { p_fields: Json }; Returns: undefined }
      reorder_stages: { Args: { p_stages: Json }; Returns: undefined }
      resolve_company: {
        Args: {
          p_company: string
          p_company_name: string
          p_instagram: string
          p_lead_name: string
          p_org: string
        }
        Returns: string
      }
      search_leads: {
        Args: { p_org: string; p_term: string }
        Returns: {
          archive_details: string | null
          archive_reason_id: string | null
          archived_at: string | null
          assigned_to: string | null
          company: string | null
          company_id: string | null
          company_instagram: string | null
          company_name: string | null
          created_at: string
          email: string | null
          funnel_id: string
          id: string
          last_activity_at: string
          merged_at: string | null
          merged_into_lead_id: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          priority: string
          qualification: number | null
          source: string | null
          stage_entered_at: string
          stage_id: string
          status: string
          tags: string[]
          updated_at: string
          value: number
        }[]
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      org_role: "owner" | "admin" | "member" | "viewer"
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
      org_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const

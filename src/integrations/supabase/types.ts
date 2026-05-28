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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_compliance: {
        Row: {
          account_route: string
          account_type: string
          age_band_declaration: string
          ai_disclaimer_accepted_at: string
          ai_disclaimer_version: string
          created_at: string
          marketing_consent: boolean
          marketing_consent_at: string | null
          parent_guardian_attested: boolean
          parent_guardian_attested_at: string | null
          parent_managed: boolean
          privacy_accepted_at: string
          privacy_version: string
          terms_accepted_at: string
          terms_version: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_route: string
          account_type: string
          age_band_declaration: string
          ai_disclaimer_accepted_at: string
          ai_disclaimer_version: string
          created_at?: string
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          parent_guardian_attested?: boolean
          parent_guardian_attested_at?: string | null
          parent_managed?: boolean
          privacy_accepted_at: string
          privacy_version: string
          terms_accepted_at: string
          terms_version: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_route?: string
          account_type?: string
          age_band_declaration?: string
          ai_disclaimer_accepted_at?: string
          ai_disclaimer_version?: string
          created_at?: string
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          parent_guardian_attested?: boolean
          parent_guardian_attested_at?: string | null
          parent_managed?: boolean
          privacy_accepted_at?: string
          privacy_version?: string
          terms_accepted_at?: string
          terms_version?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          daily_submission_cap: number
          future_evidence_enabled: boolean
          future_qa_trace_enabled: boolean
          future_report_enabled: boolean
          id: string
          max_takes_per_audition: number
          quota_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          daily_submission_cap?: number
          future_evidence_enabled?: boolean
          future_qa_trace_enabled?: boolean
          future_report_enabled?: boolean
          id?: string
          max_takes_per_audition?: number
          quota_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          daily_submission_cap?: number
          future_evidence_enabled?: boolean
          future_qa_trace_enabled?: boolean
          future_report_enabled?: boolean
          id?: string
          max_takes_per_audition?: number
          quota_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      auditions: {
        Row: {
          anon_id: string | null
          audition_level: string
          brief: string | null
          brief_source: string
          created_at: string
          extracted_brief: Json | null
          id: string
          mode: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          anon_id?: string | null
          audition_level?: string
          brief?: string | null
          brief_source?: string
          created_at?: string
          extracted_brief?: Json | null
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          anon_id?: string | null
          audition_level?: string
          brief?: string | null
          brief_source?: string
          created_at?: string
          extracted_brief?: Json | null
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      consumer_credit_products: {
        Row: {
          active: boolean
          created_at: string
          credit_amount: number
          currency: string
          description: string
          display_context: string
          display_order: number
          founding_price: boolean
          id: string
          name: string
          sku: string
          stripe_price_id: string | null
          unit_amount_pence: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          credit_amount: number
          currency?: string
          description?: string
          display_context?: string
          display_order?: number
          founding_price?: boolean
          id?: string
          name: string
          sku: string
          stripe_price_id?: string | null
          unit_amount_pence: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          credit_amount?: number
          currency?: string
          description?: string
          display_context?: string
          display_order?: number
          founding_price?: boolean
          id?: string
          name?: string
          sku?: string
          stripe_price_id?: string | null
          unit_amount_pence?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_grants: {
        Row: {
          admin_reason: string | null
          created_at: string
          expires_at: string | null
          granted_at: string
          granted_by_user_id: string | null
          id: string
          metadata: Json
          original_credits: number
          remaining_credits: number
          rollover_policy: Database["public"]["Enums"]["credit_rollover_policy"]
          source: Database["public"]["Enums"]["credit_source"]
          source_label: string | null
          source_reference_id: string | null
          source_reference_type: string | null
          status: Database["public"]["Enums"]["credit_grant_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reason?: string | null
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by_user_id?: string | null
          id?: string
          metadata?: Json
          original_credits: number
          remaining_credits: number
          rollover_policy: Database["public"]["Enums"]["credit_rollover_policy"]
          source: Database["public"]["Enums"]["credit_source"]
          source_label?: string | null
          source_reference_id?: string | null
          source_reference_type?: string | null
          status?: Database["public"]["Enums"]["credit_grant_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reason?: string | null
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by_user_id?: string | null
          id?: string
          metadata?: Json
          original_credits?: number
          remaining_credits?: number
          rollover_policy?: Database["public"]["Enums"]["credit_rollover_policy"]
          source?: Database["public"]["Enums"]["credit_source"]
          source_label?: string | null
          source_reference_id?: string | null
          source_reference_type?: string | null
          status?: Database["public"]["Enums"]["credit_grant_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_ledger_entries: {
        Row: {
          admin_actor_user_id: string | null
          admin_reason: string | null
          audition_id: string | null
          created_at: string
          credit_delta: number
          credit_grant_id: string | null
          entry_type: Database["public"]["Enums"]["credit_ledger_entry_type"]
          id: string
          idempotency_key: string | null
          metadata: Json
          report_generated_at: string | null
          source: Database["public"]["Enums"]["credit_source"]
          source_reference_id: string | null
          source_reference_type: string | null
          take_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_actor_user_id?: string | null
          admin_reason?: string | null
          audition_id?: string | null
          created_at?: string
          credit_delta: number
          credit_grant_id?: string | null
          entry_type: Database["public"]["Enums"]["credit_ledger_entry_type"]
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          report_generated_at?: string | null
          source: Database["public"]["Enums"]["credit_source"]
          source_reference_id?: string | null
          source_reference_type?: string | null
          take_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_actor_user_id?: string | null
          admin_reason?: string | null
          audition_id?: string | null
          created_at?: string
          credit_delta?: number
          credit_grant_id?: string | null
          entry_type?: Database["public"]["Enums"]["credit_ledger_entry_type"]
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          report_generated_at?: string | null
          source?: Database["public"]["Enums"]["credit_source"]
          source_reference_id?: string | null
          source_reference_type?: string | null
          take_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_entries_audition_id_fkey"
            columns: ["audition_id"]
            isOneToOne: false
            referencedRelation: "auditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_entries_credit_grant_id_fkey"
            columns: ["credit_grant_id"]
            isOneToOne: false
            referencedRelation: "credit_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_entries_take_id_fkey"
            columns: ["take_id"]
            isOneToOne: false
            referencedRelation: "takes"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      partner_codes: {
        Row: {
          abuse_flag_reason: string | null
          abuse_flagged_at: string | null
          abuse_flagged_by_user_id: string | null
          activation_count: number
          allowance_credits: number
          allowed_email_domains: string[]
          code_display_hint: string
          code_hash: string
          created_at: string
          created_by_user_id: string | null
          expires_at: string | null
          id: string
          idempotency_key: string | null
          max_activations: number | null
          metadata: Json
          partner_credit_pool_id: string | null
          partner_id: string
          revoked_at: string | null
          revoked_by_user_id: string | null
          revoked_reason: string | null
          rotated_from_code_id: string | null
          rotated_to_code_id: string | null
          status: Database["public"]["Enums"]["partner_code_status"]
          updated_at: string
          valid_from: string
          version: number
        }
        Insert: {
          abuse_flag_reason?: string | null
          abuse_flagged_at?: string | null
          abuse_flagged_by_user_id?: string | null
          activation_count?: number
          allowance_credits: number
          allowed_email_domains?: string[]
          code_display_hint: string
          code_hash: string
          created_at?: string
          created_by_user_id?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          max_activations?: number | null
          metadata?: Json
          partner_credit_pool_id?: string | null
          partner_id: string
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          revoked_reason?: string | null
          rotated_from_code_id?: string | null
          rotated_to_code_id?: string | null
          status?: Database["public"]["Enums"]["partner_code_status"]
          updated_at?: string
          valid_from?: string
          version: number
        }
        Update: {
          abuse_flag_reason?: string | null
          abuse_flagged_at?: string | null
          abuse_flagged_by_user_id?: string | null
          activation_count?: number
          allowance_credits?: number
          allowed_email_domains?: string[]
          code_display_hint?: string
          code_hash?: string
          created_at?: string
          created_by_user_id?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          max_activations?: number | null
          metadata?: Json
          partner_credit_pool_id?: string | null
          partner_id?: string
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          revoked_reason?: string | null
          rotated_from_code_id?: string | null
          rotated_to_code_id?: string | null
          status?: Database["public"]["Enums"]["partner_code_status"]
          updated_at?: string
          valid_from?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_codes_partner_credit_pool_id_fkey"
            columns: ["partner_credit_pool_id"]
            isOneToOne: false
            referencedRelation: "partner_credit_pool_usage_summary"
            referencedColumns: ["partner_credit_pool_id"]
          },
          {
            foreignKeyName: "partner_codes_partner_credit_pool_id_fkey"
            columns: ["partner_credit_pool_id"]
            isOneToOne: false
            referencedRelation: "partner_credit_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_codes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_aggregate_dashboard_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "partner_codes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_codes_rotated_from_code_id_fkey"
            columns: ["rotated_from_code_id"]
            isOneToOne: false
            referencedRelation: "partner_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_codes_rotated_to_code_id_fkey"
            columns: ["rotated_to_code_id"]
            isOneToOne: false
            referencedRelation: "partner_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_credit_allocations: {
        Row: {
          allocated_at: string
          cap_override: boolean
          cap_override_reason: string | null
          created_at: string
          created_by_user_id: string | null
          credit_amount: number
          credit_grant_id: string | null
          id: string
          metadata: Json
          partner_credit_pool_id: string
          partner_id: string
          partner_membership_id: string | null
          source: Database["public"]["Enums"]["partner_credit_allocation_source"]
          updated_at: string
          user_id: string
        }
        Insert: {
          allocated_at?: string
          cap_override?: boolean
          cap_override_reason?: string | null
          created_at?: string
          created_by_user_id?: string | null
          credit_amount: number
          credit_grant_id?: string | null
          id?: string
          metadata?: Json
          partner_credit_pool_id: string
          partner_id: string
          partner_membership_id?: string | null
          source: Database["public"]["Enums"]["partner_credit_allocation_source"]
          updated_at?: string
          user_id: string
        }
        Update: {
          allocated_at?: string
          cap_override?: boolean
          cap_override_reason?: string | null
          created_at?: string
          created_by_user_id?: string | null
          credit_amount?: number
          credit_grant_id?: string | null
          id?: string
          metadata?: Json
          partner_credit_pool_id?: string
          partner_id?: string
          partner_membership_id?: string | null
          source?: Database["public"]["Enums"]["partner_credit_allocation_source"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_credit_allocations_credit_grant_id_fkey"
            columns: ["credit_grant_id"]
            isOneToOne: false
            referencedRelation: "credit_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_credit_allocations_partner_credit_pool_id_fkey"
            columns: ["partner_credit_pool_id"]
            isOneToOne: false
            referencedRelation: "partner_credit_pool_usage_summary"
            referencedColumns: ["partner_credit_pool_id"]
          },
          {
            foreignKeyName: "partner_credit_allocations_partner_credit_pool_id_fkey"
            columns: ["partner_credit_pool_id"]
            isOneToOne: false
            referencedRelation: "partner_credit_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_credit_allocations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_aggregate_dashboard_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "partner_credit_allocations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_credit_allocations_partner_membership_id_fkey"
            columns: ["partner_membership_id"]
            isOneToOne: false
            referencedRelation: "partner_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_credit_pool_events: {
        Row: {
          admin_actor_user_id: string | null
          created_at: string
          credit_delta: number
          event_type: Database["public"]["Enums"]["partner_credit_pool_event_type"]
          id: string
          idempotency_key: string | null
          metadata: Json
          partner_credit_pool_id: string
          partner_id: string
          reason: string | null
          related_alert_id: string | null
          related_allocation_id: string | null
          updated_at: string
        }
        Insert: {
          admin_actor_user_id?: string | null
          created_at?: string
          credit_delta?: number
          event_type: Database["public"]["Enums"]["partner_credit_pool_event_type"]
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          partner_credit_pool_id: string
          partner_id: string
          reason?: string | null
          related_alert_id?: string | null
          related_allocation_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_actor_user_id?: string | null
          created_at?: string
          credit_delta?: number
          event_type?: Database["public"]["Enums"]["partner_credit_pool_event_type"]
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          partner_credit_pool_id?: string
          partner_id?: string
          reason?: string | null
          related_alert_id?: string | null
          related_allocation_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_credit_pool_events_partner_credit_pool_id_fkey"
            columns: ["partner_credit_pool_id"]
            isOneToOne: false
            referencedRelation: "partner_credit_pool_usage_summary"
            referencedColumns: ["partner_credit_pool_id"]
          },
          {
            foreignKeyName: "partner_credit_pool_events_partner_credit_pool_id_fkey"
            columns: ["partner_credit_pool_id"]
            isOneToOne: false
            referencedRelation: "partner_credit_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_credit_pool_events_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_aggregate_dashboard_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "partner_credit_pool_events_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_credit_pool_events_related_alert_id_fkey"
            columns: ["related_alert_id"]
            isOneToOne: false
            referencedRelation: "partner_usage_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_credit_pool_events_related_allocation_id_fkey"
            columns: ["related_allocation_id"]
            isOneToOne: false
            referencedRelation: "partner_credit_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_credit_pools: {
        Row: {
          allocated_credits: number
          consumed_credits: number
          created_at: string
          created_by_user_id: string | null
          currency: string
          id: string
          metadata: Json
          name: string
          overage_allowed: boolean
          overage_price_pence: number | null
          partner_id: string
          per_user_cap: number
          period_end: string
          period_start: string
          period_type: Database["public"]["Enums"]["partner_credit_pool_period_type"]
          status: Database["public"]["Enums"]["partner_credit_pool_status"]
          total_credits: number
          updated_at: string
        }
        Insert: {
          allocated_credits?: number
          consumed_credits?: number
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          id?: string
          metadata?: Json
          name: string
          overage_allowed?: boolean
          overage_price_pence?: number | null
          partner_id: string
          per_user_cap: number
          period_end: string
          period_start: string
          period_type: Database["public"]["Enums"]["partner_credit_pool_period_type"]
          status?: Database["public"]["Enums"]["partner_credit_pool_status"]
          total_credits: number
          updated_at?: string
        }
        Update: {
          allocated_credits?: number
          consumed_credits?: number
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          id?: string
          metadata?: Json
          name?: string
          overage_allowed?: boolean
          overage_price_pence?: number | null
          partner_id?: string
          per_user_cap?: number
          period_end?: string
          period_start?: string
          period_type?: Database["public"]["Enums"]["partner_credit_pool_period_type"]
          status?: Database["public"]["Enums"]["partner_credit_pool_status"]
          total_credits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_credit_pools_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_aggregate_dashboard_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "partner_credit_pools_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_memberships: {
        Row: {
          activated_at: string
          activation_idempotency_key: string | null
          allowance_credits: number
          code_version: number
          created_at: string
          credit_grant_id: string | null
          credit_source: Database["public"]["Enums"]["credit_source"]
          email_domain: string | null
          expires_at: string | null
          id: string
          metadata: Json
          partner_code_id: string
          partner_credit_pool_id: string | null
          partner_id: string
          partner_type: Database["public"]["Enums"]["partner_type"]
          status: Database["public"]["Enums"]["partner_membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string
          activation_idempotency_key?: string | null
          allowance_credits: number
          code_version: number
          created_at?: string
          credit_grant_id?: string | null
          credit_source: Database["public"]["Enums"]["credit_source"]
          email_domain?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          partner_code_id: string
          partner_credit_pool_id?: string | null
          partner_id: string
          partner_type: Database["public"]["Enums"]["partner_type"]
          status?: Database["public"]["Enums"]["partner_membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string
          activation_idempotency_key?: string | null
          allowance_credits?: number
          code_version?: number
          created_at?: string
          credit_grant_id?: string | null
          credit_source?: Database["public"]["Enums"]["credit_source"]
          email_domain?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          partner_code_id?: string
          partner_credit_pool_id?: string | null
          partner_id?: string
          partner_type?: Database["public"]["Enums"]["partner_type"]
          status?: Database["public"]["Enums"]["partner_membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_memberships_credit_grant_id_fkey"
            columns: ["credit_grant_id"]
            isOneToOne: false
            referencedRelation: "credit_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_memberships_partner_code_id_fkey"
            columns: ["partner_code_id"]
            isOneToOne: false
            referencedRelation: "partner_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_memberships_partner_credit_pool_id_fkey"
            columns: ["partner_credit_pool_id"]
            isOneToOne: false
            referencedRelation: "partner_credit_pool_usage_summary"
            referencedColumns: ["partner_credit_pool_id"]
          },
          {
            foreignKeyName: "partner_memberships_partner_credit_pool_id_fkey"
            columns: ["partner_credit_pool_id"]
            isOneToOne: false
            referencedRelation: "partner_credit_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_memberships_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_aggregate_dashboard_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "partner_memberships_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_usage_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by_user_id: string | null
          allocated_credits: number
          created_at: string
          id: string
          metadata: Json
          partner_credit_pool_id: string
          partner_id: string
          status: Database["public"]["Enums"]["partner_usage_alert_status"]
          threshold_percent: number
          total_credits: number
          triggered_at: string
          updated_at: string
          usage_percent: number
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          allocated_credits: number
          created_at?: string
          id?: string
          metadata?: Json
          partner_credit_pool_id: string
          partner_id: string
          status?: Database["public"]["Enums"]["partner_usage_alert_status"]
          threshold_percent: number
          total_credits: number
          triggered_at?: string
          updated_at?: string
          usage_percent: number
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          allocated_credits?: number
          created_at?: string
          id?: string
          metadata?: Json
          partner_credit_pool_id?: string
          partner_id?: string
          status?: Database["public"]["Enums"]["partner_usage_alert_status"]
          threshold_percent?: number
          total_credits?: number
          triggered_at?: string
          updated_at?: string
          usage_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_usage_alerts_partner_credit_pool_id_fkey"
            columns: ["partner_credit_pool_id"]
            isOneToOne: false
            referencedRelation: "partner_credit_pool_usage_summary"
            referencedColumns: ["partner_credit_pool_id"]
          },
          {
            foreignKeyName: "partner_usage_alerts_partner_credit_pool_id_fkey"
            columns: ["partner_credit_pool_id"]
            isOneToOne: false
            referencedRelation: "partner_credit_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_usage_alerts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_aggregate_dashboard_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "partner_usage_alerts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_visibility_acceptances: {
        Row: {
          accepted_at: string
          brief_sharing_enabled: boolean
          created_at: string
          full_report_sharing_enabled: boolean
          id: string
          idempotency_key: string | null
          leaderboard_enabled: boolean
          metadata: Json
          parent_guardian_confirmed: boolean
          partner_id: string
          partner_membership_id: string
          partner_type: Database["public"]["Enums"]["partner_type"]
          policy_version: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by_user_id: string | null
          status: Database["public"]["Enums"]["partner_visibility_acceptance_status"]
          updated_at: string
          uploaded_media_sharing_enabled: boolean
          user_id: string
          visibility_scope: Database["public"]["Enums"]["partner_visibility_scope"]
        }
        Insert: {
          accepted_at?: string
          brief_sharing_enabled?: boolean
          created_at?: string
          full_report_sharing_enabled?: boolean
          id?: string
          idempotency_key?: string | null
          leaderboard_enabled?: boolean
          metadata?: Json
          parent_guardian_confirmed?: boolean
          partner_id: string
          partner_membership_id: string
          partner_type: Database["public"]["Enums"]["partner_type"]
          policy_version: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          status?: Database["public"]["Enums"]["partner_visibility_acceptance_status"]
          updated_at?: string
          uploaded_media_sharing_enabled?: boolean
          user_id: string
          visibility_scope: Database["public"]["Enums"]["partner_visibility_scope"]
        }
        Update: {
          accepted_at?: string
          brief_sharing_enabled?: boolean
          created_at?: string
          full_report_sharing_enabled?: boolean
          id?: string
          idempotency_key?: string | null
          leaderboard_enabled?: boolean
          metadata?: Json
          parent_guardian_confirmed?: boolean
          partner_id?: string
          partner_membership_id?: string
          partner_type?: Database["public"]["Enums"]["partner_type"]
          policy_version?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          status?: Database["public"]["Enums"]["partner_visibility_acceptance_status"]
          updated_at?: string
          uploaded_media_sharing_enabled?: boolean
          user_id?: string
          visibility_scope?: Database["public"]["Enums"]["partner_visibility_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "partner_visibility_acceptances_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_aggregate_dashboard_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "partner_visibility_acceptances_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_visibility_acceptances_partner_membership_id_fkey"
            columns: ["partner_membership_id"]
            isOneToOne: false
            referencedRelation: "partner_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          allowed_email_domains: string[]
          created_at: string
          created_by_user_id: string | null
          id: string
          metadata: Json
          name: string
          primary_contact_email: string | null
          slug: string
          status: Database["public"]["Enums"]["partner_status"]
          type: Database["public"]["Enums"]["partner_type"]
          updated_at: string
        }
        Insert: {
          allowed_email_domains?: string[]
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          metadata?: Json
          name: string
          primary_contact_email?: string | null
          slug: string
          status?: Database["public"]["Enums"]["partner_status"]
          type: Database["public"]["Enums"]["partner_type"]
          updated_at?: string
        }
        Update: {
          allowed_email_domains?: string[]
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          metadata?: Json
          name?: string
          primary_contact_email?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["partner_status"]
          type?: Database["public"]["Enums"]["partner_type"]
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      take_qa_traces: {
        Row: {
          branch: string | null
          components_summary: Json | null
          created_at: string
          dimensions_summary: Json | null
          schema_version: string | null
          scrub_counters: Json | null
          shadow_divergence: Json | null
          sufficiency: Json | null
          take_id: string
          updated_at: string
        }
        Insert: {
          branch?: string | null
          components_summary?: Json | null
          created_at?: string
          dimensions_summary?: Json | null
          schema_version?: string | null
          scrub_counters?: Json | null
          shadow_divergence?: Json | null
          sufficiency?: Json | null
          take_id: string
          updated_at?: string
        }
        Update: {
          branch?: string | null
          components_summary?: Json | null
          created_at?: string
          dimensions_summary?: Json | null
          schema_version?: string | null
          scrub_counters?: Json | null
          shadow_divergence?: Json | null
          sufficiency?: Json | null
          take_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "take_qa_traces_take_id_fkey"
            columns: ["take_id"]
            isOneToOne: true
            referencedRelation: "takes"
            referencedColumns: ["id"]
          },
        ]
      }
      takes: {
        Row: {
          analysis_tier: string | null
          anon_id: string | null
          attempt_count: number
          audition_id: string
          checklist: Json | null
          compliance_flags: Json | null
          confidence: number | null
          created_at: string
          credit_consumption_ledger_entry_id: string | null
          error_message: string | null
          id: string
          mux_asset_id: string | null
          mux_duration_seconds: number | null
          mux_mp4_high_url: string | null
          mux_mp4_standard_url: string | null
          mux_playback_id: string | null
          mux_status: string
          mux_upload_id: string | null
          overall_score: number | null
          processing_phase: string
          report: Json | null
          score_breakdown: Json | null
          scores: Json | null
          signals: Json | null
          status: string
          take_number: number
          updated_at: string
          user_id: string | null
          video_path: string | null
        }
        Insert: {
          analysis_tier?: string | null
          anon_id?: string | null
          attempt_count?: number
          audition_id: string
          checklist?: Json | null
          compliance_flags?: Json | null
          confidence?: number | null
          created_at?: string
          credit_consumption_ledger_entry_id?: string | null
          error_message?: string | null
          id?: string
          mux_asset_id?: string | null
          mux_duration_seconds?: number | null
          mux_mp4_high_url?: string | null
          mux_mp4_standard_url?: string | null
          mux_playback_id?: string | null
          mux_status?: string
          mux_upload_id?: string | null
          overall_score?: number | null
          processing_phase?: string
          report?: Json | null
          score_breakdown?: Json | null
          scores?: Json | null
          signals?: Json | null
          status?: string
          take_number?: number
          updated_at?: string
          user_id?: string | null
          video_path?: string | null
        }
        Update: {
          analysis_tier?: string | null
          anon_id?: string | null
          attempt_count?: number
          audition_id?: string
          checklist?: Json | null
          compliance_flags?: Json | null
          confidence?: number | null
          created_at?: string
          credit_consumption_ledger_entry_id?: string | null
          error_message?: string | null
          id?: string
          mux_asset_id?: string | null
          mux_duration_seconds?: number | null
          mux_mp4_high_url?: string | null
          mux_mp4_standard_url?: string | null
          mux_playback_id?: string | null
          mux_status?: string
          mux_upload_id?: string | null
          overall_score?: number | null
          processing_phase?: string
          report?: Json | null
          score_breakdown?: Json | null
          scores?: Json | null
          signals?: Json | null
          status?: string
          take_number?: number
          updated_at?: string
          user_id?: string | null
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "takes_audition_id_fkey"
            columns: ["audition_id"]
            isOneToOne: false
            referencedRelation: "auditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takes_credit_consumption_ledger_entry_id_fkey"
            columns: ["credit_consumption_ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "credit_ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      credit_source_finance_summary: {
        Row: {
          admin_adjustment_credits: number | null
          consumed_credits: number | null
          entry_count: number | null
          expired_credits: number | null
          first_entry_at: string | null
          granted_credits: number | null
          latest_entry_at: string | null
          net_credits: number | null
          source: Database["public"]["Enums"]["credit_source"] | null
        }
        Relationships: []
      }
      partner_aggregate_dashboard_summary: {
        Row: {
          active_member_count: number | null
          average_latest_score: number | null
          credits_used: number | null
          latest_report_at: string | null
          partner_id: string | null
          partner_name: string | null
          partner_type: Database["public"]["Enums"]["partner_type"] | null
          report_count: number | null
        }
        Relationships: []
      }
      partner_credit_pool_usage_summary: {
        Row: {
          allocated_credits: number | null
          allocated_usage_percent: number | null
          consumed_credits: number | null
          name: string | null
          overage_allowed: boolean | null
          partner_credit_pool_id: string | null
          partner_id: string | null
          per_user_cap: number | null
          period_end: string | null
          period_start: string | null
          period_type:
            | Database["public"]["Enums"]["partner_credit_pool_period_type"]
            | null
          remaining_credits: number | null
          status:
            | Database["public"]["Enums"]["partner_credit_pool_status"]
            | null
          total_credits: number | null
        }
        Insert: {
          allocated_credits?: number | null
          allocated_usage_percent?: never
          consumed_credits?: number | null
          name?: string | null
          overage_allowed?: boolean | null
          partner_credit_pool_id?: string | null
          partner_id?: string | null
          per_user_cap?: number | null
          period_end?: string | null
          period_start?: string | null
          period_type?:
            | Database["public"]["Enums"]["partner_credit_pool_period_type"]
            | null
          remaining_credits?: never
          status?:
            | Database["public"]["Enums"]["partner_credit_pool_status"]
            | null
          total_credits?: number | null
        }
        Update: {
          allocated_credits?: number | null
          allocated_usage_percent?: never
          consumed_credits?: number | null
          name?: string | null
          overage_allowed?: boolean | null
          partner_credit_pool_id?: string | null
          partner_id?: string | null
          per_user_cap?: number | null
          period_end?: string | null
          period_start?: string | null
          period_type?:
            | Database["public"]["Enums"]["partner_credit_pool_period_type"]
            | null
          remaining_credits?: never
          status?:
            | Database["public"]["Enums"]["partner_credit_pool_status"]
            | null
          total_credits?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_credit_pools_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_aggregate_dashboard_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "partner_credit_pools_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_progress_dashboard_summary: {
        Row: {
          brief_visible: boolean | null
          credits_used: number | null
          fix_first_category: string | null
          full_report_visible: boolean | null
          latest_report_at: string | null
          latest_score: number | null
          leaderboard_visible: boolean | null
          partner_id: string | null
          partner_membership_id: string | null
          partner_name: string | null
          partner_type: Database["public"]["Enums"]["partner_type"] | null
          performer_name: string | null
          readiness_band: string | null
          report_count: number | null
          report_dates: string[] | null
          score_trend: number | null
          uploaded_media_visible: boolean | null
          user_id: string | null
          visibility_scope:
            | Database["public"]["Enums"]["partner_visibility_scope"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_visibility_acceptances_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_aggregate_dashboard_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "partner_visibility_acceptances_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_visibility_acceptances_partner_membership_id_fkey"
            columns: ["partner_membership_id"]
            isOneToOne: false
            referencedRelation: "partner_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_partner_visibility: {
        Args: {
          p_accepted_at?: string
          p_brief_sharing_enabled?: boolean
          p_full_report_sharing_enabled?: boolean
          p_idempotency_key?: string
          p_metadata?: Json
          p_parent_guardian_confirmed?: boolean
          p_partner_membership_id: string
          p_uploaded_media_sharing_enabled?: boolean
          p_user_id: string
          p_visibility_scope?: Database["public"]["Enums"]["partner_visibility_scope"]
        }
        Returns: string
      }
      activate_partner_code: {
        Args: {
          p_activated_at?: string
          p_code_hash: string
          p_idempotency_key?: string
          p_metadata?: Json
          p_user_email?: string
          p_user_id: string
        }
        Returns: string
      }
      admin_top_up_partner_credit_pool: {
        Args: {
          p_admin_actor_user_id?: string
          p_credit_amount: number
          p_idempotency_key?: string
          p_metadata?: Json
          p_partner_credit_pool_id: string
          p_reason?: string
        }
        Returns: string
      }
      admin_top_up_partner_membership: {
        Args: {
          p_admin_actor_user_id?: string
          p_cap_override?: boolean
          p_cap_override_reason?: string
          p_credit_amount: number
          p_idempotency_key?: string
          p_metadata?: Json
          p_partner_membership_id: string
          p_reason?: string
        }
        Returns: string
      }
      allocate_partner_pool_credits: {
        Args: {
          p_allocated_at?: string
          p_cap_override?: boolean
          p_cap_override_reason?: string
          p_created_by_user_id?: string
          p_credit_amount: number
          p_credit_grant_id?: string
          p_metadata?: Json
          p_partner_credit_pool_id: string
          p_partner_membership_id?: string
          p_source: Database["public"]["Enums"]["partner_credit_allocation_source"]
          p_user_id: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_partner_codes: { Args: { p_now?: string }; Returns: number }
      flag_partner_code_abuse: {
        Args: {
          p_admin_actor_user_id?: string
          p_now?: string
          p_partner_code_id: string
          p_reason?: string
        }
        Returns: string
      }
      get_effective_quota_config: {
        Args: never
        Returns: {
          daily_submission_cap: number
          max_takes_per_audition: number
          quota_enabled: boolean
        }[]
      }
      grant_funded_credits: {
        Args: {
          p_admin_actor_user_id?: string
          p_admin_reason?: string
          p_credit_amount: number
          p_expires_at?: string
          p_granted_at?: string
          p_idempotency_key?: string
          p_metadata?: Json
          p_source: Database["public"]["Enums"]["credit_source"]
          p_source_label?: string
          p_source_reference_id?: string
          p_source_reference_type?: string
          p_user_id: string
        }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      partner_credit_source: {
        Args: { p_partner_type: Database["public"]["Enums"]["partner_type"] }
        Returns: Database["public"]["Enums"]["credit_source"]
      }
      partner_default_visibility_scope: {
        Args: { p_partner_type: Database["public"]["Enums"]["partner_type"] }
        Returns: Database["public"]["Enums"]["partner_visibility_scope"]
      }
      partner_email_domain: { Args: { p_email: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_admin_credit_adjustment: {
        Args: {
          p_admin_actor_user_id?: string
          p_admin_reason?: string
          p_credit_delta: number
          p_credit_grant_id?: string
          p_idempotency_key?: string
          p_metadata?: Json
          p_source: Database["public"]["Enums"]["credit_source"]
          p_user_id: string
        }
        Returns: string
      }
      record_credit_consumption: {
        Args: {
          p_audition_id?: string
          p_credit_amount: number
          p_credit_grant_id: string
          p_idempotency_key?: string
          p_metadata?: Json
          p_report_generated_at?: string
          p_take_id?: string
          p_user_id: string
        }
        Returns: string
      }
      record_partner_pool_alerts: {
        Args: { p_now?: string; p_partner_credit_pool_id: string }
        Returns: number
      }
      revoke_partner_visibility_acceptance: {
        Args: {
          p_partner_visibility_acceptance_id: string
          p_revocation_reason?: string
          p_revoked_at?: string
          p_revoked_by_user_id?: string
        }
        Returns: string
      }
      rotate_partner_code: {
        Args: {
          p_admin_actor_user_id?: string
          p_allowance_credits?: number
          p_allowed_email_domains?: string[]
          p_existing_code_id: string
          p_expires_at?: string
          p_idempotency_key?: string
          p_max_activations?: number
          p_metadata?: Json
          p_new_code_display_hint: string
          p_new_code_hash: string
        }
        Returns: string
      }
      set_partner_code_status: {
        Args: {
          p_admin_actor_user_id?: string
          p_now?: string
          p_partner_code_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["partner_code_status"]
        }
        Returns: string
      }
    }
    Enums: {
      credit_grant_status: "active" | "exhausted" | "expired" | "revoked"
      credit_ledger_entry_type:
        | "grant"
        | "consume"
        | "admin_adjustment"
        | "expiry_adjustment"
      credit_rollover_policy: "rollover" | "no_rollover" | "funding_period"
      credit_source:
        | "free_signup"
        | "free_monthly"
        | "school_funded"
        | "coach_funded"
        | "agent_funded"
        | "platform_funded"
        | "sponsor_campaign"
        | "user_paid"
        | "admin_grant"
      partner_code_status:
        | "active"
        | "paused"
        | "revoked"
        | "rotated"
        | "expired"
      partner_credit_allocation_source:
        | "code_activation"
        | "admin_partner_top_up"
        | "admin_performer_top_up"
      partner_credit_pool_event_type:
        | "pool_created"
        | "partner_top_up"
        | "performer_allocation"
        | "performer_top_up"
        | "usage_alert"
      partner_credit_pool_period_type:
        | "monthly"
        | "term"
        | "annual"
        | "fixed_campaign"
      partner_credit_pool_status:
        | "active"
        | "paused"
        | "exhausted"
        | "expired"
        | "archived"
      partner_membership_status: "active" | "revoked" | "expired"
      partner_status: "active" | "paused" | "archived"
      partner_type: "school" | "coach" | "agent" | "sponsor" | "platform"
      partner_usage_alert_status: "triggered" | "acknowledged"
      partner_visibility_acceptance_status: "active" | "revoked"
      partner_visibility_scope:
        | "aggregate_only"
        | "limited_usage_readiness"
        | "named_progress"
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
      credit_grant_status: ["active", "exhausted", "expired", "revoked"],
      credit_ledger_entry_type: [
        "grant",
        "consume",
        "admin_adjustment",
        "expiry_adjustment",
      ],
      credit_rollover_policy: ["rollover", "no_rollover", "funding_period"],
      credit_source: [
        "free_signup",
        "free_monthly",
        "school_funded",
        "coach_funded",
        "agent_funded",
        "platform_funded",
        "sponsor_campaign",
        "user_paid",
        "admin_grant",
      ],
      partner_code_status: [
        "active",
        "paused",
        "revoked",
        "rotated",
        "expired",
      ],
      partner_credit_allocation_source: [
        "code_activation",
        "admin_partner_top_up",
        "admin_performer_top_up",
      ],
      partner_credit_pool_event_type: [
        "pool_created",
        "partner_top_up",
        "performer_allocation",
        "performer_top_up",
        "usage_alert",
      ],
      partner_credit_pool_period_type: [
        "monthly",
        "term",
        "annual",
        "fixed_campaign",
      ],
      partner_credit_pool_status: [
        "active",
        "paused",
        "exhausted",
        "expired",
        "archived",
      ],
      partner_membership_status: ["active", "revoked", "expired"],
      partner_status: ["active", "paused", "archived"],
      partner_type: ["school", "coach", "agent", "sponsor", "platform"],
      partner_usage_alert_status: ["triggered", "acknowledged"],
      partner_visibility_acceptance_status: ["active", "revoked"],
      partner_visibility_scope: [
        "aggregate_only",
        "limited_usage_readiness",
        "named_progress",
      ],
    },
  },
} as const

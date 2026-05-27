export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      account_compliance: {
        Row: {
          account_route: string;
          account_type: string;
          age_band_declaration: string;
          ai_disclaimer_accepted_at: string;
          ai_disclaimer_version: string;
          created_at: string;
          marketing_consent: boolean;
          marketing_consent_at: string | null;
          parent_guardian_attested: boolean;
          parent_guardian_attested_at: string | null;
          parent_managed: boolean;
          privacy_accepted_at: string;
          privacy_version: string;
          terms_accepted_at: string;
          terms_version: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_route: string;
          account_type: string;
          age_band_declaration: string;
          ai_disclaimer_accepted_at: string;
          ai_disclaimer_version: string;
          created_at?: string;
          marketing_consent?: boolean;
          marketing_consent_at?: string | null;
          parent_guardian_attested?: boolean;
          parent_guardian_attested_at?: string | null;
          parent_managed?: boolean;
          privacy_accepted_at: string;
          privacy_version: string;
          terms_accepted_at: string;
          terms_version: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_route?: string;
          account_type?: string;
          age_band_declaration?: string;
          ai_disclaimer_accepted_at?: string;
          ai_disclaimer_version?: string;
          created_at?: string;
          marketing_consent?: boolean;
          marketing_consent_at?: string | null;
          parent_guardian_attested?: boolean;
          parent_guardian_attested_at?: string | null;
          parent_managed?: boolean;
          privacy_accepted_at?: string;
          privacy_version?: string;
          terms_accepted_at?: string;
          terms_version?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      app_config: {
        Row: {
          daily_submission_cap: number;
          future_evidence_enabled: boolean;
          future_qa_trace_enabled: boolean;
          future_report_enabled: boolean;
          id: string;
          max_takes_per_audition: number;
          quota_enabled: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          daily_submission_cap?: number;
          future_evidence_enabled?: boolean;
          future_qa_trace_enabled?: boolean;
          future_report_enabled?: boolean;
          id?: string;
          max_takes_per_audition?: number;
          quota_enabled?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          daily_submission_cap?: number;
          future_evidence_enabled?: boolean;
          future_qa_trace_enabled?: boolean;
          future_report_enabled?: boolean;
          id?: string;
          max_takes_per_audition?: number;
          quota_enabled?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      consumer_credit_products: {
        Row: {
          active: boolean;
          created_at: string;
          credit_amount: number;
          currency: string;
          description: string;
          display_context: string;
          display_order: number;
          founding_price: boolean;
          id: string;
          name: string;
          sku: string;
          stripe_price_id: string | null;
          unit_amount_pence: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          credit_amount: number;
          currency?: string;
          description?: string;
          display_context?: string;
          display_order?: number;
          founding_price?: boolean;
          id?: string;
          name: string;
          sku: string;
          stripe_price_id?: string | null;
          unit_amount_pence: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          credit_amount?: number;
          currency?: string;
          description?: string;
          display_context?: string;
          display_order?: number;
          founding_price?: boolean;
          id?: string;
          name?: string;
          sku?: string;
          stripe_price_id?: string | null;
          unit_amount_pence?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      consumer_credit_payments: {
        Row: {
          amount_total_pence: number;
          created_at: string;
          credit_amount: number;
          credit_grant_id: string | null;
          currency: string;
          failure_code: string | null;
          id: string;
          latest_stripe_event_id: string | null;
          metadata: Json;
          product_sku: string;
          status: Database["public"]["Enums"]["consumer_credit_payment_status"];
          stripe_checkout_session_id: string | null;
          stripe_customer_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_price_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_total_pence: number;
          created_at?: string;
          credit_amount: number;
          credit_grant_id?: string | null;
          currency?: string;
          failure_code?: string | null;
          id?: string;
          latest_stripe_event_id?: string | null;
          metadata?: Json;
          product_sku: string;
          status?: Database["public"]["Enums"]["consumer_credit_payment_status"];
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_price_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_total_pence?: number;
          created_at?: string;
          credit_amount?: number;
          credit_grant_id?: string | null;
          currency?: string;
          failure_code?: string | null;
          id?: string;
          latest_stripe_event_id?: string | null;
          metadata?: Json;
          product_sku?: string;
          status?: Database["public"]["Enums"]["consumer_credit_payment_status"];
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_price_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consumer_credit_payments_credit_grant_id_fkey";
            columns: ["credit_grant_id"];
            isOneToOne: false;
            referencedRelation: "credit_grants";
            referencedColumns: ["id"];
          },
        ];
      };
      consumer_credit_revenue_ledger_entries: {
        Row: {
          amount_pence: number | null;
          created_at: string;
          credit_delta: number;
          credit_grant_id: string | null;
          currency: string;
          event_type: Database["public"]["Enums"]["consumer_credit_revenue_event_type"];
          id: string;
          metadata: Json;
          payment_id: string | null;
          processing_status: string;
          stripe_event_id: string;
          stripe_object_id: string;
          stripe_payment_intent_id: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          amount_pence?: number | null;
          created_at?: string;
          credit_delta?: number;
          credit_grant_id?: string | null;
          currency?: string;
          event_type: Database["public"]["Enums"]["consumer_credit_revenue_event_type"];
          id?: string;
          metadata?: Json;
          payment_id?: string | null;
          processing_status?: string;
          stripe_event_id: string;
          stripe_object_id: string;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          amount_pence?: number | null;
          created_at?: string;
          credit_delta?: number;
          credit_grant_id?: string | null;
          currency?: string;
          event_type?: Database["public"]["Enums"]["consumer_credit_revenue_event_type"];
          id?: string;
          metadata?: Json;
          payment_id?: string | null;
          processing_status?: string;
          stripe_event_id?: string;
          stripe_object_id?: string;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "consumer_credit_revenue_ledger_entries_credit_grant_id_fkey";
            columns: ["credit_grant_id"];
            isOneToOne: false;
            referencedRelation: "credit_grants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consumer_credit_revenue_ledger_entries_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "consumer_credit_payments";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_grants: {
        Row: {
          admin_reason: string | null;
          created_at: string;
          expires_at: string | null;
          granted_at: string;
          granted_by_user_id: string | null;
          id: string;
          metadata: Json;
          original_credits: number;
          remaining_credits: number;
          rollover_policy: Database["public"]["Enums"]["credit_rollover_policy"];
          source: Database["public"]["Enums"]["credit_source"];
          source_label: string | null;
          source_reference_id: string | null;
          source_reference_type: string | null;
          status: Database["public"]["Enums"]["credit_grant_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          admin_reason?: string | null;
          created_at?: string;
          expires_at?: string | null;
          granted_at?: string;
          granted_by_user_id?: string | null;
          id?: string;
          metadata?: Json;
          original_credits: number;
          remaining_credits: number;
          rollover_policy: Database["public"]["Enums"]["credit_rollover_policy"];
          source: Database["public"]["Enums"]["credit_source"];
          source_label?: string | null;
          source_reference_id?: string | null;
          source_reference_type?: string | null;
          status?: Database["public"]["Enums"]["credit_grant_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          admin_reason?: string | null;
          created_at?: string;
          expires_at?: string | null;
          granted_at?: string;
          granted_by_user_id?: string | null;
          id?: string;
          metadata?: Json;
          original_credits?: number;
          remaining_credits?: number;
          rollover_policy?: Database["public"]["Enums"]["credit_rollover_policy"];
          source?: Database["public"]["Enums"]["credit_source"];
          source_label?: string | null;
          source_reference_id?: string | null;
          source_reference_type?: string | null;
          status?: Database["public"]["Enums"]["credit_grant_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      credit_ledger_entries: {
        Row: {
          admin_actor_user_id: string | null;
          admin_reason: string | null;
          audition_id: string | null;
          created_at: string;
          credit_delta: number;
          credit_grant_id: string | null;
          entry_type: Database["public"]["Enums"]["credit_ledger_entry_type"];
          id: string;
          idempotency_key: string | null;
          metadata: Json;
          report_generated_at: string | null;
          source: Database["public"]["Enums"]["credit_source"];
          source_reference_id: string | null;
          source_reference_type: string | null;
          take_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          admin_actor_user_id?: string | null;
          admin_reason?: string | null;
          audition_id?: string | null;
          created_at?: string;
          credit_delta: number;
          credit_grant_id?: string | null;
          entry_type: Database["public"]["Enums"]["credit_ledger_entry_type"];
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          report_generated_at?: string | null;
          source: Database["public"]["Enums"]["credit_source"];
          source_reference_id?: string | null;
          source_reference_type?: string | null;
          take_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          admin_actor_user_id?: string | null;
          admin_reason?: string | null;
          audition_id?: string | null;
          created_at?: string;
          credit_delta?: number;
          credit_grant_id?: string | null;
          entry_type?: Database["public"]["Enums"]["credit_ledger_entry_type"];
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          report_generated_at?: string | null;
          source?: Database["public"]["Enums"]["credit_source"];
          source_reference_id?: string | null;
          source_reference_type?: string | null;
          take_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_ledger_entries_audition_id_fkey";
            columns: ["audition_id"];
            isOneToOne: false;
            referencedRelation: "auditions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_ledger_entries_credit_grant_id_fkey";
            columns: ["credit_grant_id"];
            isOneToOne: false;
            referencedRelation: "credit_grants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_ledger_entries_take_id_fkey";
            columns: ["take_id"];
            isOneToOne: false;
            referencedRelation: "takes";
            referencedColumns: ["id"];
          },
        ];
      };
      report_credit_reservations: {
        Row: {
          audition_id: string | null;
          commercial_metrics_excluded: boolean;
          consumed_at: string | null;
          consumption_ledger_entry_id: string | null;
          created_at: string;
          credit_amount: number;
          credit_grant_id: string | null;
          failure_code: string | null;
          id: string;
          idempotency_key: string | null;
          metadata: Json;
          refunded_at: string | null;
          release_reason: string | null;
          released_at: string | null;
          reserved_at: string;
          source: Database["public"]["Enums"]["credit_source"] | null;
          status: Database["public"]["Enums"]["report_credit_reservation_status"];
          synthetic_usage: boolean;
          take_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          audition_id?: string | null;
          commercial_metrics_excluded?: boolean;
          consumed_at?: string | null;
          consumption_ledger_entry_id?: string | null;
          created_at?: string;
          credit_amount?: number;
          credit_grant_id?: string | null;
          failure_code?: string | null;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          refunded_at?: string | null;
          release_reason?: string | null;
          released_at?: string | null;
          reserved_at?: string;
          source?: Database["public"]["Enums"]["credit_source"] | null;
          status?: Database["public"]["Enums"]["report_credit_reservation_status"];
          synthetic_usage?: boolean;
          take_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          audition_id?: string | null;
          commercial_metrics_excluded?: boolean;
          consumed_at?: string | null;
          consumption_ledger_entry_id?: string | null;
          created_at?: string;
          credit_amount?: number;
          credit_grant_id?: string | null;
          failure_code?: string | null;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          refunded_at?: string | null;
          release_reason?: string | null;
          released_at?: string | null;
          reserved_at?: string;
          source?: Database["public"]["Enums"]["credit_source"] | null;
          status?: Database["public"]["Enums"]["report_credit_reservation_status"];
          synthetic_usage?: boolean;
          take_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_credit_reservations_audition_id_fkey";
            columns: ["audition_id"];
            isOneToOne: false;
            referencedRelation: "auditions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_credit_reservations_consumption_ledger_entry_id_fkey";
            columns: ["consumption_ledger_entry_id"];
            isOneToOne: false;
            referencedRelation: "credit_ledger_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_credit_reservations_credit_grant_id_fkey";
            columns: ["credit_grant_id"];
            isOneToOne: false;
            referencedRelation: "credit_grants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_credit_reservations_take_id_fkey";
            columns: ["take_id"];
            isOneToOne: false;
            referencedRelation: "takes";
            referencedColumns: ["id"];
          },
        ];
      };
      take_ai_usage: {
        Row: {
          audition_id: string | null;
          completion_tokens: number | null;
          cost_source: Database["public"]["Enums"]["ai_usage_cost_source"];
          created_at: string;
          duration_status: string | null;
          estimated_cost_usd: number;
          failure_reason: string | null;
          fallback_used: boolean;
          http_status: number | null;
          id: string;
          latency_ms: number;
          metadata: Json;
          model: string;
          prompt_tokens: number | null;
          prompt_version: string | null;
          provider: string;
          provider_contract: string | null;
          repair_attempt: boolean;
          status: Database["public"]["Enums"]["ai_usage_status"];
          step: Database["public"]["Enums"]["ai_usage_step"];
          success: boolean;
          take_id: string | null;
          total_tokens: number | null;
          user_id: string | null;
          video_duration_seconds: number | null;
        };
        Insert: {
          audition_id?: string | null;
          completion_tokens?: number | null;
          cost_source?: Database["public"]["Enums"]["ai_usage_cost_source"];
          created_at?: string;
          duration_status?: string | null;
          estimated_cost_usd?: number;
          failure_reason?: string | null;
          fallback_used?: boolean;
          http_status?: number | null;
          id?: string;
          latency_ms: number;
          metadata?: Json;
          model: string;
          prompt_tokens?: number | null;
          prompt_version?: string | null;
          provider?: string;
          provider_contract?: string | null;
          repair_attempt?: boolean;
          status: Database["public"]["Enums"]["ai_usage_status"];
          step: Database["public"]["Enums"]["ai_usage_step"];
          success: boolean;
          take_id?: string | null;
          total_tokens?: number | null;
          user_id?: string | null;
          video_duration_seconds?: number | null;
        };
        Update: {
          audition_id?: string | null;
          completion_tokens?: number | null;
          cost_source?: Database["public"]["Enums"]["ai_usage_cost_source"];
          created_at?: string;
          duration_status?: string | null;
          estimated_cost_usd?: number;
          failure_reason?: string | null;
          fallback_used?: boolean;
          http_status?: number | null;
          id?: string;
          latency_ms?: number;
          metadata?: Json;
          model?: string;
          prompt_tokens?: number | null;
          prompt_version?: string | null;
          provider?: string;
          provider_contract?: string | null;
          repair_attempt?: boolean;
          status?: Database["public"]["Enums"]["ai_usage_status"];
          step?: Database["public"]["Enums"]["ai_usage_step"];
          success?: boolean;
          take_id?: string | null;
          total_tokens?: number | null;
          user_id?: string | null;
          video_duration_seconds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "take_ai_usage_audition_id_fkey";
            columns: ["audition_id"];
            isOneToOne: false;
            referencedRelation: "auditions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "take_ai_usage_take_id_fkey";
            columns: ["take_id"];
            isOneToOne: false;
            referencedRelation: "takes";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_credit_allocations: {
        Row: {
          allocated_at: string;
          cap_override: boolean;
          cap_override_reason: string | null;
          created_at: string;
          created_by_user_id: string | null;
          credit_amount: number;
          credit_grant_id: string | null;
          id: string;
          metadata: Json;
          partner_credit_pool_id: string;
          partner_id: string;
          partner_membership_id: string | null;
          source: Database["public"]["Enums"]["partner_credit_allocation_source"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          allocated_at?: string;
          cap_override?: boolean;
          cap_override_reason?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          credit_amount: number;
          credit_grant_id?: string | null;
          id?: string;
          metadata?: Json;
          partner_credit_pool_id: string;
          partner_id: string;
          partner_membership_id?: string | null;
          source: Database["public"]["Enums"]["partner_credit_allocation_source"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          allocated_at?: string;
          cap_override?: boolean;
          cap_override_reason?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          credit_amount?: number;
          credit_grant_id?: string | null;
          id?: string;
          metadata?: Json;
          partner_credit_pool_id?: string;
          partner_id?: string;
          partner_membership_id?: string | null;
          source?: Database["public"]["Enums"]["partner_credit_allocation_source"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_credit_allocations_credit_grant_id_fkey";
            columns: ["credit_grant_id"];
            isOneToOne: false;
            referencedRelation: "credit_grants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_credit_allocations_partner_credit_pool_id_fkey";
            columns: ["partner_credit_pool_id"];
            isOneToOne: false;
            referencedRelation: "partner_credit_pools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_credit_allocations_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_credit_allocations_partner_membership_id_fkey";
            columns: ["partner_membership_id"];
            isOneToOne: false;
            referencedRelation: "partner_memberships";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_credit_pool_events: {
        Row: {
          admin_actor_user_id: string | null;
          created_at: string;
          credit_delta: number;
          event_type: Database["public"]["Enums"]["partner_credit_pool_event_type"];
          id: string;
          idempotency_key: string | null;
          metadata: Json;
          partner_credit_pool_id: string;
          partner_id: string;
          reason: string | null;
          related_alert_id: string | null;
          related_allocation_id: string | null;
          updated_at: string;
        };
        Insert: {
          admin_actor_user_id?: string | null;
          created_at?: string;
          credit_delta?: number;
          event_type: Database["public"]["Enums"]["partner_credit_pool_event_type"];
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          partner_credit_pool_id: string;
          partner_id: string;
          reason?: string | null;
          related_alert_id?: string | null;
          related_allocation_id?: string | null;
          updated_at?: string;
        };
        Update: {
          admin_actor_user_id?: string | null;
          created_at?: string;
          credit_delta?: number;
          event_type?: Database["public"]["Enums"]["partner_credit_pool_event_type"];
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          partner_credit_pool_id?: string;
          partner_id?: string;
          reason?: string | null;
          related_alert_id?: string | null;
          related_allocation_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_credit_pool_events_partner_credit_pool_id_fkey";
            columns: ["partner_credit_pool_id"];
            isOneToOne: false;
            referencedRelation: "partner_credit_pools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_credit_pool_events_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_credit_pool_events_related_alert_id_fkey";
            columns: ["related_alert_id"];
            isOneToOne: false;
            referencedRelation: "partner_usage_alerts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_credit_pool_events_related_allocation_id_fkey";
            columns: ["related_allocation_id"];
            isOneToOne: false;
            referencedRelation: "partner_credit_allocations";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_credit_pools: {
        Row: {
          allocated_credits: number;
          consumed_credits: number;
          created_at: string;
          created_by_user_id: string | null;
          currency: string;
          id: string;
          metadata: Json;
          name: string;
          overage_allowed: boolean;
          overage_price_pence: number | null;
          partner_id: string;
          period_end: string;
          period_start: string;
          period_type: Database["public"]["Enums"]["partner_credit_pool_period_type"];
          per_user_cap: number;
          status: Database["public"]["Enums"]["partner_credit_pool_status"];
          total_credits: number;
          updated_at: string;
        };
        Insert: {
          allocated_credits?: number;
          consumed_credits?: number;
          created_at?: string;
          created_by_user_id?: string | null;
          currency?: string;
          id?: string;
          metadata?: Json;
          name: string;
          overage_allowed?: boolean;
          overage_price_pence?: number | null;
          partner_id: string;
          period_end: string;
          period_start: string;
          period_type: Database["public"]["Enums"]["partner_credit_pool_period_type"];
          per_user_cap: number;
          status?: Database["public"]["Enums"]["partner_credit_pool_status"];
          total_credits: number;
          updated_at?: string;
        };
        Update: {
          allocated_credits?: number;
          consumed_credits?: number;
          created_at?: string;
          created_by_user_id?: string | null;
          currency?: string;
          id?: string;
          metadata?: Json;
          name?: string;
          overage_allowed?: boolean;
          overage_price_pence?: number | null;
          partner_id?: string;
          period_end?: string;
          period_start?: string;
          period_type?: Database["public"]["Enums"]["partner_credit_pool_period_type"];
          per_user_cap?: number;
          status?: Database["public"]["Enums"]["partner_credit_pool_status"];
          total_credits?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_credit_pools_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_usage_alerts: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by_user_id: string | null;
          allocated_credits: number;
          created_at: string;
          id: string;
          metadata: Json;
          partner_credit_pool_id: string;
          partner_id: string;
          status: Database["public"]["Enums"]["partner_usage_alert_status"];
          threshold_percent: number;
          total_credits: number;
          triggered_at: string;
          updated_at: string;
          usage_percent: number;
        };
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by_user_id?: string | null;
          allocated_credits: number;
          created_at?: string;
          id?: string;
          metadata?: Json;
          partner_credit_pool_id: string;
          partner_id: string;
          status?: Database["public"]["Enums"]["partner_usage_alert_status"];
          threshold_percent: number;
          total_credits: number;
          triggered_at?: string;
          updated_at?: string;
          usage_percent: number;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by_user_id?: string | null;
          allocated_credits?: number;
          created_at?: string;
          id?: string;
          metadata?: Json;
          partner_credit_pool_id?: string;
          partner_id?: string;
          status?: Database["public"]["Enums"]["partner_usage_alert_status"];
          threshold_percent?: number;
          total_credits?: number;
          triggered_at?: string;
          updated_at?: string;
          usage_percent?: number;
        };
        Relationships: [
          {
            foreignKeyName: "partner_usage_alerts_partner_credit_pool_id_fkey";
            columns: ["partner_credit_pool_id"];
            isOneToOne: false;
            referencedRelation: "partner_credit_pools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_usage_alerts_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_visibility_acceptances: {
        Row: {
          accepted_at: string;
          brief_sharing_enabled: boolean;
          created_at: string;
          full_report_sharing_enabled: boolean;
          id: string;
          idempotency_key: string | null;
          leaderboard_enabled: boolean;
          metadata: Json;
          parent_guardian_confirmed: boolean;
          partner_id: string;
          partner_membership_id: string;
          partner_type: Database["public"]["Enums"]["partner_type"];
          policy_version: string;
          revocation_reason: string | null;
          revoked_at: string | null;
          revoked_by_user_id: string | null;
          status: Database["public"]["Enums"]["partner_visibility_acceptance_status"];
          updated_at: string;
          uploaded_media_sharing_enabled: boolean;
          user_id: string;
          visibility_scope: Database["public"]["Enums"]["partner_visibility_scope"];
        };
        Insert: {
          accepted_at?: string;
          brief_sharing_enabled?: boolean;
          created_at?: string;
          full_report_sharing_enabled?: boolean;
          id?: string;
          idempotency_key?: string | null;
          leaderboard_enabled?: boolean;
          metadata?: Json;
          parent_guardian_confirmed?: boolean;
          partner_id: string;
          partner_membership_id: string;
          partner_type: Database["public"]["Enums"]["partner_type"];
          policy_version: string;
          revocation_reason?: string | null;
          revoked_at?: string | null;
          revoked_by_user_id?: string | null;
          status?: Database["public"]["Enums"]["partner_visibility_acceptance_status"];
          updated_at?: string;
          uploaded_media_sharing_enabled?: boolean;
          user_id: string;
          visibility_scope: Database["public"]["Enums"]["partner_visibility_scope"];
        };
        Update: {
          accepted_at?: string;
          brief_sharing_enabled?: boolean;
          created_at?: string;
          full_report_sharing_enabled?: boolean;
          id?: string;
          idempotency_key?: string | null;
          leaderboard_enabled?: boolean;
          metadata?: Json;
          parent_guardian_confirmed?: boolean;
          partner_id?: string;
          partner_membership_id?: string;
          partner_type?: Database["public"]["Enums"]["partner_type"];
          policy_version?: string;
          revocation_reason?: string | null;
          revoked_at?: string | null;
          revoked_by_user_id?: string | null;
          status?: Database["public"]["Enums"]["partner_visibility_acceptance_status"];
          updated_at?: string;
          uploaded_media_sharing_enabled?: boolean;
          user_id?: string;
          visibility_scope?: Database["public"]["Enums"]["partner_visibility_scope"];
        };
        Relationships: [
          {
            foreignKeyName: "partner_visibility_acceptances_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_visibility_acceptances_partner_membership_id_fkey";
            columns: ["partner_membership_id"];
            isOneToOne: false;
            referencedRelation: "partner_memberships";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_codes: {
        Row: {
          abuse_flag_reason: string | null;
          abuse_flagged_at: string | null;
          abuse_flagged_by_user_id: string | null;
          activation_count: number;
          allowance_credits: number;
          allowed_email_domains: string[];
          code_display_hint: string;
          code_hash: string;
          created_at: string;
          created_by_user_id: string | null;
          expires_at: string | null;
          id: string;
          idempotency_key: string | null;
          max_activations: number | null;
          metadata: Json;
          partner_credit_pool_id: string | null;
          partner_id: string;
          revoked_at: string | null;
          revoked_by_user_id: string | null;
          revoked_reason: string | null;
          rotated_from_code_id: string | null;
          rotated_to_code_id: string | null;
          status: Database["public"]["Enums"]["partner_code_status"];
          updated_at: string;
          valid_from: string;
          version: number;
        };
        Insert: {
          abuse_flag_reason?: string | null;
          abuse_flagged_at?: string | null;
          abuse_flagged_by_user_id?: string | null;
          activation_count?: number;
          allowance_credits: number;
          allowed_email_domains?: string[];
          code_display_hint: string;
          code_hash: string;
          created_at?: string;
          created_by_user_id?: string | null;
          expires_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          max_activations?: number | null;
          metadata?: Json;
          partner_credit_pool_id?: string | null;
          partner_id: string;
          revoked_at?: string | null;
          revoked_by_user_id?: string | null;
          revoked_reason?: string | null;
          rotated_from_code_id?: string | null;
          rotated_to_code_id?: string | null;
          status?: Database["public"]["Enums"]["partner_code_status"];
          updated_at?: string;
          valid_from?: string;
          version: number;
        };
        Update: {
          abuse_flag_reason?: string | null;
          abuse_flagged_at?: string | null;
          abuse_flagged_by_user_id?: string | null;
          activation_count?: number;
          allowance_credits?: number;
          allowed_email_domains?: string[];
          code_display_hint?: string;
          code_hash?: string;
          created_at?: string;
          created_by_user_id?: string | null;
          expires_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          max_activations?: number | null;
          metadata?: Json;
          partner_credit_pool_id?: string | null;
          partner_id?: string;
          revoked_at?: string | null;
          revoked_by_user_id?: string | null;
          revoked_reason?: string | null;
          rotated_from_code_id?: string | null;
          rotated_to_code_id?: string | null;
          status?: Database["public"]["Enums"]["partner_code_status"];
          updated_at?: string;
          valid_from?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "partner_codes_partner_credit_pool_id_fkey";
            columns: ["partner_credit_pool_id"];
            isOneToOne: false;
            referencedRelation: "partner_credit_pools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_codes_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_codes_rotated_from_code_id_fkey";
            columns: ["rotated_from_code_id"];
            isOneToOne: false;
            referencedRelation: "partner_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_codes_rotated_to_code_id_fkey";
            columns: ["rotated_to_code_id"];
            isOneToOne: false;
            referencedRelation: "partner_codes";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_memberships: {
        Row: {
          activated_at: string;
          activation_idempotency_key: string | null;
          allowance_credits: number;
          code_version: number;
          created_at: string;
          credit_grant_id: string | null;
          credit_source: Database["public"]["Enums"]["credit_source"];
          email_domain: string | null;
          expires_at: string | null;
          id: string;
          metadata: Json;
          partner_code_id: string;
          partner_credit_pool_id: string | null;
          partner_id: string;
          partner_type: Database["public"]["Enums"]["partner_type"];
          status: Database["public"]["Enums"]["partner_membership_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          activated_at?: string;
          activation_idempotency_key?: string | null;
          allowance_credits: number;
          code_version: number;
          created_at?: string;
          credit_grant_id?: string | null;
          credit_source: Database["public"]["Enums"]["credit_source"];
          email_domain?: string | null;
          expires_at?: string | null;
          id?: string;
          metadata?: Json;
          partner_code_id: string;
          partner_credit_pool_id?: string | null;
          partner_id: string;
          partner_type: Database["public"]["Enums"]["partner_type"];
          status?: Database["public"]["Enums"]["partner_membership_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          activated_at?: string;
          activation_idempotency_key?: string | null;
          allowance_credits?: number;
          code_version?: number;
          created_at?: string;
          credit_grant_id?: string | null;
          credit_source?: Database["public"]["Enums"]["credit_source"];
          email_domain?: string | null;
          expires_at?: string | null;
          id?: string;
          metadata?: Json;
          partner_code_id?: string;
          partner_credit_pool_id?: string | null;
          partner_id?: string;
          partner_type?: Database["public"]["Enums"]["partner_type"];
          status?: Database["public"]["Enums"]["partner_membership_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_memberships_credit_grant_id_fkey";
            columns: ["credit_grant_id"];
            isOneToOne: false;
            referencedRelation: "credit_grants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_memberships_partner_code_id_fkey";
            columns: ["partner_code_id"];
            isOneToOne: false;
            referencedRelation: "partner_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_memberships_partner_credit_pool_id_fkey";
            columns: ["partner_credit_pool_id"];
            isOneToOne: false;
            referencedRelation: "partner_credit_pools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_memberships_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_package_presets: {
        Row: {
          active: boolean;
          billing_period: string;
          created_at: string;
          credits_per_member: number;
          currency: string;
          description: string;
          display_context: string;
          display_order: number;
          id: string;
          included_seats: number;
          metadata: Json;
          name: string;
          package_tier: string;
          partner_type: Database["public"]["Enums"]["partner_type"];
          per_user_cap: number;
          pool_period_type: Database["public"]["Enums"]["partner_credit_pool_period_type"];
          progress_visibility_scope: Database["public"]["Enums"]["partner_visibility_scope"];
          sku: string;
          total_credits: number;
          unit_amount_pence: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          billing_period: string;
          created_at?: string;
          credits_per_member: number;
          currency?: string;
          description?: string;
          display_context: string;
          display_order?: number;
          id?: string;
          included_seats: number;
          metadata?: Json;
          name: string;
          package_tier: string;
          partner_type: Database["public"]["Enums"]["partner_type"];
          per_user_cap: number;
          pool_period_type: Database["public"]["Enums"]["partner_credit_pool_period_type"];
          progress_visibility_scope: Database["public"]["Enums"]["partner_visibility_scope"];
          sku: string;
          total_credits: number;
          unit_amount_pence: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          billing_period?: string;
          created_at?: string;
          credits_per_member?: number;
          currency?: string;
          description?: string;
          display_context?: string;
          display_order?: number;
          id?: string;
          included_seats?: number;
          metadata?: Json;
          name?: string;
          package_tier?: string;
          partner_type?: Database["public"]["Enums"]["partner_type"];
          per_user_cap?: number;
          pool_period_type?: Database["public"]["Enums"]["partner_credit_pool_period_type"];
          progress_visibility_scope?: Database["public"]["Enums"]["partner_visibility_scope"];
          sku?: string;
          total_credits?: number;
          unit_amount_pence?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      partners: {
        Row: {
          allowed_email_domains: string[];
          created_at: string;
          created_by_user_id: string | null;
          id: string;
          metadata: Json;
          name: string;
          primary_contact_email: string | null;
          slug: string;
          status: Database["public"]["Enums"]["partner_status"];
          type: Database["public"]["Enums"]["partner_type"];
          updated_at: string;
        };
        Insert: {
          allowed_email_domains?: string[];
          created_at?: string;
          created_by_user_id?: string | null;
          id?: string;
          metadata?: Json;
          name: string;
          primary_contact_email?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["partner_status"];
          type: Database["public"]["Enums"]["partner_type"];
          updated_at?: string;
        };
        Update: {
          allowed_email_domains?: string[];
          created_at?: string;
          created_by_user_id?: string | null;
          id?: string;
          metadata?: Json;
          name?: string;
          primary_contact_email?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["partner_status"];
          type?: Database["public"]["Enums"]["partner_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      auditions: {
        Row: {
          anon_id: string | null;
          audition_level: string;
          brief: string | null;
          brief_source: string;
          created_at: string;
          extracted_brief: Json | null;
          id: string;
          mode: string;
          title: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          anon_id?: string | null;
          audition_level?: string;
          brief?: string | null;
          brief_source?: string;
          created_at?: string;
          extracted_brief?: Json | null;
          id?: string;
          mode?: string;
          title?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          anon_id?: string | null;
          audition_level?: string;
          brief?: string | null;
          brief_source?: string;
          created_at?: string;
          extracted_brief?: Json | null;
          id?: string;
          mode?: string;
          title?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      take_qa_traces: {
        Row: {
          branch: string | null;
          components_summary: Json | null;
          created_at: string;
          dimensions_summary: Json | null;
          schema_version: string | null;
          scrub_counters: Json | null;
          shadow_divergence: Json | null;
          sufficiency: Json | null;
          take_id: string;
          updated_at: string;
        };
        Insert: {
          branch?: string | null;
          components_summary?: Json | null;
          created_at?: string;
          dimensions_summary?: Json | null;
          schema_version?: string | null;
          scrub_counters?: Json | null;
          shadow_divergence?: Json | null;
          sufficiency?: Json | null;
          take_id: string;
          updated_at?: string;
        };
        Update: {
          branch?: string | null;
          components_summary?: Json | null;
          created_at?: string;
          dimensions_summary?: Json | null;
          schema_version?: string | null;
          scrub_counters?: Json | null;
          shadow_divergence?: Json | null;
          sufficiency?: Json | null;
          take_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "take_qa_traces_take_id_fkey";
            columns: ["take_id"];
            isOneToOne: true;
            referencedRelation: "takes";
            referencedColumns: ["id"];
          },
        ];
      };
      takes: {
        Row: {
          analysis_tier: string | null;
          anon_id: string | null;
          attempt_count: number;
          audition_id: string;
          checklist: Json | null;
          compliance_flags: Json | null;
          confidence: number | null;
          created_at: string;
          credit_consumption_ledger_entry_id: string | null;
          credit_is_synthetic_usage: boolean;
          credit_lifecycle_metadata: Json;
          credit_lifecycle_status: string | null;
          credit_reservation_id: string | null;
          error_message: string | null;
          id: string;
          mux_asset_id: string | null;
          mux_duration_seconds: number | null;
          mux_mp4_high_url: string | null;
          mux_mp4_standard_url: string | null;
          mux_playback_id: string | null;
          mux_status: string;
          mux_upload_id: string | null;
          overall_score: number | null;
          processing_phase: string;
          report: Json | null;
          score_breakdown: Json | null;
          scores: Json | null;
          signals: Json | null;
          status: string;
          take_number: number;
          updated_at: string;
          user_id: string | null;
          video_path: string | null;
        };
        Insert: {
          analysis_tier?: string | null;
          anon_id?: string | null;
          attempt_count?: number;
          audition_id: string;
          checklist?: Json | null;
          compliance_flags?: Json | null;
          confidence?: number | null;
          created_at?: string;
          credit_consumption_ledger_entry_id?: string | null;
          credit_is_synthetic_usage?: boolean;
          credit_lifecycle_metadata?: Json;
          credit_lifecycle_status?: string | null;
          credit_reservation_id?: string | null;
          error_message?: string | null;
          id?: string;
          mux_asset_id?: string | null;
          mux_duration_seconds?: number | null;
          mux_mp4_high_url?: string | null;
          mux_mp4_standard_url?: string | null;
          mux_playback_id?: string | null;
          mux_status?: string;
          mux_upload_id?: string | null;
          overall_score?: number | null;
          processing_phase?: string;
          report?: Json | null;
          score_breakdown?: Json | null;
          scores?: Json | null;
          signals?: Json | null;
          status?: string;
          take_number?: number;
          updated_at?: string;
          user_id?: string | null;
          video_path?: string | null;
        };
        Update: {
          analysis_tier?: string | null;
          anon_id?: string | null;
          attempt_count?: number;
          audition_id?: string;
          checklist?: Json | null;
          compliance_flags?: Json | null;
          confidence?: number | null;
          created_at?: string;
          credit_consumption_ledger_entry_id?: string | null;
          credit_is_synthetic_usage?: boolean;
          credit_lifecycle_metadata?: Json;
          credit_lifecycle_status?: string | null;
          credit_reservation_id?: string | null;
          error_message?: string | null;
          id?: string;
          mux_asset_id?: string | null;
          mux_duration_seconds?: number | null;
          mux_mp4_high_url?: string | null;
          mux_mp4_standard_url?: string | null;
          mux_playback_id?: string | null;
          mux_status?: string;
          mux_upload_id?: string | null;
          overall_score?: number | null;
          processing_phase?: string;
          report?: Json | null;
          score_breakdown?: Json | null;
          scores?: Json | null;
          signals?: Json | null;
          status?: string;
          take_number?: number;
          updated_at?: string;
          user_id?: string | null;
          video_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "takes_audition_id_fkey";
            columns: ["audition_id"];
            isOneToOne: false;
            referencedRelation: "auditions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "takes_credit_consumption_ledger_entry_id_fkey";
            columns: ["credit_consumption_ledger_entry_id"];
            isOneToOne: false;
            referencedRelation: "credit_ledger_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "takes_credit_reservation_id_fkey";
            columns: ["credit_reservation_id"];
            isOneToOne: false;
            referencedRelation: "report_credit_reservations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      consumer_credit_payment_reconciliation: {
        Row: {
          amount_total_pence: number | null;
          created_at: string | null;
          credit_amount: number | null;
          credit_grant_id: string | null;
          credit_grant_status: Database["public"]["Enums"]["credit_grant_status"] | null;
          currency: string | null;
          failure_code: string | null;
          latest_stripe_event_id: string | null;
          payment_id: string | null;
          product_sku: string | null;
          remaining_credits: number | null;
          status: Database["public"]["Enums"]["consumer_credit_payment_status"] | null;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_price_id: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "consumer_credit_payments_credit_grant_id_fkey";
            columns: ["credit_grant_id"];
            isOneToOne: false;
            referencedRelation: "credit_grants";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_source_finance_summary: {
        Row: {
          admin_adjustment_credits: number;
          consumed_credits: number;
          entry_count: number;
          expired_credits: number;
          first_entry_at: string | null;
          granted_credits: number;
          latest_entry_at: string | null;
          net_credits: number;
          source: Database["public"]["Enums"]["credit_source"];
        };
        Relationships: [];
      };
      ai_usage_cost_dashboard: {
        Row: {
          ai_call_count: number | null;
          average_report_cost_usd: number | null;
          estimated_total_cost_usd: number | null;
          failed_call_count: number | null;
          fallback_call_count: number | null;
          fallback_rate: number | null;
          p50_report_cost_usd: number | null;
          p50_watch_threshold_usd: number | null;
          p95_report_cost_usd: number | null;
          p95_watch_threshold_usd: number | null;
          planning_baseline_6_7_min_high_usd: number | null;
          planning_baseline_6_7_min_low_usd: number | null;
          planning_baseline_max_usd: number | null;
          planning_baseline_min_usd: number | null;
          repair_call_count: number | null;
          repair_rate: number | null;
          report_count: number | null;
        };
        Relationships: [];
      };
      ai_usage_cost_grouping_summary: {
        Row: {
          ai_call_count: number | null;
          average_report_cost_usd: number | null;
          credit_source_group: string | null;
          duration_status: string | null;
          estimated_total_cost_usd: number | null;
          fallback_rate: number | null;
          p50_report_cost_usd: number | null;
          p95_report_cost_usd: number | null;
          partner_id: string | null;
          partner_name: string | null;
          partner_type: Database["public"]["Enums"]["partner_type"] | null;
          repair_rate: number | null;
          report_count: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "partners_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_usage_model_cost_summary: {
        Row: {
          average_latency_ms: number | null;
          call_count: number | null;
          completion_tokens: number | null;
          estimated_cost_usd: number | null;
          fallback_call_count: number | null;
          model: string | null;
          p50_latency_ms: number | null;
          p95_latency_ms: number | null;
          prompt_tokens: number | null;
          provider: string | null;
          repair_call_count: number | null;
          status: Database["public"]["Enums"]["ai_usage_status"] | null;
          step: Database["public"]["Enums"]["ai_usage_step"] | null;
          total_tokens: number | null;
        };
        Relationships: [];
      };
      take_ai_report_costs: {
        Row: {
          ai_call_count: number | null;
          audition_id: string | null;
          commercial_metrics_excluded: boolean | null;
          completion_tokens: number | null;
          credit_source: Database["public"]["Enums"]["credit_source"] | null;
          duration_status: string | null;
          failed_call_count: number | null;
          fallback_call_count: number | null;
          last_ai_usage_at: string | null;
          overall_score: number | null;
          partner_id: string | null;
          partner_name: string | null;
          partner_type: Database["public"]["Enums"]["partner_type"] | null;
          prompt_tokens: number | null;
          repair_call_count: number | null;
          report_cost_source: string | null;
          report_estimated_cost_usd: number | null;
          successful_call_count: number | null;
          synthetic_usage: boolean | null;
          take_created_at: string | null;
          take_id: string | null;
          take_status: string | null;
          take_updated_at: string | null;
          total_latency_ms: number | null;
          total_tokens: number | null;
          user_id: string | null;
          video_duration_seconds: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "takes_audition_id_fkey";
            columns: ["audition_id"];
            isOneToOne: false;
            referencedRelation: "auditions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partners_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      cfo_report_funding_dashboard: {
        Row: {
          average_ai_cost_gbp: number | null;
          average_ai_cost_usd: number | null;
          commercial_metrics_excluded: boolean | null;
          cost_fx_source: string | null;
          credit_source: string | null;
          duration_status: string | null;
          estimated_ai_cost_gbp: number | null;
          estimated_ai_cost_usd: number | null;
          funding_bucket: string | null;
          month_start: string | null;
          partner_id: string | null;
          partner_name: string | null;
          partner_type: Database["public"]["Enums"]["partner_type"] | null;
          planning_usd_to_gbp_rate: number | null;
          report_count: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "partners_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      cfo_report_cost_by_report_dashboard: {
        Row: {
          ai_call_count: number | null;
          audition_id: string | null;
          commercial_metrics_excluded: boolean | null;
          cost_fx_source: string | null;
          credit_source: string | null;
          duration_status: string | null;
          estimated_ai_cost_gbp: number | null;
          estimated_ai_cost_usd: number | null;
          failed_call_count: number | null;
          fallback_call_count: number | null;
          funding_bucket: string | null;
          last_ai_usage_at: string | null;
          month_start: string | null;
          overall_score: number | null;
          partner_id: string | null;
          partner_name: string | null;
          partner_type: Database["public"]["Enums"]["partner_type"] | null;
          planning_usd_to_gbp_rate: number | null;
          repair_call_count: number | null;
          report_cost_source: string | null;
          report_created_at: string | null;
          take_id: string | null;
          take_status: string | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "takes_audition_id_fkey";
            columns: ["audition_id"];
            isOneToOne: false;
            referencedRelation: "auditions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partners_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      cfo_partner_revenue_source_dashboard: {
        Row: {
          allocated_credits: number | null;
          consumed_credits: number | null;
          package_billing_period: string | null;
          package_name: string | null;
          package_sku: string | null;
          package_unit_amount_pence: number | null;
          partner_credit_pool_id: string | null;
          partner_id: string | null;
          partner_name: string | null;
          partner_revenue_gbp: number | null;
          partner_revenue_pence: number | null;
          partner_revenue_source: string | null;
          partner_type: Database["public"]["Enums"]["partner_type"] | null;
          period_end: string | null;
          period_start: string | null;
          period_type: Database["public"]["Enums"]["partner_credit_pool_period_type"] | null;
          per_user_cap: number | null;
          pool_name: string | null;
          revenue_month: string | null;
          total_credits: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "partner_credit_pools_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      cfo_revenue_ledger_dashboard: {
        Row: {
          gross_revenue_pence: number | null;
          month_start: string | null;
          net_revenue_pence: number | null;
          partner_id: string | null;
          partner_name: string | null;
          partner_type: Database["public"]["Enums"]["partner_type"] | null;
          refunds_or_disputes_pence: number | null;
          revenue_source: string | null;
          revenue_stream: string | null;
          transaction_count: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "partners_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      cfo_partner_margin_dashboard: {
        Row: {
          estimated_ai_cost_gbp: number | null;
          estimated_ai_cost_usd: number | null;
          gross_margin_gbp: number | null;
          gross_margin_guardrail_status: string | null;
          gross_margin_rate: number | null;
          latest_report_cost_at: string | null;
          paid_pack_margin_guardrail: number | null;
          partner_funded_report_count: number | null;
          partner_id: string | null;
          partner_name: string | null;
          partner_revenue_gbp: number | null;
          partner_revenue_pence: number | null;
          partner_revenue_source: string | null;
          partner_type: Database["public"]["Enums"]["partner_type"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "partners_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      cfo_free_report_subsidy_dashboard: {
        Row: {
          average_free_report_cost_gbp: number | null;
          average_free_report_cost_usd: number | null;
          cost_fx_source: string | null;
          credit_source: string | null;
          duration_status: string | null;
          estimated_subsidy_cost_gbp: number | null;
          estimated_subsidy_cost_usd: number | null;
          free_report_count: number | null;
          month_start: string | null;
        };
        Relationships: [];
      };
      cfo_paid_credit_liability_summary: {
        Row: {
          catalogue_priced_grants: number | null;
          estimated_unused_paid_credit_liability_gbp: number | null;
          estimated_unused_paid_credit_liability_pence: number | null;
          liability_pricing_status: string | null;
          original_paid_credits: number | null;
          paid_credit_grant_count: number | null;
          payment_priced_grants: number | null;
          product_sku: string | null;
          unpriced_grants: number | null;
          unused_paid_credits: number | null;
        };
        Relationships: [];
      };
      cfo_monthly_burn_dashboard: {
        Row: {
          ai_variable_cost_gbp: number | null;
          break_even_gap_gbp: number | null;
          chatgpt_codex_monthly_cost_gbp: number | null;
          contribution_after_ai_cost_gbp: number | null;
          free_report_count: number | null;
          gross_revenue_gbp: number | null;
          lovable_monthly_cost_gbp: number | null;
          month_start: string | null;
          net_revenue_gbp: number | null;
          partner_funded_report_count: number | null;
          planning_fixed_monthly_burn_gbp: number | null;
          report_count: number | null;
          total_monthly_burn_gbp: number | null;
          user_paid_report_count: number | null;
        };
        Relationships: [];
      };
      cfo_revenue_milestone_dashboard: {
        Row: {
          current_month_net_revenue_gbp: number | null;
          milestone_gbp: number | null;
          month_start: string | null;
          progress_rate: number | null;
          reached: boolean | null;
          remaining_gbp: number | null;
        };
        Relationships: [];
      };
      report_credit_lifecycle_summary: {
        Row: {
          audition_id: string | null;
          commercial_metrics_excluded: boolean | null;
          consumed_at: string | null;
          consumption_ledger_entry_id: string | null;
          credit_amount: number | null;
          credit_grant_id: string | null;
          failure_code: string | null;
          refunded_at: string | null;
          release_reason: string | null;
          released_at: string | null;
          reservation_id: string | null;
          reserved_at: string | null;
          source: Database["public"]["Enums"]["credit_source"] | null;
          status: Database["public"]["Enums"]["report_credit_reservation_status"] | null;
          synthetic_usage: boolean | null;
          take_id: string | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "report_credit_reservations_audition_id_fkey";
            columns: ["audition_id"];
            isOneToOne: false;
            referencedRelation: "auditions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_credit_reservations_consumption_ledger_entry_id_fkey";
            columns: ["consumption_ledger_entry_id"];
            isOneToOne: false;
            referencedRelation: "credit_ledger_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_credit_reservations_credit_grant_id_fkey";
            columns: ["credit_grant_id"];
            isOneToOne: false;
            referencedRelation: "credit_grants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_credit_reservations_take_id_fkey";
            columns: ["take_id"];
            isOneToOne: false;
            referencedRelation: "takes";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_credit_pool_usage_summary: {
        Row: {
          allocated_credits: number;
          allocated_usage_percent: number;
          consumed_credits: number;
          name: string;
          overage_allowed: boolean;
          partner_credit_pool_id: string;
          partner_id: string;
          period_end: string;
          period_start: string;
          period_type: Database["public"]["Enums"]["partner_credit_pool_period_type"];
          per_user_cap: number;
          remaining_credits: number;
          status: Database["public"]["Enums"]["partner_credit_pool_status"];
          total_credits: number;
        };
        Relationships: [
          {
            foreignKeyName: "partner_credit_pools_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_aggregate_dashboard_summary: {
        Row: {
          active_member_count: number;
          average_latest_score: number | null;
          credits_used: number;
          latest_report_at: string | null;
          partner_id: string;
          partner_name: string;
          partner_type: Database["public"]["Enums"]["partner_type"];
          report_count: number;
        };
        Relationships: [
          {
            foreignKeyName: "partners_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_progress_dashboard_summary: {
        Row: {
          brief_visible: boolean;
          credits_used: number;
          fix_first_category: string | null;
          full_report_visible: boolean;
          latest_report_at: string | null;
          latest_score: number | null;
          leaderboard_visible: boolean;
          partner_id: string;
          partner_membership_id: string;
          partner_name: string;
          partner_type: Database["public"]["Enums"]["partner_type"];
          performer_name: string | null;
          readiness_band: string | null;
          report_count: number;
          report_dates: string[];
          score_trend: number | null;
          uploaded_media_visible: boolean;
          user_id: string;
          visibility_scope: Database["public"]["Enums"]["partner_visibility_scope"];
        };
        Relationships: [
          {
            foreignKeyName: "partner_memberships_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_visibility_acceptances_partner_membership_id_fkey";
            columns: ["partner_membership_id"];
            isOneToOne: false;
            referencedRelation: "partner_memberships";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      activate_partner_code: {
        Args: {
          p_activated_at: string;
          p_code_hash: string;
          p_idempotency_key: string | null;
          p_metadata: Json;
          p_user_email: string | null;
          p_user_id: string;
        };
        Returns: string;
      };
      accept_partner_visibility: {
        Args: {
          p_accepted_at: string;
          p_brief_sharing_enabled: boolean;
          p_full_report_sharing_enabled: boolean;
          p_idempotency_key: string | null;
          p_metadata: Json;
          p_parent_guardian_confirmed: boolean;
          p_partner_membership_id: string;
          p_uploaded_media_sharing_enabled: boolean;
          p_user_id: string;
          p_visibility_scope: Database["public"]["Enums"]["partner_visibility_scope"] | null;
        };
        Returns: string;
      };
      admin_top_up_partner_credit_pool: {
        Args: {
          p_admin_actor_user_id: string | null;
          p_credit_amount: number;
          p_idempotency_key: string | null;
          p_metadata: Json;
          p_partner_credit_pool_id: string;
          p_reason: string | null;
        };
        Returns: string;
      };
      admin_top_up_partner_membership: {
        Args: {
          p_admin_actor_user_id: string | null;
          p_cap_override: boolean;
          p_cap_override_reason: string | null;
          p_credit_amount: number;
          p_idempotency_key: string | null;
          p_metadata: Json;
          p_partner_membership_id: string;
          p_reason: string | null;
        };
        Returns: string;
      };
      allocate_partner_pool_credits: {
        Args: {
          p_allocated_at: string;
          p_cap_override: boolean;
          p_cap_override_reason: string | null;
          p_created_by_user_id: string | null;
          p_credit_amount: number;
          p_credit_grant_id: string | null;
          p_metadata: Json;
          p_partner_credit_pool_id: string;
          p_partner_membership_id: string | null;
          p_source: Database["public"]["Enums"]["partner_credit_allocation_source"];
          p_user_id: string;
        };
        Returns: string;
      };
      expire_partner_codes: {
        Args: {
          p_now: string;
        };
        Returns: number;
      };
      flag_partner_code_abuse: {
        Args: {
          p_admin_actor_user_id: string | null;
          p_now: string;
          p_partner_code_id: string;
          p_reason: string | null;
        };
        Returns: string;
      };
      get_effective_quota_config: {
        Args: never;
        Returns: {
          daily_submission_cap: number;
          max_takes_per_audition: number;
          quota_enabled: boolean;
        }[];
      };
      complete_consumer_credit_payment: {
        Args: {
          p_amount_total_pence: number | null;
          p_checkout_session_id: string | null;
          p_credit_amount: number | null;
          p_currency: string;
          p_event_type: Database["public"]["Enums"]["consumer_credit_revenue_event_type"];
          p_metadata: Json;
          p_payment_intent_id: string | null;
          p_product_sku: string | null;
          p_stripe_customer_id: string | null;
          p_stripe_event_id: string;
          p_stripe_price_id: string | null;
          p_user_id: string | null;
        };
        Returns: string | null;
      };
      consume_report_credit_reservation: {
        Args: {
          p_idempotency_key: string | null;
          p_metadata: Json;
          p_report_generated_at: string;
          p_reservation_id: string;
          p_take_id: string | null;
        };
        Returns: string | null;
      };
      grant_funded_credits: {
        Args: {
          p_admin_actor_user_id: string | null;
          p_admin_reason: string | null;
          p_credit_amount: number;
          p_expires_at: string | null;
          p_granted_at: string;
          p_idempotency_key: string | null;
          p_metadata: Json;
          p_source: Database["public"]["Enums"]["credit_source"];
          p_source_label: string | null;
          p_source_reference_id: string | null;
          p_source_reference_type: string | null;
          p_user_id: string;
        };
        Returns: string;
      };
      partner_credit_source: {
        Args: {
          p_partner_type: Database["public"]["Enums"]["partner_type"];
        };
        Returns: Database["public"]["Enums"]["credit_source"];
      };
      mark_consumer_credit_payment_failed: {
        Args: {
          p_amount_total_pence: number | null;
          p_checkout_session_id: string | null;
          p_credit_amount: number | null;
          p_currency: string;
          p_failure_code: string | null;
          p_metadata: Json;
          p_payment_intent_id: string | null;
          p_product_sku: string | null;
          p_stripe_event_id: string;
          p_stripe_price_id: string | null;
          p_user_id: string | null;
        };
        Returns: string | null;
      };
      partner_email_domain: {
        Args: {
          p_email: string;
        };
        Returns: string | null;
      };
      partner_default_visibility_scope: {
        Args: {
          p_partner_type: Database["public"]["Enums"]["partner_type"];
        };
        Returns: Database["public"]["Enums"]["partner_visibility_scope"];
      };
      record_partner_pool_alerts: {
        Args: {
          p_now: string;
          p_partner_credit_pool_id: string;
        };
        Returns: number;
      };
      revoke_partner_visibility_acceptance: {
        Args: {
          p_partner_visibility_acceptance_id: string;
          p_revocation_reason: string | null;
          p_revoked_at: string;
          p_revoked_by_user_id: string | null;
        };
        Returns: string;
      };
      record_admin_credit_adjustment: {
        Args: {
          p_admin_actor_user_id: string | null;
          p_admin_reason: string | null;
          p_credit_delta: number;
          p_credit_grant_id: string | null;
          p_idempotency_key: string | null;
          p_metadata: Json;
          p_source: Database["public"]["Enums"]["credit_source"];
          p_user_id: string;
        };
        Returns: string;
      };
      record_credit_consumption: {
        Args: {
          p_audition_id: string | null;
          p_credit_amount: number;
          p_credit_grant_id: string;
          p_idempotency_key: string | null;
          p_metadata: Json;
          p_report_generated_at: string;
          p_take_id: string | null;
          p_user_id: string;
        };
        Returns: string;
      };
      record_consumer_checkout_session: {
        Args: {
          p_amount_total_pence: number;
          p_credit_amount: number;
          p_currency: string;
          p_metadata: Json;
          p_product_sku: string;
          p_stripe_checkout_session_id: string;
          p_stripe_customer_id: string | null;
          p_stripe_price_id: string;
          p_user_id: string;
        };
        Returns: string;
      };
      release_report_credit_reservation: {
        Args: {
          p_failure_code: string | null;
          p_metadata: Json;
          p_release_reason: string | null;
          p_release_status: Database["public"]["Enums"]["report_credit_reservation_status"];
          p_reservation_id: string;
        };
        Returns: string;
      };
      reserve_report_credit_for_take: {
        Args: {
          p_idempotency_key: string | null;
          p_metadata: Json;
          p_requested_by_user_id: string | null;
          p_synthetic_usage: boolean;
          p_take_id: string;
        };
        Returns: string;
      };
      reverse_or_flag_consumer_credit_payment: {
        Args: {
          p_amount_pence: number | null;
          p_checkout_session_id: string | null;
          p_event_type: Database["public"]["Enums"]["consumer_credit_revenue_event_type"];
          p_metadata: Json;
          p_payment_intent_id: string | null;
          p_stripe_event_id: string;
        };
        Returns: string | null;
      };
      rotate_partner_code: {
        Args: {
          p_admin_actor_user_id: string | null;
          p_allowed_email_domains: string[] | null;
          p_allowance_credits: number | null;
          p_existing_code_id: string;
          p_expires_at: string | null;
          p_idempotency_key: string | null;
          p_max_activations: number | null;
          p_metadata: Json;
          p_new_code_display_hint: string;
          p_new_code_hash: string;
        };
        Returns: string;
      };
      set_partner_code_status: {
        Args: {
          p_admin_actor_user_id: string | null;
          p_now: string;
          p_partner_code_id: string;
          p_reason: string | null;
          p_status: Database["public"]["Enums"]["partner_code_status"];
        };
        Returns: string;
      };
    };
    Enums: {
      ai_usage_cost_source: "planning_baseline" | "duration_baseline" | "token_usage_available";
      ai_usage_status: "success" | "failure" | "timeout" | "cancelled";
      ai_usage_step:
        | "brief_extraction"
        | "evidence_pass"
        | "single_pass_report"
        | "report_polish"
        | "fallback"
        | "repair";
      consumer_credit_payment_status:
        | "checkout_created"
        | "checkout_completed"
        | "payment_succeeded"
        | "payment_failed"
        | "refunded"
        | "disputed"
        | "requires_review";
      consumer_credit_revenue_event_type:
        | "checkout_session_created"
        | "checkout_session_completed"
        | "payment_succeeded"
        | "payment_failed"
        | "refund"
        | "dispute";
      credit_grant_status: "active" | "exhausted" | "expired" | "revoked";
      credit_ledger_entry_type: "grant" | "consume" | "admin_adjustment" | "expiry_adjustment";
      credit_rollover_policy: "rollover" | "no_rollover" | "funding_period";
      credit_source:
        | "free_signup"
        | "free_monthly"
        | "school_funded"
        | "coach_funded"
        | "agent_funded"
        | "platform_funded"
        | "sponsor_campaign"
        | "user_paid"
        | "admin_grant";
      partner_credit_allocation_source:
        | "code_activation"
        | "admin_partner_top_up"
        | "admin_performer_top_up";
      partner_credit_pool_event_type:
        | "pool_created"
        | "partner_top_up"
        | "performer_allocation"
        | "performer_top_up"
        | "usage_alert";
      partner_credit_pool_period_type: "monthly" | "term" | "annual" | "fixed_campaign";
      partner_credit_pool_status: "active" | "paused" | "exhausted" | "expired" | "archived";
      partner_code_status: "active" | "paused" | "revoked" | "rotated" | "expired";
      partner_membership_status: "active" | "revoked" | "expired";
      partner_status: "active" | "paused" | "archived";
      partner_type: "school" | "coach" | "agent" | "sponsor" | "platform";
      partner_usage_alert_status: "triggered" | "acknowledged";
      partner_visibility_acceptance_status: "active" | "revoked";
      partner_visibility_scope: "aggregate_only" | "limited_usage_readiness" | "named_progress";
      report_credit_reservation_status: "reserved" | "consumed" | "released" | "refunded";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

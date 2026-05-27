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
            foreignKeyName: "partner_memberships_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
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
        ];
      };
    };
    Views: {
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
      partner_email_domain: {
        Args: {
          p_email: string;
        };
        Returns: string | null;
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
      partner_code_status: "active" | "paused" | "revoked" | "rotated" | "expired";
      partner_membership_status: "active" | "revoked" | "expired";
      partner_status: "active" | "paused" | "archived";
      partner_type: "school" | "coach" | "agent" | "sponsor" | "platform";
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

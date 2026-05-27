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
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_effective_quota_config: {
        Args: never;
        Returns: {
          daily_submission_cap: number;
          max_takes_per_audition: number;
          quota_enabled: boolean;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
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

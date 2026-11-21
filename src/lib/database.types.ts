export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      app_users: {
        Row: {
          clerk_user_id: string;
          created_at: string;
          id: string;
          role: string;
          status: string;
        };
        Insert: {
          clerk_user_id: string;
          created_at?: string;
          id?: string;
          role: string;
          status?: string;
        };
        Update: {
          clerk_user_id?: string;
          created_at?: string;
          id?: string;
          role?: string;
          status?: string;
        };
        Relationships: [];
      };
      applications: {
        Row: {
          created_at: string;
          id: string;
          influencer_id: string;
          opportunity_id: string;
          proposal: string;
          status: string;
          updated_at: string;
          work_urls: string[];
        };
        Insert: {
          created_at?: string;
          id?: string;
          influencer_id: string;
          opportunity_id: string;
          proposal: string;
          status?: string;
          updated_at?: string;
          work_urls?: string[];
        };
        Update: {
          created_at?: string;
          id?: string;
          influencer_id?: string;
          opportunity_id?: string;
          proposal?: string;
          status?: string;
          updated_at?: string;
          work_urls?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "applications_influencer_id_fkey";
            columns: ["influencer_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_profiles: {
        Row: {
          categories: string[];
          description: string;
          display_name: string;
          location: string;
          updated_at: string;
          user_id: string;
          website: string | null;
        };
        Insert: {
          categories: string[];
          description: string;
          display_name: string;
          location: string;
          updated_at?: string;
          user_id: string;
          website?: string | null;
        };
        Update: {
          categories?: string[];
          description?: string;
          display_name?: string;
          location?: string;
          updated_at?: string;
          user_id?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "brand_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      collaborations: {
        Row: {
          activated_at: string | null;
          agreement_expires_at: string;
          application_id: string;
          brand_id: string;
          created_at: string;
          ended_at: string | null;
          id: string;
          influencer_id: string;
          opportunity_id: string;
          status: string;
          terms: Json;
          terms_version: number;
        };
        Insert: {
          activated_at?: string | null;
          agreement_expires_at: string;
          application_id: string;
          brand_id: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          influencer_id: string;
          opportunity_id: string;
          status?: string;
          terms: Json;
          terms_version?: number;
        };
        Update: {
          activated_at?: string | null;
          agreement_expires_at?: string;
          application_id?: string;
          brand_id?: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          influencer_id?: string;
          opportunity_id?: string;
          status?: string;
          terms?: Json;
          terms_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "collaborations_application_id_opportunity_id_fkey";
            columns: ["application_id", "opportunity_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id", "opportunity_id"];
          },
          {
            foreignKeyName: "collaborations_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collaborations_influencer_id_fkey";
            columns: ["influencer_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collaborations_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      influencer_profiles: {
        Row: {
          bio: string;
          categories: string[];
          display_name: string;
          location: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bio: string;
          categories: string[];
          display_name: string;
          location: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bio?: string;
          categories?: string[];
          display_name?: string;
          location?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "influencer_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_events: {
        Row: {
          created_at: string;
          dedupe_key: string;
          id: string;
          kind: string;
          opportunity_id: string;
          recipient_id: string;
        };
        Insert: {
          created_at?: string;
          dedupe_key: string;
          id?: string;
          kind: string;
          opportunity_id: string;
          recipient_id: string;
        };
        Update: {
          created_at?: string;
          dedupe_key?: string;
          id?: string;
          kind?: string;
          opportunity_id?: string;
          recipient_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_events_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_events_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunities: {
        Row: {
          application_deadline: string;
          brand_id: string;
          brief: string;
          budget_minor: number;
          category: string;
          close_reason: string | null;
          created_at: string;
          currency: string;
          deliverables: Json;
          delivery_deadline: string;
          hidden_at: string | null;
          id: string;
          platforms: string[];
          published_at: string | null;
          revision_allowance: number;
          selection_until: string | null;
          status: string;
          title: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          application_deadline: string;
          brand_id: string;
          brief: string;
          budget_minor: number;
          category: string;
          close_reason?: string | null;
          created_at?: string;
          currency?: string;
          deliverables: Json;
          delivery_deadline: string;
          hidden_at?: string | null;
          id?: string;
          platforms: string[];
          published_at?: string | null;
          revision_allowance?: number;
          selection_until?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          application_deadline?: string;
          brand_id?: string;
          brief?: string;
          budget_minor?: number;
          category?: string;
          close_reason?: string | null;
          created_at?: string;
          currency?: string;
          deliverables?: Json;
          delivery_deadline?: string;
          hidden_at?: string | null;
          id?: string;
          platforms?: string[];
          published_at?: string | null;
          revision_allowance?: number;
          selection_until?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_history: {
        Row: {
          actor_id: string;
          created_at: string;
          id: string;
          opportunity_id: string;
          reason: string;
          snapshot: Json;
          version: number;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          id?: string;
          opportunity_id: string;
          reason: string;
          snapshot: Json;
          version: number;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          id?: string;
          opportunity_id?: string;
          reason?: string;
          snapshot?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunity_history_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      social_links: {
        Row: {
          follower_count: number | null;
          id: string;
          metrics_as_of: string | null;
          platform: string;
          url: string;
          user_id: string;
        };
        Insert: {
          follower_count?: number | null;
          id?: string;
          metrics_as_of?: string | null;
          platform: string;
          url: string;
          user_id: string;
        };
        Update: {
          follower_count?: number | null;
          id?: string;
          metrics_as_of?: string | null;
          platform?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_links_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "influencer_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_brand_onboarding: {
        Args: {
          p_categories: string[];
          p_description: string;
          p_display_name: string;
          p_location: string;
          p_website?: string;
        };
        Returns: undefined;
      };
      complete_influencer_onboarding: {
        Args: {
          p_bio: string;
          p_categories: string[];
          p_display_name: string;
          p_links: Json;
          p_location: string;
        };
        Returns: undefined;
      };
      marketplace_command: {
        Args: { p_action: string; p_data?: Json; p_id?: string };
        Returns: string;
      };
      marketplace_read: {
        Args: { p_filters?: Json; p_id?: string; p_kind: string };
        Returns: Json;
      };
      member_profile: { Args: { p_id: string }; Returns: Json };
      valid_social_url: {
        Args: { platform: string; url: string };
        Returns: boolean;
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

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

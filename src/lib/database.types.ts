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
      agreement_versions: {
        Row: {
          accepted_at: string | null;
          brand_confirmed_at: string | null;
          collaboration_id: string;
          created_at: string;
          influencer_confirmed_at: string | null;
          kind: string;
          proposed_by: string;
          status: string;
          terms: Json;
          version: number;
        };
        Insert: {
          accepted_at?: string | null;
          brand_confirmed_at?: string | null;
          collaboration_id: string;
          created_at?: string;
          influencer_confirmed_at?: string | null;
          kind: string;
          proposed_by: string;
          status: string;
          terms: Json;
          version: number;
        };
        Update: {
          accepted_at?: string | null;
          brand_confirmed_at?: string | null;
          collaboration_id?: string;
          created_at?: string;
          influencer_confirmed_at?: string | null;
          kind?: string;
          proposed_by?: string;
          status?: string;
          terms?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "agreement_versions_collaboration_id_fkey";
            columns: ["collaboration_id"];
            isOneToOne: false;
            referencedRelation: "collaborations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agreement_versions_proposed_by_fkey";
            columns: ["proposed_by"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
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
      audit_events: {
        Row: {
          actor_id: string | null;
          collaboration_id: string | null;
          created_at: string;
          id: string;
          kind: string;
          reason: string;
          report_id: string | null;
          target_user_id: string | null;
          visibility: string;
        };
        Insert: {
          actor_id?: string | null;
          collaboration_id?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          reason?: string;
          report_id?: string | null;
          target_user_id?: string | null;
          visibility?: string;
        };
        Update: {
          actor_id?: string | null;
          collaboration_id?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          reason?: string;
          report_id?: string | null;
          target_user_id?: string | null;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_collaboration_id_fkey";
            columns: ["collaboration_id"];
            isOneToOne: false;
            referencedRelation: "collaborations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "support_reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
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
      cancellation_requests: {
        Row: {
          collaboration_id: string;
          created_at: string;
          id: string;
          reason: string;
          requested_by: string;
          responded_at: string | null;
          responded_by: string | null;
          status: string;
          support_after: string;
        };
        Insert: {
          collaboration_id: string;
          created_at?: string;
          id: string;
          reason: string;
          requested_by: string;
          responded_at?: string | null;
          responded_by?: string | null;
          status?: string;
          support_after: string;
        };
        Update: {
          collaboration_id?: string;
          created_at?: string;
          id?: string;
          reason?: string;
          requested_by?: string;
          responded_at?: string | null;
          responded_by?: string | null;
          status?: string;
          support_after?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_collaboration_id_fkey";
            columns: ["collaboration_id"];
            isOneToOne: false;
            referencedRelation: "collaborations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cancellation_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cancellation_requests_responded_by_fkey";
            columns: ["responded_by"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      collaboration_attachments: {
        Row: {
          cleanup_attempts: number;
          cleanup_claim_until: string | null;
          cleanup_last_attempt_at: string | null;
          collaboration_id: string;
          content_type: string | null;
          created_at: string;
          filename: string;
          id: string;
          message_id: string | null;
          reserved_bytes: number;
          scanned_at: string | null;
          scanner_version: string | null;
          sha256: string | null;
          signature_at: string | null;
          signature_version: string | null;
          size_bytes: number | null;
          state: string;
          submission_id: string | null;
          uploaded_by: string;
        };
        Insert: {
          cleanup_attempts?: number;
          cleanup_claim_until?: string | null;
          cleanup_last_attempt_at?: string | null;
          collaboration_id: string;
          content_type?: string | null;
          created_at?: string;
          filename: string;
          id: string;
          message_id?: string | null;
          reserved_bytes: number;
          scanned_at?: string | null;
          scanner_version?: string | null;
          sha256?: string | null;
          signature_at?: string | null;
          signature_version?: string | null;
          size_bytes?: number | null;
          state?: string;
          submission_id?: string | null;
          uploaded_by: string;
        };
        Update: {
          cleanup_attempts?: number;
          cleanup_claim_until?: string | null;
          cleanup_last_attempt_at?: string | null;
          collaboration_id?: string;
          content_type?: string | null;
          created_at?: string;
          filename?: string;
          id?: string;
          message_id?: string | null;
          reserved_bytes?: number;
          scanned_at?: string | null;
          scanner_version?: string | null;
          sha256?: string | null;
          signature_at?: string | null;
          signature_version?: string | null;
          size_bytes?: number | null;
          state?: string;
          submission_id?: string | null;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collaboration_attachments_collaboration_id_fkey";
            columns: ["collaboration_id"];
            isOneToOne: false;
            referencedRelation: "collaborations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collaboration_attachments_message_id_collaboration_id_fkey";
            columns: ["message_id", "collaboration_id"];
            isOneToOne: false;
            referencedRelation: "collaboration_messages";
            referencedColumns: ["id", "collaboration_id"];
          },
          {
            foreignKeyName: "collaboration_attachments_submission_id_collaboration_id_fkey";
            columns: ["submission_id", "collaboration_id"];
            isOneToOne: false;
            referencedRelation: "collaboration_submissions";
            referencedColumns: ["id", "collaboration_id"];
          },
          {
            foreignKeyName: "collaboration_attachments_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      collaboration_items: {
        Row: {
          collaboration_id: string;
          id: string;
          revision_pending: boolean;
          revisions_used: number;
        };
        Insert: {
          collaboration_id: string;
          id?: string;
          revision_pending?: boolean;
          revisions_used?: number;
        };
        Update: {
          collaboration_id?: string;
          id?: string;
          revision_pending?: boolean;
          revisions_used?: number;
        };
        Relationships: [
          {
            foreignKeyName: "collaboration_items_collaboration_id_fkey";
            columns: ["collaboration_id"];
            isOneToOne: false;
            referencedRelation: "collaborations";
            referencedColumns: ["id"];
          },
        ];
      };
      collaboration_messages: {
        Row: {
          author_id: string;
          body: string;
          collaboration_id: string;
          created_at: string;
          hidden_at: string | null;
          hidden_reason: string | null;
          id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          collaboration_id: string;
          created_at?: string;
          hidden_at?: string | null;
          hidden_reason?: string | null;
          id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          collaboration_id?: string;
          created_at?: string;
          hidden_at?: string | null;
          hidden_reason?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collaboration_messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collaboration_messages_collaboration_id_fkey";
            columns: ["collaboration_id"];
            isOneToOne: false;
            referencedRelation: "collaborations";
            referencedColumns: ["id"];
          },
        ];
      };
      collaboration_submissions: {
        Row: {
          agreement_version: number;
          author_id: string;
          collaboration_id: string;
          created_at: string;
          id: string;
          items: Json;
          notes: string;
          version: number;
        };
        Insert: {
          agreement_version: number;
          author_id: string;
          collaboration_id: string;
          created_at?: string;
          id: string;
          items: Json;
          notes?: string;
          version: number;
        };
        Update: {
          agreement_version?: number;
          author_id?: string;
          collaboration_id?: string;
          created_at?: string;
          id?: string;
          items?: Json;
          notes?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "collaboration_submissions_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collaboration_submissions_collaboration_id_agreement_versi_fkey";
            columns: ["collaboration_id", "agreement_version"];
            isOneToOne: false;
            referencedRelation: "agreement_versions";
            referencedColumns: ["collaboration_id", "version"];
          },
          {
            foreignKeyName: "collaboration_submissions_collaboration_id_fkey";
            columns: ["collaboration_id"];
            isOneToOne: false;
            referencedRelation: "collaborations";
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
          current_proposal: number | null;
          effective_version: number | null;
          ended_at: string | null;
          id: string;
          influencer_id: string;
          latest_submission: string | null;
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
          current_proposal?: number | null;
          effective_version?: number | null;
          ended_at?: string | null;
          id?: string;
          influencer_id: string;
          latest_submission?: string | null;
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
          current_proposal?: number | null;
          effective_version?: number | null;
          ended_at?: string | null;
          id?: string;
          influencer_id?: string;
          latest_submission?: string | null;
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
            foreignKeyName: "collaborations_latest_submission_id_fkey";
            columns: ["latest_submission", "id"];
            isOneToOne: false;
            referencedRelation: "collaboration_submissions";
            referencedColumns: ["id", "collaboration_id"];
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
          collaboration_id: string | null;
          created_at: string;
          dedupe_key: string;
          id: string;
          kind: string;
          opportunity_id: string;
          processed_at: string | null;
          recipient_id: string;
          report_id: string | null;
        };
        Insert: {
          collaboration_id?: string | null;
          created_at?: string;
          dedupe_key: string;
          id?: string;
          kind: string;
          opportunity_id: string;
          processed_at?: string | null;
          recipient_id: string;
          report_id?: string | null;
        };
        Update: {
          collaboration_id?: string | null;
          created_at?: string;
          dedupe_key?: string;
          id?: string;
          kind?: string;
          opportunity_id?: string;
          processed_at?: string | null;
          recipient_id?: string;
          report_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_events_collaboration_id_fkey";
            columns: ["collaboration_id"];
            isOneToOne: false;
            referencedRelation: "collaborations";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "marketplace_events_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "support_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          collaboration_id: string | null;
          created_at: string;
          dedupe_key: string;
          id: string;
          kind: string;
          opportunity_id: string | null;
          read_at: string | null;
          recipient_id: string;
          report_id: string | null;
        };
        Insert: {
          collaboration_id?: string | null;
          created_at?: string;
          dedupe_key: string;
          id?: string;
          kind: string;
          opportunity_id?: string | null;
          read_at?: string | null;
          recipient_id: string;
          report_id?: string | null;
        };
        Update: {
          collaboration_id?: string | null;
          created_at?: string;
          dedupe_key?: string;
          id?: string;
          kind?: string;
          opportunity_id?: string | null;
          read_at?: string | null;
          recipient_id?: string;
          report_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_collaboration_id_fkey";
            columns: ["collaboration_id"];
            isOneToOne: false;
            referencedRelation: "collaborations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "support_reports";
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
      submission_reviews: {
        Row: {
          actor_id: string;
          created_at: string;
          decision: string;
          feedback: string;
          item_id: string;
          submission_id: string;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          decision: string;
          feedback?: string;
          item_id: string;
          submission_id: string;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          decision?: string;
          feedback?: string;
          item_id?: string;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "submission_reviews_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submission_reviews_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "collaboration_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submission_reviews_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "collaboration_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      support_reports: {
        Row: {
          assigned_admin: string | null;
          category: string;
          collaboration_id: string | null;
          created_at: string;
          description: string;
          id: string;
          internal_notes: string;
          member_id: string | null;
          opportunity_id: string | null;
          outcome: string;
          reporter_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          assigned_admin?: string | null;
          category: string;
          collaboration_id?: string | null;
          created_at?: string;
          description: string;
          id: string;
          internal_notes?: string;
          member_id?: string | null;
          opportunity_id?: string | null;
          outcome?: string;
          reporter_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          assigned_admin?: string | null;
          category?: string;
          collaboration_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          internal_notes?: string;
          member_id?: string | null;
          opportunity_id?: string | null;
          outcome?: string;
          reporter_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_reports_assigned_admin_fkey";
            columns: ["assigned_admin"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_reports_collaboration_id_fkey";
            columns: ["collaboration_id"];
            isOneToOne: false;
            referencedRelation: "collaborations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_reports_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_reports_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      attachment_access: {
        Args: { p_id: string; p_reason?: string; p_report?: string };
        Returns: Json;
      };
      attachment_worker: {
        Args: { p_action: string; p_data?: Json; p_id?: string };
        Returns: Json;
      };
      collaboration_command: {
        Args: { p_action: string; p_data?: Json; p_id: string };
        Returns: string;
      };
      collaboration_read: {
        Args: { p_filters?: Json; p_id?: string; p_kind: string };
        Returns: Json;
      };
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
      mark_notification: { Args: { p_id: string }; Returns: undefined };
      marketplace_command: {
        Args: { p_action: string; p_data?: Json; p_id?: string };
        Returns: string;
      };
      marketplace_read: {
        Args: { p_filters?: Json; p_id?: string; p_kind: string };
        Returns: Json;
      };
      member_profile: { Args: { p_id: string }; Returns: Json };
      support_case: {
        Args: { p_filters?: Json; p_id: string; p_reason: string };
        Returns: Json;
      };
      support_command: {
        Args: { p_action: string; p_data?: Json; p_id?: string };
        Returns: string;
      };
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

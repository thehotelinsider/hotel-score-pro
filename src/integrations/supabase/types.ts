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
      ai_recommendations: {
        Row: {
          created_at: string
          id: string
          model_used: string | null
          recommendation_text: string
          scan_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model_used?: string | null
          recommendation_text: string
          scan_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model_used?: string | null
          recommendation_text?: string
          scan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "hotel_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_leads: {
        Row: {
          created_at: string
          current_score: number | null
          email: string
          full_name: string
          hotel_name: string
          id: string
          phone: string
        }
        Insert: {
          created_at?: string
          current_score?: number | null
          email: string
          full_name: string
          hotel_name: string
          id?: string
          phone: string
        }
        Update: {
          created_at?: string
          current_score?: number | null
          email?: string
          full_name?: string
          hotel_name?: string
          id?: string
          phone?: string
        }
        Relationships: []
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
      hotel_scans: {
        Row: {
          competitors: Json | null
          created_at: string
          hotel_address: string | null
          hotel_city: string | null
          hotel_country: string | null
          hotel_description: string | null
          hotel_image_url: string | null
          hotel_name: string
          hotel_price_level: string | null
          hotel_rating: number | null
          hotel_review_count: number | null
          hotel_state: string | null
          id: string
          issues: Json | null
          photos: Json | null
          rankings: Json | null
          reviews: Json | null
          score_ota: number | null
          score_overall: number | null
          score_reviews: number | null
          score_seo: number | null
          score_social_media: number | null
          score_website: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          competitors?: Json | null
          created_at?: string
          hotel_address?: string | null
          hotel_city?: string | null
          hotel_country?: string | null
          hotel_description?: string | null
          hotel_image_url?: string | null
          hotel_name: string
          hotel_price_level?: string | null
          hotel_rating?: number | null
          hotel_review_count?: number | null
          hotel_state?: string | null
          id?: string
          issues?: Json | null
          photos?: Json | null
          rankings?: Json | null
          reviews?: Json | null
          score_ota?: number | null
          score_overall?: number | null
          score_reviews?: number | null
          score_seo?: number | null
          score_social_media?: number | null
          score_website?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          competitors?: Json | null
          created_at?: string
          hotel_address?: string | null
          hotel_city?: string | null
          hotel_country?: string | null
          hotel_description?: string | null
          hotel_image_url?: string | null
          hotel_name?: string
          hotel_price_level?: string | null
          hotel_rating?: number | null
          hotel_review_count?: number | null
          hotel_state?: string | null
          id?: string
          issues?: Json | null
          photos?: Json | null
          rankings?: Json | null
          reviews?: Json | null
          score_ota?: number | null
          score_overall?: number | null
          score_reviews?: number | null
          score_seo?: number | null
          score_social_media?: number | null
          score_website?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_scans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_shares: {
        Row: {
          download_url: string | null
          hotel_name: string
          id: string
          recipient_email: string
          sent_at: string
        }
        Insert: {
          download_url?: string | null
          hotel_name: string
          id?: string
          recipient_email: string
          sent_at?: string
        }
        Update: {
          download_url?: string | null
          hotel_name?: string
          id?: string
          recipient_email?: string
          sent_at?: string
        }
        Relationships: []
      }
      shared_reports: {
        Row: {
          competitors: Json | null
          created_at: string
          hotel_address: string | null
          hotel_city: string | null
          hotel_country: string | null
          hotel_image_url: string | null
          hotel_name: string
          hotel_rating: number | null
          hotel_review_count: number | null
          hotel_state: string | null
          id: string
          issues: Json | null
          rankings: Json | null
          score_ota: number | null
          score_overall: number | null
          score_reviews: number | null
          score_seo: number | null
          score_social_media: number | null
          score_website: number | null
        }
        Insert: {
          competitors?: Json | null
          created_at?: string
          hotel_address?: string | null
          hotel_city?: string | null
          hotel_country?: string | null
          hotel_image_url?: string | null
          hotel_name: string
          hotel_rating?: number | null
          hotel_review_count?: number | null
          hotel_state?: string | null
          id?: string
          issues?: Json | null
          rankings?: Json | null
          score_ota?: number | null
          score_overall?: number | null
          score_reviews?: number | null
          score_seo?: number | null
          score_social_media?: number | null
          score_website?: number | null
        }
        Update: {
          competitors?: Json | null
          created_at?: string
          hotel_address?: string | null
          hotel_city?: string | null
          hotel_country?: string | null
          hotel_image_url?: string | null
          hotel_name?: string
          hotel_rating?: number | null
          hotel_review_count?: number | null
          hotel_state?: string | null
          id?: string
          issues?: Json | null
          rankings?: Json | null
          score_ota?: number | null
          score_overall?: number | null
          score_reviews?: number | null
          score_seo?: number | null
          score_social_media?: number | null
          score_website?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          email: string
          full_name: string
          hotel_name: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          hotel_name: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          hotel_name?: string
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
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
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

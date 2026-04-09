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
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          read: boolean
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          read?: boolean
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          read?: boolean
          subject?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          duration: string | null
          id: string
          lessons_count: number | null
          level: string | null
          price: number | null
          published: boolean | null
          teacher_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          lessons_count?: number | null
          level?: string | null
          price?: number | null
          published?: boolean | null
          teacher_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          lessons_count?: number | null
          level?: string | null
          price?: number | null
          published?: boolean | null
          teacher_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_solutions: {
        Row: {
          admin_approved: boolean | null
          carousel_cover_url: string | null
          created_at: string
          description: string | null
          id: string
          platform_percentage: number | null
          price: number | null
          published: boolean | null
          teacher_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          admin_approved?: boolean | null
          carousel_cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          platform_percentage?: number | null
          price?: number | null
          published?: boolean | null
          teacher_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          admin_approved?: boolean | null
          carousel_cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          platform_percentage?: number | null
          price?: number | null
          published?: boolean | null
          teacher_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      free_trials: {
        Row: {
          active: boolean
          created_at: string
          id: string
          started_at: string
          trial_days: number
          trial_type: string
          trial_videos: number
          updated_at: string
          user_id: string
          videos_watched: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          started_at?: string
          trial_days?: number
          trial_type?: string
          trial_videos?: number
          updated_at?: string
          user_id: string
          videos_watched?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          started_at?: string
          trial_days?: number
          trial_type?: string
          trial_videos?: number
          updated_at?: string
          user_id?: string
          videos_watched?: number
        }
        Relationships: []
      }
      lessons: {
        Row: {
          admin_approved: boolean | null
          carousel_cover_url: string | null
          created_at: string
          description: string | null
          id: string
          platform_percentage: number | null
          price: number | null
          published: boolean | null
          teacher_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          admin_approved?: boolean | null
          carousel_cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          platform_percentage?: number | null
          price?: number | null
          published?: boolean | null
          teacher_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          admin_approved?: boolean | null
          carousel_cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          platform_percentage?: number | null
          price?: number | null
          published?: boolean | null
          teacher_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string
          expertise_area: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email: string
          expertise_area?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          expertise_area?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_payments: {
        Row: {
          avg_rating: number | null
          created_at: string
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          payment_type: string
          period_end: string
          period_start: string
          platform_fee: number
          status: string
          teacher_id: string
          total_views: number | null
          updated_at: string
        }
        Insert: {
          avg_rating?: number | null
          created_at?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          payment_type?: string
          period_end: string
          period_start: string
          platform_fee?: number
          status?: string
          teacher_id: string
          total_views?: number | null
          updated_at?: string
        }
        Update: {
          avg_rating?: number | null
          created_at?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          payment_type?: string
          period_end?: string
          period_start?: string
          platform_fee?: number
          status?: string
          teacher_id?: string
          total_views?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_purchases: {
        Row: {
          amount: number
          content_id: string
          content_type: string
          created_at: string
          id: string
          payment_status: string
          stripe_payment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          payment_status?: string
          stripe_payment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          payment_status?: string
          stripe_payment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_ratings: {
        Row: {
          comment: string | null
          content_id: string
          content_type: string
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_views: {
        Row: {
          content_id: string
          content_type: string
          id: string
          user_id: string
          viewed_at: string
          watch_percentage: number
        }
        Insert: {
          content_id: string
          content_type: string
          id?: string
          user_id: string
          viewed_at?: string
          watch_percentage?: number
        }
        Update: {
          content_id?: string
          content_type?: string
          id?: string
          user_id?: string
          viewed_at?: string
          watch_percentage?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_course_owner: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "admin"
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
      app_role: ["student", "teacher", "admin"],
    },
  },
} as const

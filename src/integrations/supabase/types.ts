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
      course_areas: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          id: string
          name: string
          show_on_homepage: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          show_on_homepage?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          show_on_homepage?: boolean
          sort_order?: number
          updated_at?: string
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
      email_templates: {
        Row: {
          body_html: string
          created_at: string
          id: string
          logo_url: string | null
          show_social_footer: boolean
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          body_html?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          show_social_footer?: boolean
          subject?: string
          template_key: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          show_social_footer?: boolean
          subject?: string
          template_key?: string
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
      exam_solutions: {
        Row: {
          admin_approved: boolean | null
          areas: string[] | null
          aula_particular_url: string | null
          carousel_cover_url: string | null
          colinha_url: string | null
          created_at: string
          description: string | null
          duvidas_url: string | null
          id: string
          platform_percentage: number | null
          price: number | null
          published: boolean | null
          resumo_url: string | null
          simulado_url: string | null
          teacher_id: string
          thumbnail_url: string | null
          title: string
          top_questoes_url: string | null
          updated_at: string
          video_type: string
          video_url: string | null
        }
        Insert: {
          admin_approved?: boolean | null
          areas?: string[] | null
          aula_particular_url?: string | null
          carousel_cover_url?: string | null
          colinha_url?: string | null
          created_at?: string
          description?: string | null
          duvidas_url?: string | null
          id?: string
          platform_percentage?: number | null
          price?: number | null
          published?: boolean | null
          resumo_url?: string | null
          simulado_url?: string | null
          teacher_id: string
          thumbnail_url?: string | null
          title: string
          top_questoes_url?: string | null
          updated_at?: string
          video_type?: string
          video_url?: string | null
        }
        Update: {
          admin_approved?: boolean | null
          areas?: string[] | null
          aula_particular_url?: string | null
          carousel_cover_url?: string | null
          colinha_url?: string | null
          created_at?: string
          description?: string | null
          duvidas_url?: string | null
          id?: string
          platform_percentage?: number | null
          price?: number | null
          published?: boolean | null
          resumo_url?: string | null
          simulado_url?: string | null
          teacher_id?: string
          thumbnail_url?: string | null
          title?: string
          top_questoes_url?: string | null
          updated_at?: string
          video_type?: string
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
          areas: string[] | null
          aula_particular_url: string | null
          carousel_cover_url: string | null
          colinha_url: string | null
          created_at: string
          description: string | null
          duvidas_url: string | null
          id: string
          platform_percentage: number | null
          price: number | null
          published: boolean | null
          resumo_url: string | null
          simulado_url: string | null
          teacher_id: string
          thumbnail_url: string | null
          title: string
          top_questoes_url: string | null
          updated_at: string
          video_type: string
          video_url: string | null
        }
        Insert: {
          admin_approved?: boolean | null
          areas?: string[] | null
          aula_particular_url?: string | null
          carousel_cover_url?: string | null
          colinha_url?: string | null
          created_at?: string
          description?: string | null
          duvidas_url?: string | null
          id?: string
          platform_percentage?: number | null
          price?: number | null
          published?: boolean | null
          resumo_url?: string | null
          simulado_url?: string | null
          teacher_id: string
          thumbnail_url?: string | null
          title: string
          top_questoes_url?: string | null
          updated_at?: string
          video_type?: string
          video_url?: string | null
        }
        Update: {
          admin_approved?: boolean | null
          areas?: string[] | null
          aula_particular_url?: string | null
          carousel_cover_url?: string | null
          colinha_url?: string | null
          created_at?: string
          description?: string | null
          duvidas_url?: string | null
          id?: string
          platform_percentage?: number | null
          price?: number | null
          published?: boolean | null
          resumo_url?: string | null
          simulado_url?: string | null
          teacher_id?: string
          thumbnail_url?: string | null
          title?: string
          top_questoes_url?: string | null
          updated_at?: string
          video_type?: string
          video_url?: string | null
        }
        Relationships: []
      }
      phone_verifications: {
        Row: {
          channel: string
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          user_id: string
          verified: boolean
        }
        Insert: {
          channel?: string
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          user_id: string
          verified?: boolean
        }
        Update: {
          channel?: string
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          user_id?: string
          verified?: boolean
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
          areas: string[] | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string
          email: string
          email_verified: boolean | null
          expertise_area: string | null
          id: string
          name: string
          phone: string | null
          profile_title: string | null
          slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          areas?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          email: string
          email_verified?: boolean | null
          expertise_area?: string | null
          id?: string
          name: string
          phone?: string | null
          profile_title?: string | null
          slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          areas?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string
          email_verified?: boolean | null
          expertise_area?: string | null
          id?: string
          name?: string
          phone?: string | null
          profile_title?: string | null
          slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prova_votes: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          user_id: string
          vote: boolean
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          user_id: string
          vote: boolean
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          user_id?: string
          vote?: boolean
        }
        Relationships: []
      }
      resource_prices: {
        Row: {
          active: boolean
          id: string
          price: number
          resource_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          id?: string
          price?: number
          resource_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          id?: string
          price?: number
          resource_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      resource_usage: {
        Row: {
          accessed_at: string
          content_id: string | null
          content_type: string | null
          created_at: string
          duration_seconds: number
          id: string
          resource_type: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          accessed_at?: string
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          resource_type: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          accessed_at?: string
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          resource_type?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_usage_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "student_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_doubts: {
        Row: {
          answer: string | null
          answered_at: string | null
          approved_at: string | null
          content_id: string
          content_type: string
          created_at: string
          id: string
          question: string
          status: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          approved_at?: string | null
          content_id: string
          content_type?: string
          created_at?: string
          id?: string
          question: string
          status?: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          approved_at?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          question?: string
          status?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan_id: string
          started_at: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id: string
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id?: string
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          cancel_text: string | null
          checkout_url: string | null
          created_at: string
          features: string[]
          highlighted: boolean
          id: string
          name: string
          price: number
          service_aula_particular: boolean
          service_aula_particular_qty: number
          service_colinhas: boolean
          service_colinhas_qty: number
          service_duvidas: boolean
          service_duvidas_qty: number
          service_resumos: boolean
          service_resumos_qty: number
          service_revisoes: boolean
          service_revisoes_qty: number
          service_simulados: boolean
          service_simulados_qty: number
          service_top_questoes: boolean
          service_top_questoes_qty: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          cancel_text?: string | null
          checkout_url?: string | null
          created_at?: string
          features?: string[]
          highlighted?: boolean
          id?: string
          name: string
          price?: number
          service_aula_particular?: boolean
          service_aula_particular_qty?: number
          service_colinhas?: boolean
          service_colinhas_qty?: number
          service_duvidas?: boolean
          service_duvidas_qty?: number
          service_resumos?: boolean
          service_resumos_qty?: number
          service_revisoes?: boolean
          service_revisoes_qty?: number
          service_simulados?: boolean
          service_simulados_qty?: number
          service_top_questoes?: boolean
          service_top_questoes_qty?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          cancel_text?: string | null
          checkout_url?: string | null
          created_at?: string
          features?: string[]
          highlighted?: boolean
          id?: string
          name?: string
          price?: number
          service_aula_particular?: boolean
          service_aula_particular_qty?: number
          service_colinhas?: boolean
          service_colinhas_qty?: number
          service_duvidas?: boolean
          service_duvidas_qty?: number
          service_resumos?: boolean
          service_resumos_qty?: number
          service_revisoes?: boolean
          service_revisoes_qty?: number
          service_simulados?: boolean
          service_simulados_qty?: number
          service_top_questoes?: boolean
          service_top_questoes_qty?: number
          sort_order?: number
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
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
      is_teacher: { Args: { _user_id: string }; Returns: boolean }
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

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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          target_id: string | null
          target_table: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      birthday_email_log: {
        Row: {
          coupon_code: string | null
          coupon_included: boolean
          created_at: string
          id: string
          is_active_subscriber: boolean
          metadata: Json | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string
          template_key: string
          user_id: string
        }
        Insert: {
          coupon_code?: string | null
          coupon_included?: boolean
          created_at?: string
          id?: string
          is_active_subscriber?: boolean
          metadata?: Json | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string
          template_key: string
          user_id: string
        }
        Update: {
          coupon_code?: string | null
          coupon_included?: boolean
          created_at?: string
          id?: string
          is_active_subscriber?: boolean
          metadata?: Json | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string
          template_key?: string
          user_id?: string
        }
        Relationships: []
      }
      cashback_accounts: {
        Row: {
          balance_available: number
          balance_pending: number
          created_at: string
          current_tier: string
          id: string
          referral_code: string | null
          total_earned: number
          total_expired: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_available?: number
          balance_pending?: number
          created_at?: string
          current_tier?: string
          id?: string
          referral_code?: string | null
          total_earned?: number
          total_expired?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_available?: number
          balance_pending?: number
          created_at?: string
          current_tier?: string
          id?: string
          referral_code?: string | null
          total_earned?: number
          total_expired?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cashback_referrals: {
        Row: {
          created_at: string
          first_purchase_amount: number | null
          first_purchase_at: string | null
          id: string
          referral_code_used: string
          referred_user_id: string
          referrer_user_id: string
          reward_amount: number
          rewarded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_purchase_amount?: number | null
          first_purchase_at?: string | null
          id?: string
          referral_code_used: string
          referred_user_id: string
          referrer_user_id: string
          reward_amount?: number
          rewarded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_purchase_amount?: number | null
          first_purchase_at?: string | null
          id?: string
          referral_code_used?: string
          referred_user_id?: string
          referrer_user_id?: string
          reward_amount?: number
          rewarded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      cashback_transactions: {
        Row: {
          account_id: string
          admin_id: string | null
          amount: number
          available_at: string | null
          consumed_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          metadata: Json
          notes: string | null
          referred_user_id: string | null
          source_purchase_amount: number | null
          source_reference: string | null
          source_type: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          admin_id?: string | null
          amount: number
          available_at?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: string
          metadata?: Json
          notes?: string | null
          referred_user_id?: string | null
          source_purchase_amount?: number | null
          source_reference?: string | null
          source_type?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          admin_id?: string | null
          amount?: number
          available_at?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          metadata?: Json
          notes?: string | null
          referred_user_id?: string | null
          source_purchase_amount?: number | null
          source_reference?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashback_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "cashback_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      commitment_penalty_refunds: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          original_penalty_amount: number
          reason: string | null
          refund_amount: number
          refund_type: string
          status: string
          stripe_charge_id: string | null
          stripe_refund_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          original_penalty_amount?: number
          reason?: string | null
          refund_amount?: number
          refund_type?: string
          status?: string
          stripe_charge_id?: string | null
          stripe_refund_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          original_penalty_amount?: number
          reason?: string | null
          refund_amount?: number
          refund_type?: string
          status?: string
          stripe_charge_id?: string | null
          stripe_refund_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      doubt_messages: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string
          doubt_id: string
          id: string
          message_kind: string
          rejection_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          author_id: string
          author_role: string
          body: string
          created_at?: string
          doubt_id: string
          id?: string
          message_kind: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          doubt_id?: string
          id?: string
          message_kind?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubt_messages_doubt_id_fkey"
            columns: ["doubt_id"]
            isOneToOne: false
            referencedRelation: "student_doubts"
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
      email_templates: {
        Row: {
          always_send: boolean
          body_html: string
          button_color: string
          button_text_color: string
          coupon_code: string
          coupon_enabled: boolean
          coupon_expires_at: string | null
          coupon_message: string
          coupon_starts_at: string | null
          created_at: string
          font_family: string
          from_email: string
          from_name: string
          heading_color: string
          id: string
          link_color: string
          logo_url: string | null
          logo_variant: string
          respect_marketing_preference: boolean
          show_social_footer: boolean
          slogan_color: string
          subject: string
          template_key: string
          text_color: string
          updated_at: string
          use_uploaded_logo: boolean
        }
        Insert: {
          always_send?: boolean
          body_html?: string
          button_color?: string
          button_text_color?: string
          coupon_code?: string
          coupon_enabled?: boolean
          coupon_expires_at?: string | null
          coupon_message?: string
          coupon_starts_at?: string | null
          created_at?: string
          font_family?: string
          from_email?: string
          from_name?: string
          heading_color?: string
          id?: string
          link_color?: string
          logo_url?: string | null
          logo_variant?: string
          respect_marketing_preference?: boolean
          show_social_footer?: boolean
          slogan_color?: string
          subject?: string
          template_key: string
          text_color?: string
          updated_at?: string
          use_uploaded_logo?: boolean
        }
        Update: {
          always_send?: boolean
          body_html?: string
          button_color?: string
          button_text_color?: string
          coupon_code?: string
          coupon_enabled?: boolean
          coupon_expires_at?: string | null
          coupon_message?: string
          coupon_starts_at?: string | null
          created_at?: string
          font_family?: string
          from_email?: string
          from_name?: string
          heading_color?: string
          id?: string
          link_color?: string
          logo_url?: string | null
          logo_variant?: string
          respect_marketing_preference?: boolean
          show_social_footer?: boolean
          slogan_color?: string
          subject?: string
          template_key?: string
          text_color?: string
          updated_at?: string
          use_uploaded_logo?: boolean
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
          preview_sprite_url: string | null
          preview_status: string
          preview_vtt_url: string | null
          price: number | null
          price_colinhas: number | null
          price_resumos: number | null
          price_revisoes: number | null
          price_simulados: number | null
          price_top_questoes: number | null
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
          preview_sprite_url?: string | null
          preview_status?: string
          preview_vtt_url?: string | null
          price?: number | null
          price_colinhas?: number | null
          price_resumos?: number | null
          price_revisoes?: number | null
          price_simulados?: number | null
          price_top_questoes?: number | null
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
          preview_sprite_url?: string | null
          preview_status?: string
          preview_vtt_url?: string | null
          price?: number | null
          price_colinhas?: number | null
          price_resumos?: number | null
          price_revisoes?: number | null
          price_simulados?: number | null
          price_top_questoes?: number | null
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
      lesson_cheatsheet_items: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          position: number
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          position?: number
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          position?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_cheatsheet_items_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_material_meta: {
        Row: {
          admin_approved: boolean
          created_at: string
          id: string
          lesson_id: string
          material_type: string
          offered: boolean
          price: number
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_for_review: boolean
          updated_at: string
        }
        Insert: {
          admin_approved?: boolean
          created_at?: string
          id?: string
          lesson_id: string
          material_type: string
          offered?: boolean
          price?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_for_review?: boolean
          updated_at?: string
        }
        Update: {
          admin_approved?: boolean
          created_at?: string
          id?: string
          lesson_id?: string
          material_type?: string
          offered?: boolean
          price?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_for_review?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_material_meta_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_quiz_questions: {
        Row: {
          correct_index: number
          created_at: string
          id: string
          lesson_id: string
          options: Json
          position: number
          question: string
          updated_at: string
        }
        Insert: {
          correct_index?: number
          created_at?: string
          id?: string
          lesson_id: string
          options?: Json
          position?: number
          question: string
          updated_at?: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          id?: string
          lesson_id?: string
          options?: Json
          position?: number
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_quiz_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_reminder_preferences: {
        Row: {
          alternate_phone: string | null
          channel: string
          created_at: string
          id: string
          preferred_windows_hours: number[]
          updated_at: string
          user_id: string
        }
        Insert: {
          alternate_phone?: string | null
          channel?: string
          created_at?: string
          id?: string
          preferred_windows_hours?: number[]
          updated_at?: string
          user_id: string
        }
        Update: {
          alternate_phone?: string | null
          channel?: string
          created_at?: string
          id?: string
          preferred_windows_hours?: number[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lesson_summaries: {
        Row: {
          content: string
          created_at: string
          id: string
          lesson_id: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          lesson_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lesson_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_summaries_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_top_questions: {
        Row: {
          answer: string
          created_at: string
          id: string
          lesson_id: string
          position: number
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          lesson_id: string
          position?: number
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          lesson_id?: string
          position?: number
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_top_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
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
          preview_sprite_url: string | null
          preview_status: string
          preview_vtt_url: string | null
          price: number | null
          price_colinhas: number | null
          price_resumos: number | null
          price_revisoes: number | null
          price_simulados: number | null
          price_top_questoes: number | null
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
          preview_sprite_url?: string | null
          preview_status?: string
          preview_vtt_url?: string | null
          price?: number | null
          price_colinhas?: number | null
          price_resumos?: number | null
          price_revisoes?: number | null
          price_simulados?: number | null
          price_top_questoes?: number | null
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
          preview_sprite_url?: string | null
          preview_status?: string
          preview_vtt_url?: string | null
          price?: number | null
          price_colinhas?: number | null
          price_resumos?: number | null
          price_revisoes?: number | null
          price_simulados?: number | null
          price_top_questoes?: number | null
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
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      material_access_log: {
        Row: {
          accessed_at: string
          id: string
          lesson_id: string
          material_type: string
          teacher_id: string
          user_id: string
          via_subscription: boolean
        }
        Insert: {
          accessed_at?: string
          id?: string
          lesson_id: string
          material_type: string
          teacher_id: string
          user_id: string
          via_subscription?: boolean
        }
        Update: {
          accessed_at?: string
          id?: string
          lesson_id?: string
          material_type?: string
          teacher_id?: string
          user_id?: string
          via_subscription?: boolean
        }
        Relationships: []
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used: boolean
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used?: boolean
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      phone_verifications: {
        Row: {
          channel: string
          code: string
          code_hash: string
          created_at: string
          expires_at: string
          failed_attempts: number
          id: string
          invalidated: boolean
          phone: string
          user_id: string
          verified: boolean
        }
        Insert: {
          channel?: string
          code?: string
          code_hash: string
          created_at?: string
          expires_at?: string
          failed_attempts?: number
          id?: string
          invalidated?: boolean
          phone: string
          user_id: string
          verified?: boolean
        }
        Update: {
          channel?: string
          code?: string
          code_hash?: string
          created_at?: string
          expires_at?: string
          failed_attempts?: number
          id?: string
          invalidated?: boolean
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
      pool_runs: {
        Row: {
          config_snapshot: Json | null
          created_at: string
          id: string
          net_revenue: number
          notes: string | null
          period_end: string
          period_start: string
          pool_amount: number
          ran_by: string | null
          status: string
          subscription_gross_revenue: number
          taxes_amount: number
          total_distributed: number
          total_minutes: number
          total_unique_accesses: number
          updated_at: string
        }
        Insert: {
          config_snapshot?: Json | null
          created_at?: string
          id?: string
          net_revenue?: number
          notes?: string | null
          period_end: string
          period_start: string
          pool_amount?: number
          ran_by?: string | null
          status?: string
          subscription_gross_revenue?: number
          taxes_amount?: number
          total_distributed?: number
          total_minutes?: number
          total_unique_accesses?: number
          updated_at?: string
        }
        Update: {
          config_snapshot?: Json | null
          created_at?: string
          id?: string
          net_revenue?: number
          notes?: string | null
          period_end?: string
          period_start?: string
          pool_amount?: number
          ran_by?: string | null
          status?: string
          subscription_gross_revenue?: number
          taxes_amount?: number
          total_distributed?: number
          total_minutes?: number
          total_unique_accesses?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accepts_marketing: boolean
          active: boolean
          address: string | null
          areas: string[] | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          content_order: Json
          cpf: string | null
          created_at: string
          education: Json
          email: string
          email_verified: boolean | null
          experiences: Json
          expertise_area: string | null
          id: string
          monthly_content_goal: number | null
          name: string
          phone: string | null
          phone_verified: boolean
          pix_key: string | null
          profile_title: string | null
          referral_code: number | null
          slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accepts_marketing?: boolean
          active?: boolean
          address?: string | null
          areas?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          content_order?: Json
          cpf?: string | null
          created_at?: string
          education?: Json
          email: string
          email_verified?: boolean | null
          experiences?: Json
          expertise_area?: string | null
          id?: string
          monthly_content_goal?: number | null
          name: string
          phone?: string | null
          phone_verified?: boolean
          pix_key?: string | null
          profile_title?: string | null
          referral_code?: number | null
          slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accepts_marketing?: boolean
          active?: boolean
          address?: string | null
          areas?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          content_order?: Json
          cpf?: string | null
          created_at?: string
          education?: Json
          email?: string
          email_verified?: boolean | null
          experiences?: Json
          expertise_area?: string | null
          id?: string
          monthly_content_goal?: number | null
          name?: string
          phone?: string | null
          phone_verified?: boolean
          pix_key?: string | null
          profile_title?: string | null
          referral_code?: number | null
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
      recompute_runs: {
        Row: {
          buckets_count: number
          created_at: string
          dry_run: boolean
          duration_ms: number | null
          error_message: string | null
          id: string
          inserted_count: number
          period_end: string
          period_start: string
          purchases_processed: number
          purchases_skipped: number
          results: Json
          skipped_paid_count: number
          source: string
          status: string
          teacher_id: string | null
          triggered_by: string | null
          updated_count: number
        }
        Insert: {
          buckets_count?: number
          created_at?: string
          dry_run?: boolean
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          inserted_count?: number
          period_end: string
          period_start: string
          purchases_processed?: number
          purchases_skipped?: number
          results?: Json
          skipped_paid_count?: number
          source?: string
          status?: string
          teacher_id?: string | null
          triggered_by?: string | null
          updated_count?: number
        }
        Update: {
          buckets_count?: number
          created_at?: string
          dry_run?: boolean
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          inserted_count?: number
          period_end?: string
          period_start?: string
          purchases_processed?: number
          purchases_skipped?: number
          results?: Json
          skipped_paid_count?: number
          source?: string
          status?: string
          teacher_id?: string | null
          triggered_by?: string | null
          updated_count?: number
        }
        Relationships: []
      }
      reengagement_email_log: {
        Row: {
          created_at: string
          days_inactive: number | null
          id: string
          metadata: Json | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string
          template_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_inactive?: number | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string
          template_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_inactive?: number | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string
          template_key?: string
          user_id?: string
        }
        Relationships: []
      }
      reserved_referral_codes: {
        Row: {
          created_at: string
          id: string
          original_user_email: string | null
          reason: string
          referral_code: number
        }
        Insert: {
          created_at?: string
          id?: string
          original_user_email?: string | null
          reason?: string
          referral_code: number
        }
        Update: {
          created_at?: string
          id?: string
          original_user_email?: string | null
          reason?: string
          referral_code?: number
        }
        Relationships: []
      }
      resource_prices: {
        Row: {
          active: boolean
          id: string
          min_price: number
          platform_percentage: number
          price: number
          resource_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          id?: string
          min_price?: number
          platform_percentage?: number
          price?: number
          resource_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          id?: string
          min_price?: number
          platform_percentage?: number
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
      scheduled_lesson_reminders: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          lesson_id: string
          recipient_type: string
          recipient_user_id: string
          reminder_hours: number
          status: string
          twilio_sid: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          lesson_id: string
          recipient_type: string
          recipient_user_id: string
          reminder_hours: number
          status?: string
          twilio_sid?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          lesson_id?: string
          recipient_type?: string
          recipient_user_id?: string
          reminder_hours?: number
          status?: string
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_lesson_reminders_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "scheduled_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_lessons: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          content_id: string | null
          content_type: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          meeting_url: string | null
          modality: string
          notes: string | null
          payment_type: string | null
          price: number
          scheduled_at: string
          status: string
          student_email: string | null
          student_id: string | null
          student_name: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          meeting_url?: string | null
          modality?: string
          notes?: string | null
          payment_type?: string | null
          price?: number
          scheduled_at: string
          status?: string
          student_email?: string | null
          student_id?: string | null
          student_name?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          meeting_url?: string | null
          modality?: string
          notes?: string | null
          payment_type?: string | null
          price?: number
          scheduled_at?: string
          status?: string
          student_email?: string | null
          student_id?: string | null
          student_name?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_notifications: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          notes: string | null
          status: string
          subject: string
          template_key: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          status?: string
          subject?: string
          template_key: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          status?: string
          subject?: string
          template_key?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      student_doubts: {
        Row: {
          answer: string | null
          answered_at: string | null
          approved_at: string | null
          content_id: string | null
          content_type: string
          created_at: string
          id: string
          messages_limit: number
          question: string
          questions_used: number
          status: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          approved_at?: string | null
          content_id?: string | null
          content_type?: string
          created_at?: string
          id?: string
          messages_limit?: number
          question: string
          questions_used?: number
          status?: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          approved_at?: string | null
          content_id?: string | null
          content_type?: string
          created_at?: string
          id?: string
          messages_limit?: number
          question?: string
          questions_used?: number
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
          allow_free_cancel: boolean
          cancel_text: string | null
          created_at: string
          features: string[]
          highlighted: boolean
          id: string
          min_commitment_days: number
          min_usage_charge_pct: number
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
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_free_cancel?: boolean
          cancel_text?: string | null
          created_at?: string
          features?: string[]
          highlighted?: boolean
          id?: string
          min_commitment_days?: number
          min_usage_charge_pct?: number
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
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_free_cancel?: boolean
          cancel_text?: string | null
          created_at?: string
          features?: string[]
          highlighted?: boolean
          id?: string
          min_commitment_days?: number
          min_usage_charge_pct?: number
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
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          message_id: string | null
          mime_type: string
          size_bytes: number
          storage_path: string
          ticket_id: string
          uploader_id: string
          uploader_type: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          message_id?: string | null
          mime_type: string
          size_bytes?: number
          storage_path: string
          ticket_id: string
          uploader_id: string
          uploader_type: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          message_id?: string | null
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          ticket_id?: string
          uploader_id?: string
          uploader_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          author_id: string
          author_type: string
          created_at: string
          id: string
          message: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          author_type: string
          created_at?: string
          id?: string
          message: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          author_type?: string
          created_at?: string
          id?: string
          message?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_admin_id: string | null
          category: string
          closed_at: string | null
          created_at: string
          description: string
          first_responded_at: string | null
          id: string
          priority: string
          resolved_at: string | null
          response_due_at: string
          status: string
          subject: string
          ticket_number: number
          updated_at: string
          user_id: string
          user_role: string
        }
        Insert: {
          assigned_admin_id?: string | null
          category: string
          closed_at?: string | null
          created_at?: string
          description: string
          first_responded_at?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          response_due_at: string
          status?: string
          subject: string
          ticket_number?: number
          updated_at?: string
          user_id: string
          user_role: string
        }
        Update: {
          assigned_admin_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          description?: string
          first_responded_at?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          response_due_at?: string
          status?: string
          subject?: string
          ticket_number?: number
          updated_at?: string
          user_id?: string
          user_role?: string
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
      teacher_availability_exceptions: {
        Row: {
          created_at: string
          end_time: string | null
          exception_date: string
          exception_type: string
          id: string
          notes: string | null
          start_time: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          exception_date: string
          exception_type: string
          id?: string
          notes?: string | null
          start_time?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          exception_date?: string
          exception_type?: string
          id?: string
          notes?: string | null
          start_time?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_availability_recurring: {
        Row: {
          active: boolean
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_contracts: {
        Row: {
          contract_text: string
          created_at: string
          device_info: string | null
          expires_at: string
          id: string
          ip_address: string | null
          signature_cpf: string
          signature_name: string
          signed_at: string
          status: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          contract_text: string
          created_at?: string
          device_info?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          signature_cpf: string
          signature_name: string
          signed_at?: string
          status?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          contract_text?: string
          created_at?: string
          device_info?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          signature_cpf?: string
          signature_name?: string
          signed_at?: string
          status?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_monthly_goal_snapshots: {
        Row: {
          created_at: string
          goals: Json
          id: string
          met_all_goals: boolean
          metrics: Json
          notified_at: string | null
          period_end: string
          period_start: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          goals?: Json
          id?: string
          met_all_goals?: boolean
          metrics?: Json
          notified_at?: string | null
          period_end: string
          period_start: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          goals?: Json
          id?: string
          met_all_goals?: boolean
          metrics?: Json
          notified_at?: string | null
          period_end?: string
          period_start?: string
          teacher_id?: string
        }
        Relationships: []
      }
      teacher_monthly_stats: {
        Row: {
          avg_rating: number | null
          bonus_amount: number
          commission_total: number
          created_at: string
          id: string
          material_minutes_equivalent: number
          material_unique_accesses: number
          package_fee_total: number
          packages_completed: number
          period_end: string
          period_start: string
          pool_base_amount: number
          pool_cap_applied: boolean
          pool_final_amount: number
          pool_floor_applied: boolean
          pool_run_id: string | null
          pool_share_pct: number
          quality_bonus_pct: number
          ratings_count: number
          rf_score: number | null
          rf_score_bonus_pct: number
          teacher_id: string
          total_consumption_minutes: number
          total_gross: number
          unit_sales_count: number
          unit_sales_gross: number
          updated_at: string
          video_minutes: number
        }
        Insert: {
          avg_rating?: number | null
          bonus_amount?: number
          commission_total?: number
          created_at?: string
          id?: string
          material_minutes_equivalent?: number
          material_unique_accesses?: number
          package_fee_total?: number
          packages_completed?: number
          period_end: string
          period_start: string
          pool_base_amount?: number
          pool_cap_applied?: boolean
          pool_final_amount?: number
          pool_floor_applied?: boolean
          pool_run_id?: string | null
          pool_share_pct?: number
          quality_bonus_pct?: number
          ratings_count?: number
          rf_score?: number | null
          rf_score_bonus_pct?: number
          teacher_id: string
          total_consumption_minutes?: number
          total_gross?: number
          unit_sales_count?: number
          unit_sales_gross?: number
          updated_at?: string
          video_minutes?: number
        }
        Update: {
          avg_rating?: number | null
          bonus_amount?: number
          commission_total?: number
          created_at?: string
          id?: string
          material_minutes_equivalent?: number
          material_unique_accesses?: number
          package_fee_total?: number
          packages_completed?: number
          period_end?: string
          period_start?: string
          pool_base_amount?: number
          pool_cap_applied?: boolean
          pool_final_amount?: number
          pool_floor_applied?: boolean
          pool_run_id?: string | null
          pool_share_pct?: number
          quality_bonus_pct?: number
          ratings_count?: number
          rf_score?: number | null
          rf_score_bonus_pct?: number
          teacher_id?: string
          total_consumption_minutes?: number
          total_gross?: number
          unit_sales_count?: number
          unit_sales_gross?: number
          updated_at?: string
          video_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_monthly_stats_pool_run_id_fkey"
            columns: ["pool_run_id"]
            isOneToOne: false
            referencedRelation: "pool_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_monthly_targets: {
        Row: {
          created_at: string
          id: string
          monthly_package_target: number
          notes: string | null
          teacher_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_package_target?: number
          notes?: string | null
          teacher_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          monthly_package_target?: number
          notes?: string | null
          teacher_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      teacher_payments: {
        Row: {
          avg_rating: number | null
          commission_amount: number
          created_at: string
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          package_count: number
          payment_type: string
          period_end: string
          period_start: string
          platform_fee: number
          pool_minutes: number
          pool_run_id: string | null
          pool_share_pct: number
          quality_bonus_pct: number
          rf_score: number | null
          rf_score_bonus_pct: number
          status: string
          teacher_id: string
          total_views: number | null
          updated_at: string
        }
        Insert: {
          avg_rating?: number | null
          commission_amount?: number
          created_at?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          package_count?: number
          payment_type?: string
          period_end: string
          period_start: string
          platform_fee?: number
          pool_minutes?: number
          pool_run_id?: string | null
          pool_share_pct?: number
          quality_bonus_pct?: number
          rf_score?: number | null
          rf_score_bonus_pct?: number
          status?: string
          teacher_id: string
          total_views?: number | null
          updated_at?: string
        }
        Update: {
          avg_rating?: number | null
          commission_amount?: number
          created_at?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          package_count?: number
          payment_type?: string
          period_end?: string
          period_start?: string
          platform_fee?: number
          pool_minutes?: number
          pool_run_id?: string | null
          pool_share_pct?: number
          quality_bonus_pct?: number
          rf_score?: number | null
          rf_score_bonus_pct?: number
          status?: string
          teacher_id?: string
          total_views?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_payments_pool_run_id_fkey"
            columns: ["pool_run_id"]
            isOneToOne: false
            referencedRelation: "pool_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_profile_change_requests: {
        Row: {
          created_at: string
          id: string
          proposed: Json
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          proposed?: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          proposed?: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_rf_score_components: {
        Row: {
          agenda_days_updated: number
          agenda_score: number
          created_at: string
          doubts_answered_in_time: number
          doubts_received: number
          doubts_score: number
          final_score: number
          id: string
          insertion_actual: number
          insertion_score: number
          insertion_target: number
          lessons_delivered: number
          lessons_scheduled: number
          lessons_score: number
          period_end: string
          period_start: string
          teacher_id: string
          updated_at: string
          weights_snapshot: Json | null
        }
        Insert: {
          agenda_days_updated?: number
          agenda_score?: number
          created_at?: string
          doubts_answered_in_time?: number
          doubts_received?: number
          doubts_score?: number
          final_score?: number
          id?: string
          insertion_actual?: number
          insertion_score?: number
          insertion_target?: number
          lessons_delivered?: number
          lessons_scheduled?: number
          lessons_score?: number
          period_end: string
          period_start: string
          teacher_id: string
          updated_at?: string
          weights_snapshot?: Json | null
        }
        Update: {
          agenda_days_updated?: number
          agenda_score?: number
          created_at?: string
          doubts_answered_in_time?: number
          doubts_received?: number
          doubts_score?: number
          final_score?: number
          id?: string
          insertion_actual?: number
          insertion_score?: number
          insertion_target?: number
          lessons_delivered?: number
          lessons_scheduled?: number
          lessons_score?: number
          period_end?: string
          period_start?: string
          teacher_id?: string
          updated_at?: string
          weights_snapshot?: Json | null
        }
        Relationships: []
      }
      teacher_sales_posts: {
        Row: {
          caption: string
          contents: Json
          created_at: string
          id: string
          public_url: string | null
          teacher_id: string
          template: string
          thumbnail_path: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          caption?: string
          contents?: Json
          created_at?: string
          id?: string
          public_url?: string | null
          teacher_id: string
          template?: string
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string
          contents?: Json
          created_at?: string
          id?: string
          public_url?: string | null
          teacher_id?: string
          template?: string
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      teacher_weekly_declarations: {
        Row: {
          agenda_updated: boolean
          created_at: string
          declared_at: string
          id: string
          notes: string | null
          teacher_id: string
          updated_at: string
          week_start: string
        }
        Insert: {
          agenda_updated?: boolean
          created_at?: string
          declared_at?: string
          id?: string
          notes?: string | null
          teacher_id: string
          updated_at?: string
          week_start: string
        }
        Update: {
          agenda_updated?: boolean
          created_at?: string
          declared_at?: string
          id?: string
          notes?: string | null
          teacher_id?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_at: string
          blocked_until: string
          context: string | null
          created_at: string
          id: string
          metadata: Json
          reason: string
          unblocked_at: string | null
          unblocked_by: string | null
          user_id: string
        }
        Insert: {
          blocked_at?: string
          blocked_until: string
          context?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason: string
          unblocked_at?: string | null
          unblocked_by?: string | null
          user_id: string
        }
        Update: {
          blocked_at?: string
          blocked_until?: string
          context?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string
          unblocked_at?: string | null
          unblocked_by?: string | null
          user_id?: string
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
      video_watch_log: {
        Row: {
          id: string
          lesson_id: string
          seconds_watched: number
          teacher_id: string
          user_id: string
          via_subscription: boolean
          watched_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          seconds_watched?: number
          teacher_id: string
          user_id: string
          via_subscription?: boolean
          watched_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          seconds_watched?: number
          teacher_id?: string
          user_id?: string
          via_subscription?: boolean
          watched_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      teacher_profiles_public: {
        Row: {
          areas: string[] | null
          avatar_url: string | null
          bio: string | null
          content_order: Json | null
          education: Json | null
          experiences: Json | null
          expertise_area: string | null
          name: string | null
          profile_title: string | null
          slug: string | null
          user_id: string | null
        }
        Insert: {
          areas?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          content_order?: Json | null
          education?: Json | null
          experiences?: Json | null
          expertise_area?: string | null
          name?: string | null
          profile_title?: string | null
          slug?: string | null
          user_id?: string | null
        }
        Update: {
          areas?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          content_order?: Json | null
          education?: Json | null
          experiences?: Json | null
          expertise_area?: string | null
          name?: string | null
          profile_title?: string | null
          slug?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      video_rating_aggregates: {
        Row: {
          average: number | null
          content_id: string | null
          content_type: string | null
          count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_business_days: {
        Args: { days: number; start_ts: string }
        Returns: string
      }
      add_student_role_to_self: { Args: never; Returns: boolean }
      admin_reset_free_trial: { Args: { _user_id: string }; Returns: boolean }
      can_access_lesson_material: {
        Args: { _lesson_id: string; _material_type: string }
        Returns: boolean
      }
      consume_cashback: {
        Args: {
          _requested_amount: number
          _source_reference: string
          _user_id: string
        }
        Returns: number
      }
      count_completed_packages: {
        Args: { _end: string; _start: string; _teacher_id: string }
        Returns: number
      }
      count_student_questions: { Args: { _doubt_id: string }; Returns: number }
      credit_cashback_purchase: {
        Args: {
          _purchase_amount: number
          _source_reference: string
          _source_type: string
          _user_id: string
        }
        Returns: string
      }
      credit_cashback_referral: {
        Args: {
          _purchase_amount: number
          _referred_user_id: string
          _source_reference: string
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
      ensure_cashback_account: { Args: { _user_id: string }; Returns: string }
      expire_old_cashback: { Args: never; Returns: number }
      generate_cashback_referral_code: { Args: never; Returns: string }
      get_cashback_config: { Args: never; Returns: Json }
      get_content_view_counts: {
        Args: { _content_type: string; _ids: string[] }
        Returns: {
          content_id: string
          views_count: number
        }[]
      }
      get_prova_vote_stats: {
        Args: { _content_id: string }
        Returns: {
          total_count: number
          yes_count: number
        }[]
      }
      get_teacher_monthly_target: {
        Args: { _teacher_id: string }
        Returns: number
      }
      get_user_cashback_tier: { Args: { _user_id: string }; Returns: Json }
      get_video_rating_aggregates: {
        Args: { _ids: string[] }
        Returns: {
          average: number
          content_id: string
          content_type: string
          count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_content_teacher: {
        Args: { _content_id: string; _content_type: string; _user_id: string }
        Returns: boolean
      }
      is_course_owner: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      is_cpf_taken: { Args: { _cpf: string }; Returns: boolean }
      is_lesson_owner: {
        Args: { _lesson_id: string; _user_id: string }
        Returns: boolean
      }
      is_login_blocked: { Args: { check_email: string }; Returns: boolean }
      is_teacher: { Args: { _user_id: string }; Returns: boolean }
      is_user_blocked: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      preview_cashback_usage: {
        Args: { _cart_amount: number; _user_id: string }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_free_trial_content_access: { Args: never; Returns: boolean }
      register_cashback_referral: {
        Args: { _referral_code: string; _referred_user_id: string }
        Returns: string
      }
      release_pending_cashback: { Args: never; Returns: number }
      start_free_trial: { Args: never; Returns: boolean }
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

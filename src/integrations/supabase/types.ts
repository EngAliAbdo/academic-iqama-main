export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          actor_role: string
          category: string
          created_at: string
          details: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          occurred_at: string
          priority: string
          status_label: string
          status_variant: string
        }
        Insert: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          actor_role?: string
          category?: string
          created_at?: string
          details?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          priority?: string
          status_label?: string
          status_variant?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          actor_role?: string
          category?: string
          created_at?: string
          details?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          priority?: string
          status_label?: string
          status_variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allowed_formats: string[]
          attachments: Json
          created_at: string
          description: string
          due_at: string
          due_time: string | null
          has_attachment: boolean
          id: string
          instructions: string
          level: string
          max_submissions: number
          resubmission_policy: string
          status: Database["public"]["Enums"]["assignment_status"]
          subject: string
          subject_id: string | null
          teacher_id: string
          teacher_name: string
          title: string
          updated_at: string
        }
        Insert: {
          allowed_formats?: string[]
          attachments?: Json
          created_at?: string
          description?: string
          due_at: string
          due_time?: string | null
          has_attachment?: boolean
          id?: string
          instructions?: string
          level: string
          max_submissions?: number
          resubmission_policy?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          subject: string
          subject_id?: string | null
          teacher_id: string
          teacher_name: string
          title: string
          updated_at?: string
        }
        Update: {
          allowed_formats?: string[]
          attachments?: Json
          created_at?: string
          description?: string
          due_at?: string
          due_time?: string | null
          has_attachment?: boolean
          id?: string
          instructions?: string
          level?: string
          max_submissions?: number
          resubmission_policy?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          subject?: string
          subject_id?: string | null
          teacher_id?: string
          teacher_name?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          created_at: string
          id: string
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_id: string
          created_at: string
          department: string
          email: string
          full_name: string
          id: string
          must_change_password: boolean
          role: Database["public"]["Enums"]["user_role"]
          role_title: string
          updated_at: string
        }
        Insert: {
          academic_id: string
          created_at?: string
          department?: string
          email: string
          full_name: string
          id: string
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          role_title?: string
          updated_at?: string
        }
        Update: {
          academic_id?: string
          created_at?: string
          department?: string
          email?: string
          full_name?: string
          id?: string
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          role_title?: string
          updated_at?: string
        }
        Relationships: []
      }
      originality_checks: {
        Row: {
          analysis_status: Database["public"]["Enums"]["analysis_status"]
          analyzed_at: string | null
          confidence_score: number
          created_at: string
          id: string
          matching_percentage: number
          model_name: string
          originality_score: number
          prompt_version: string
          raw_response: Json
          reasoning_notes: Json
          recommended_status: Database["public"]["Enums"]["originality_recommended_status"]
          risk_level: Database["public"]["Enums"]["risk_level"]
          submission_id: string
          summary_for_admin: string
          summary_for_student: string
          summary_for_teacher: string
          suspicious_sections: Json
          updated_at: string
        }
        Insert: {
          analysis_status?: Database["public"]["Enums"]["analysis_status"]
          analyzed_at?: string | null
          confidence_score?: number
          created_at?: string
          id?: string
          matching_percentage?: number
          model_name?: string
          originality_score?: number
          prompt_version?: string
          raw_response?: Json
          reasoning_notes?: Json
          recommended_status?: Database["public"]["Enums"]["originality_recommended_status"]
          risk_level?: Database["public"]["Enums"]["risk_level"]
          submission_id: string
          summary_for_admin?: string
          summary_for_student?: string
          summary_for_teacher?: string
          suspicious_sections?: Json
          updated_at?: string
        }
        Update: {
          analysis_status?: Database["public"]["Enums"]["analysis_status"]
          analyzed_at?: string | null
          confidence_score?: number
          created_at?: string
          id?: string
          matching_percentage?: number
          model_name?: string
          originality_score?: number
          prompt_version?: string
          raw_response?: Json
          reasoning_notes?: Json
          recommended_status?: Database["public"]["Enums"]["originality_recommended_status"]
          risk_level?: Database["public"]["Enums"]["risk_level"]
          submission_id?: string
          summary_for_admin?: string
          summary_for_student?: string
          summary_for_teacher?: string
          suspicious_sections?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "originality_checks_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          department: string
          id: string
          level: string
          name_ar: string
          name_en: string
          semester: string
          status: string
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          department?: string
          id?: string
          level?: string
          name_ar: string
          name_en?: string
          semester?: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          department?: string
          id?: string
          level?: string
          name_ar?: string
          name_en?: string
          semester?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_subjects: {
        Row: {
          created_at: string
          id: string
          student_id: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          student_id: string
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          student_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subjects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_subjects: {
        Row: {
          created_at: string
          department: string
          id: string
          level: string
          semester: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          department?: string
          id?: string
          level?: string
          semester?: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          level?: string
          semester?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appeal_status: string
          comments: string
          created_at: string
          final_decision: Database["public"]["Enums"]["review_final_decision"] | null
          id: string
          manual_evaluation: Json
          reviewed_at: string | null
          submission_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          appeal_status?: string
          comments?: string
          created_at?: string
          final_decision?: Database["public"]["Enums"]["review_final_decision"] | null
          id?: string
          manual_evaluation?: Json
          reviewed_at?: string | null
          submission_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          appeal_status?: string
          comments?: string
          created_at?: string
          final_decision?: Database["public"]["Enums"]["review_final_decision"] | null
          id?: string
          manual_evaluation?: Json
          reviewed_at?: string | null
          submission_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_matches: {
        Row: {
          created_at: string
          id: string
          match_type: Database["public"]["Enums"]["match_type"]
          matched_assignment_id: string | null
          matched_excerpt: string
          matched_student_id: string | null
          matched_student_name: string
          matched_subject_id: string | null
          matched_submission_id: string | null
          originality_check_id: string
          rank_order: number
          section_text: string
          similarity_score: number
          source_scope: Database["public"]["Enums"]["match_source_scope"]
          submission_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_type?: Database["public"]["Enums"]["match_type"]
          matched_assignment_id?: string | null
          matched_excerpt?: string
          matched_student_id?: string | null
          matched_student_name?: string
          matched_subject_id?: string | null
          matched_submission_id?: string | null
          originality_check_id: string
          rank_order?: number
          section_text?: string
          similarity_score?: number
          source_scope?: Database["public"]["Enums"]["match_source_scope"]
          submission_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_type?: Database["public"]["Enums"]["match_type"]
          matched_assignment_id?: string | null
          matched_excerpt?: string
          matched_student_id?: string | null
          matched_student_name?: string
          matched_subject_id?: string | null
          matched_submission_id?: string | null
          originality_check_id?: string
          rank_order?: number
          section_text?: string
          similarity_score?: number
          source_scope?: Database["public"]["Enums"]["match_source_scope"]
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_matches_originality_check_id_fkey"
            columns: ["originality_check_id"]
            isOneToOne: false
            referencedRelation: "originality_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_matches_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          academic_year: string
          allowed_submission_formats: string[]
          auto_start_analysis: boolean
          created_at: string
          high_risk_below: number
          id: boolean
          institution_name: string
          manual_review_on_extraction_failure: boolean
          max_upload_size_mb: number
          medium_risk_below: number
          suspicious_alert_below: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academic_year?: string
          allowed_submission_formats?: string[]
          auto_start_analysis?: boolean
          created_at?: string
          high_risk_below?: number
          id?: boolean
          institution_name?: string
          manual_review_on_extraction_failure?: boolean
          max_upload_size_mb?: number
          medium_risk_below?: number
          suspicious_alert_below?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academic_year?: string
          allowed_submission_formats?: string[]
          auto_start_analysis?: boolean
          created_at?: string
          high_risk_below?: number
          id?: boolean
          institution_name?: string
          manual_review_on_extraction_failure?: boolean
          max_upload_size_mb?: number
          medium_risk_below?: number
          suspicious_alert_below?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          academic_id: string
          analysis_completed_at: string | null
          analysis_error: string
          analysis_requested_at: string | null
          analysis_status: Database["public"]["Enums"]["analysis_status"]
          assignment_id: string
          created_at: string
          events: Json
          feedback: string
          file_name: string
          file_mime_type: string
          file_path: string | null
          file_size: string
          grade: number | null
          id: string
          latest_originality_check_id: string | null
          notes: string
          originality: number
          semester: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          student_name: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          academic_id: string
          analysis_completed_at?: string | null
          analysis_error?: string
          analysis_requested_at?: string | null
          analysis_status?: Database["public"]["Enums"]["analysis_status"]
          assignment_id: string
          created_at?: string
          events?: Json
          feedback?: string
          file_name: string
          file_mime_type?: string
          file_path?: string | null
          file_size?: string
          grade?: number | null
          id?: string
          latest_originality_check_id?: string | null
          notes?: string
          originality?: number
          semester?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          student_name: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          academic_id?: string
          analysis_completed_at?: string | null
          analysis_error?: string
          analysis_requested_at?: string | null
          analysis_status?: Database["public"]["Enums"]["analysis_status"]
          assignment_id?: string
          created_at?: string
          events?: Json
          feedback?: string
          file_name?: string
          file_mime_type?: string
          file_path?: string | null
          file_size?: string
          grade?: number | null
          id?: string
          latest_originality_check_id?: string | null
          notes?: string
          originality?: number
          semester?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          student_name?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_accessible_reviews: {
        Args: Record<PropertyKey, never>
        Returns: {
          appeal_status: string
          comments: string
          created_at: string
          final_decision: "accepted" | "rejected" | "revision" | null
          id: string
          manual_evaluation: Json
          reviewed_at: string | null
          submission_id: string
          teacher_id: string
          updated_at: string
        }[]
      }
      get_accessible_originality_checks: {
        Args: Record<PropertyKey, never>
        Returns: {
          analysis_status: "pending" | "processing" | "completed" | "failed" | "manual_review_required"
          analyzed_at: string | null
          confidence_score: number
          created_at: string
          id: string
          matching_percentage: number
          model_name: string
          originality_score: number
          prompt_version: string
          raw_response: Json
          reasoning_notes: Json
          recommended_status: "clean" | "review" | "flagged"
          risk_level: "low" | "medium" | "high"
          submission_id: string
          summary_for_admin: string
          summary_for_student: string
          summary_for_teacher: string
          suspicious_sections: Json
          updated_at: string
        }[]
      }
      resolve_login_identifier: {
        Args: {
          lookup_identifier: string
        }
        Returns: string | null
      }
    }
    Enums: {
      analysis_status: "pending" | "processing" | "completed" | "failed" | "manual_review_required"
      assignment_status: "draft" | "published" | "closed"
      match_source_scope: "same_assignment" | "same_subject" | "same_level_semester"
      match_type: "literal" | "paraphrased" | "common_overlap" | "citation_overlap"
      originality_recommended_status: "clean" | "review" | "flagged"
      review_final_decision: "accepted" | "rejected" | "revision"
      risk_level: "low" | "medium" | "high"
      submission_status: "submitted" | "review" | "revision" | "graded" | "accepted" | "rejected" | "flagged"
      user_role: "student" | "teacher" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof DatabaseWithoutInternals, "public">]

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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer Row
    }
    ? Row
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer Row
      }
      ? Row
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer Insert
    }
    ? Insert
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer Insert
      }
      ? Insert
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer Update
    }
    ? Update
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer Update
      }
      ? Update
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      analysis_status: ["pending", "processing", "completed", "failed", "manual_review_required"],
      assignment_status: ["draft", "published", "closed"],
      match_source_scope: ["same_assignment", "same_subject", "same_level_semester"],
      match_type: ["literal", "paraphrased", "common_overlap", "citation_overlap"],
      originality_recommended_status: ["clean", "review", "flagged"],
      review_final_decision: ["accepted", "rejected", "revision"],
      risk_level: ["low", "medium", "high"],
      submission_status: ["submitted", "review", "revision", "graded", "accepted", "rejected", "flagged"],
      user_role: ["student", "teacher", "admin"],
    },
  },
} as const

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
      assignments: {
        Row: {
          attachments: Json
          class_id: number
          created_at: string
          created_by: string | null
          deadline: string | null
          deleted_at: string | null
          description: string | null
          id: number
          max_score: number
          session_id: number | null
          tenant_id: number
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          class_id: number
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: number
          max_score?: number
          session_id?: number | null
          tenant_id: number
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          class_id?: number
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: number
          max_score?: number
          session_id?: number | null
          tenant_id?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendances: {
        Row: {
          checked_in_at: string | null
          created_at: string
          id: number
          note: string | null
          recorded_by: string | null
          session_id: number
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: number
          tenant_id: number
          updated_at: string
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string
          id?: number
          note?: string | null
          recorded_by?: string | null
          session_id: number
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: number
          tenant_id: number
          updated_at?: string
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string
          id?: number
          note?: string | null
          recorded_by?: string | null
          session_id?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: number
          tenant_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendances_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          ip_address: string | null
          tenant_id: number | null
          user_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: number
          ip_address?: string | null
          tenant_id?: number | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: number
          ip_address?: string | null
          tenant_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_enrollments: {
        Row: {
          class_id: number
          created_at: string
          deleted_at: string | null
          end_date: string | null
          id: number
          note: string | null
          price_per_session: number
          start_date: string
          student_id: number
          tenant_id: number
          updated_at: string
        }
        Insert: {
          class_id: number
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: number
          note?: string | null
          price_per_session: number
          start_date: string
          student_id: number
          tenant_id: number
          updated_at?: string
        }
        Update: {
          class_id?: number
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: number
          note?: string | null
          price_per_session?: number
          start_date?: string
          student_id?: number
          tenant_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          attendance_taken_at: string | null
          class_id: number
          created_at: string
          deleted_at: string | null
          ends_at: string
          id: number
          note: string | null
          starts_at: string
          status: Database["public"]["Enums"]["session_status"]
          tenant_id: number
          updated_at: string
        }
        Insert: {
          attendance_taken_at?: string | null
          class_id: number
          created_at?: string
          deleted_at?: string | null
          ends_at: string
          id?: number
          note?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["session_status"]
          tenant_id: number
          updated_at?: string
        }
        Update: {
          attendance_taken_at?: string | null
          class_id?: number
          created_at?: string
          deleted_at?: string | null
          ends_at?: string
          id?: number
          note?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          tenant_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          deleted_at: string | null
          end_date: string | null
          grade_level: number | null
          id: number
          name: string
          note: string | null
          schedule: Json
          start_date: string
          subject: string | null
          tenant_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          grade_level?: number | null
          id?: number
          name: string
          note?: string | null
          schedule?: Json
          start_date: string
          subject?: string | null
          tenant_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          grade_level?: number | null
          id?: number
          name?: string
          note?: string | null
          schedule?: Json
          start_date?: string
          subject?: string | null
          tenant_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: number
          session_id: number
          student_id: number
          tenant_id: number
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: number
          session_id: number
          student_id: number
          tenant_id: number
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: number
          session_id?: number
          student_id?: number
          tenant_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: number
          note: string | null
          phone: string | null
          tenant_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: number
          note?: string | null
          phone?: string | null
          tenant_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: number
          note?: string | null
          phone?: string | null
          tenant_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          absent_count: number
          attended_count: number
          class_enrollment_id: number
          computed_at: string
          created_at: string
          excused_count: number
          id: number
          late_count: number
          month: string
          note: string | null
          paid_amount: number
          paid_at: string | null
          price_per_session: number
          session_count: number
          status: Database["public"]["Enums"]["payment_status"]
          student_id: number
          tenant_id: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          absent_count?: number
          attended_count?: number
          class_enrollment_id: number
          computed_at?: string
          created_at?: string
          excused_count?: number
          id?: number
          late_count?: number
          month: string
          note?: string | null
          paid_amount?: number
          paid_at?: string | null
          price_per_session: number
          session_count?: number
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: number
          tenant_id: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          absent_count?: number
          attended_count?: number
          class_enrollment_id?: number
          computed_at?: string
          created_at?: string
          excused_count?: number
          id?: number
          late_count?: number
          month?: string
          note?: string | null
          paid_amount?: number
          paid_at?: string | null
          price_per_session?: number
          session_count?: number
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: number
          tenant_id?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_class_enrollment_id_fkey"
            columns: ["class_enrollment_id"]
            isOneToOne: false
            referencedRelation: "class_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          login_id: string
          must_change_password: boolean
          phone: string | null
          tenant_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          login_id: string
          must_change_password?: boolean
          phone?: string | null
          tenant_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          login_id?: string
          must_change_password?: boolean
          phone?: string | null
          tenant_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          id: number
          note: string | null
          parent_id: number | null
          tenant_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          id?: number
          note?: string | null
          parent_id?: number | null
          tenant_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          id?: number
          note?: string | null
          parent_id?: number | null
          tenant_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          id: number
          mime_type: string
          storage_path: string
          submission_id: number
          tenant_id: number
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          id?: number
          mime_type: string
          storage_path: string
          submission_id: number
          tenant_id: number
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          id?: number
          mime_type?: string
          storage_path?: string
          submission_id?: number
          tenant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "submission_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: number
          content: string | null
          created_at: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: number
          score: number | null
          status: Database["public"]["Enums"]["submission_status"]
          student_id: number
          submitted_at: string
          tenant_id: number
          updated_at: string
        }
        Insert: {
          assignment_id: number
          content?: string | null
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: number
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: number
          submitted_at?: string
          tenant_id: number
          updated_at?: string
        }
        Update: {
          assignment_id?: number
          content?: string | null
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: number
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: number
          submitted_at?: string
          tenant_id?: number
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
            foreignKeyName: "submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: number
          name: string
          owner_user_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: number
          name: string
          owner_user_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: number
          name?: string
          owner_user_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_owner_fk"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: number
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
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
      current_tenant_id: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_parent_child_in_class: {
        Args: { _class_id: number }
        Returns: boolean
      }
      is_parent_in_assignment: {
        Args: { _assignment_id: number }
        Returns: boolean
      }
      is_parent_of_student: { Args: { _student_id: number }; Returns: boolean }
      is_student_in_assignment: {
        Args: { _assignment_id: number }
        Returns: boolean
      }
      is_student_in_class: { Args: { _class_id: number }; Returns: boolean }
      is_student_self: { Args: { _student_id: number }; Returns: boolean }
      is_teacher: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "teacher" | "student" | "parent"
      attendance_status: "attended" | "late" | "absent" | "absent_excused"
      payment_status: "unpaid" | "partial" | "paid"
      session_status: "scheduled" | "completed" | "cancelled"
      submission_status: "draft" | "submitted" | "graded" | "returned"
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
      app_role: ["teacher", "student", "parent"],
      attendance_status: ["attended", "late", "absent", "absent_excused"],
      payment_status: ["unpaid", "partial", "paid"],
      session_status: ["scheduled", "completed", "cancelled"],
      submission_status: ["draft", "submitted", "graded", "returned"],
    },
  },
} as const

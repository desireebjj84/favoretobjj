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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          checked_in_at: string
          confirmed: boolean
          confirmed_at: string | null
          id: string
          method: string
          recorded_by: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          checked_in_at?: string
          confirmed?: boolean
          confirmed_at?: string | null
          id?: string
          method?: string
          recorded_by?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          checked_in_at?: string
          confirmed?: boolean
          confirmed_at?: string | null
          id?: string
          method?: string
          recorded_by?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      belt_requirements: {
        Row: {
          belt: Database["public"]["Enums"]["belt_color"]
          classes_per_stripe: number
          id: string
          is_kids: boolean
        }
        Insert: {
          belt: Database["public"]["Enums"]["belt_color"]
          classes_per_stripe: number
          id?: string
          is_kids?: boolean
        }
        Update: {
          belt?: Database["public"]["Enums"]["belt_color"]
          classes_per_stripe?: number
          id?: string
          is_kids?: boolean
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booked_by: string | null
          created_at: string
          id: string
          session_id: string
          student_id: string
        }
        Insert: {
          booked_by?: string | null
          created_at?: string
          id?: string
          session_id: string
          student_id: string
        }
        Update: {
          booked_by?: string | null
          created_at?: string
          id?: string
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          class_id: string
          created_at: string
          id: string
          notes: string | null
          session_date: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          notes?: string | null
          session_date: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          session_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          active: boolean
          capacity: number
          created_at: string
          end_time: string
          id: string
          instructor_id: string | null
          instructor_name: string | null
          kind: Database["public"]["Enums"]["class_kind"]
          location_id: string
          name: string
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          capacity?: number
          created_at?: string
          end_time: string
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          kind?: Database["public"]["Enums"]["class_kind"]
          location_id: string
          name: string
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          capacity?: number
          created_at?: string
          end_time?: string
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          kind?: Database["public"]["Enums"]["class_kind"]
          location_id?: string
          name?: string
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "classes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          city: string
          created_at: string
          id: string
          name: string
          short_name: string
          sort_order: number
        }
        Insert: {
          city?: string
          created_at?: string
          id?: string
          name: string
          short_name: string
          sort_order?: number
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          name?: string
          short_name?: string
          sort_order?: number
        }
        Relationships: []
      }
      org_settings: {
        Row: {
          absence_threshold: number
          accent_color: string
          classes_per_stripe: number
          default_language: string
          id: number
          logo_url: string | null
          org_name: string
          updated_at: string
        }
        Insert: {
          absence_threshold?: number
          accent_color?: string
          classes_per_stripe?: number
          default_language?: string
          id?: number
          logo_url?: string | null
          org_name?: string
          updated_at?: string
        }
        Update: {
          absence_threshold?: number
          accent_color?: string
          classes_per_stripe?: number
          default_language?: string
          id?: number
          logo_url?: string | null
          org_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          language: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          language?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          language?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stripe_submissions: {
        Row: {
          answers: Json
          color: string
          id: string
          review_note: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
          student_snapshot: Json
          submitted_at: string
          submitted_by: string
          version: number
        }
        Insert: {
          answers: Json
          color: string
          id?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id: string
          student_snapshot: Json
          submitted_at?: string
          submitted_by: string
          version?: number
        }
        Update: {
          answers?: Json
          color?: string
          id?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string
          student_snapshot?: Json
          submitted_at?: string
          submitted_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "stripe_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          active: boolean
          approved: boolean
          belt: Database["public"]["Enums"]["belt_color"]
          birth_date: string | null
          colored_stripes: string[]
          created_at: string
          full_name: string
          guardian_id: string | null
          id: string
          is_minor: boolean
          location_id: string
          photo_url: string | null
          qr_code: string
          rank_since: string
          stripes: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          approved?: boolean
          belt?: Database["public"]["Enums"]["belt_color"]
          birth_date?: string | null
          colored_stripes?: string[]
          created_at?: string
          full_name: string
          guardian_id?: string | null
          id?: string
          is_minor?: boolean
          location_id: string
          photo_url?: string | null
          qr_code?: string
          rank_since?: string
          stripes?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          approved?: boolean
          belt?: Database["public"]["Enums"]["belt_color"]
          birth_date?: string | null
          colored_stripes?: string[]
          created_at?: string
          full_name?: string
          guardian_id?: string | null
          id?: string
          is_minor?: boolean
          location_id?: string
          photo_url?: string | null
          qr_code?: string
          rank_since?: string
          stripes?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_student: { Args: { _student_id: string }; Returns: boolean }
      ensure_sessions: {
        Args: { _from: string; _to: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      review_stripe_form: {
        Args: { _approve: boolean; _id: string; _note?: string }
        Returns: undefined
      }
      session_booking_count: {
        Args: { _session_ids: string[] }
        Returns: {
          n: number
          session_id: string
        }[]
      }
      submit_stripe_form: {
        Args: { _answers: Json; _color: string; _student_id: string }
        Returns: string
      }
      validate_stripe_answers: {
        Args: { _a: Json; _color: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "instructor" | "parent"
      attendance_status: "present" | "absent" | "late"
      belt_color:
        | "white"
        | "grey"
        | "yellow"
        | "orange"
        | "green"
        | "blue"
        | "purple"
        | "brown"
        | "black"
      class_kind: "adult" | "kids"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "instructor", "parent"],
      attendance_status: ["present", "absent", "late"],
      belt_color: [
        "white",
        "grey",
        "yellow",
        "orange",
        "green",
        "blue",
        "purple",
        "brown",
        "black",
      ],
      class_kind: ["adult", "kids"],
    },
  },
} as const

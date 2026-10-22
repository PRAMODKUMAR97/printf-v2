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
      job_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          job_id: string
          token_hash: string
          used: boolean
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          job_id: string
          token_hash: string
          used?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          job_id?: string
          token_hash?: string
          used?: boolean
        }
        Relationships: []
      }
      logs: {
        Row: {
          created_at: string
          id: string
          job_id: string | null
          message: string
          metadata: Json | null
          printf_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id?: string | null
          message: string
          metadata?: Json | null
          printf_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string | null
          message?: string
          metadata?: Json | null
          printf_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "print_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_printf_id_fkey"
            columns: ["printf_id"]
            isOneToOne: false
            referencedRelation: "printfs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_printf_id_fkey"
            columns: ["printf_id"]
            isOneToOne: false
            referencedRelation: "printfs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      otps: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          id: string
          job_id: string
          locked_until: string | null
          max_attempts: number
          otp_code: string
          otp_hash: string | null
          used: boolean
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          job_id: string
          locked_until?: string | null
          max_attempts?: number
          otp_code: string
          otp_hash?: string | null
          used?: boolean
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          job_id?: string
          locked_until?: string | null
          max_attempts?: number
          otp_code?: string
          otp_hash?: string | null
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "otps_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "print_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          gateway_ref: string | null
          id: string
          job_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          gateway_ref?: string | null
          id?: string
          job_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          gateway_ref?: string | null
          id?: string
          job_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "print_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          created_at: string
          expiry_time: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          locked: boolean
          printf_id: string | null
          settings_json: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiry_time?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          locked?: boolean
          printf_id?: string | null
          settings_json?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiry_time?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          locked?: boolean
          printf_id?: string | null
          settings_json?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_printf_id_fkey"
            columns: ["printf_id"]
            isOneToOne: false
            referencedRelation: "printfs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_printf_id_fkey"
            columns: ["printf_id"]
            isOneToOne: false
            referencedRelation: "printfs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_devices: {
        Row: {
          created_at: string
          device_secret_hash: string
          id: string
          is_active: boolean
          last_authenticated: string | null
          printf_id: string
        }
        Insert: {
          created_at?: string
          device_secret_hash: string
          id?: string
          is_active?: boolean
          last_authenticated?: string | null
          printf_id: string
        }
        Update: {
          created_at?: string
          device_secret_hash?: string
          id?: string
          is_active?: boolean
          last_authenticated?: string | null
          printf_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_devices_printf_id_fkey"
            columns: ["printf_id"]
            isOneToOne: true
            referencedRelation: "printfs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_devices_printf_id_fkey"
            columns: ["printf_id"]
            isOneToOne: true
            referencedRelation: "printfs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      printfs: {
        Row: {
          api_key: string
          created_at: string
          id: string
          ink_level: number | null
          last_seen: string | null
          location: string
          name: string
          paper_level: number | null
          status: string
          updated_at: string
        }
        Insert: {
          api_key?: string
          created_at?: string
          id?: string
          ink_level?: number | null
          last_seen?: string | null
          location: string
          name: string
          paper_level?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          ink_level?: number | null
          last_seen?: string | null
          location?: string
          name?: string
          paper_level?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          preferences: Json | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      printfs_public: {
        Row: {
          created_at: string | null
          id: string | null
          ink_level: number | null
          last_seen: string | null
          location: string | null
          name: string | null
          paper_level: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          ink_level?: number | null
          last_seen?: string | null
          location?: string | null
          name?: string | null
          paper_level?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          ink_level?: number | null
          last_seen?: string | null
          location?: string | null
          name?: string | null
          paper_level?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_expired_tokens: { Args: never; Returns: undefined }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_secret: { Args: { secret: string }; Returns: string }
      verify_secret: {
        Args: { hash: string; secret: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      brands: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          logo_url: string | null
          name: string
          theme: Json
          updated_at: string
        }
        Insert: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          logo_url?: string | null
          name: string
          theme?: Json
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          logo_url?: string | null
          name?: string
          theme?: Json
          updated_at?: string
        }
        Relationships: []
      }
      form_answers: {
        Row: {
          answer_id: string
          answer_value: Json
          chat_messages: Json | null
          is_additional_field: boolean | null
          question_id: string
          submission_id: string
        }
        Insert: {
          answer_id?: string
          answer_value: Json
          chat_messages?: Json | null
          is_additional_field?: boolean | null
          question_id: string
          submission_id: string
        }
        Update: {
          answer_id?: string
          answer_value?: Json
          chat_messages?: Json | null
          is_additional_field?: boolean | null
          question_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_form_answers_submission"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      form_chat_attachments: {
        Row: {
          created_at: string
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          form_id: string | null
          id: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          form_id?: string | null
          id?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          form_id?: string | null
          id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_chat_attachments_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          completed_at: string | null
          created_at: string
          form_version_id: string
          last_updated_at: string
          metadata: Json | null
          status: Database["public"]["Enums"]["submission_status"]
          submission_id: string
          testmode: boolean
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          form_version_id: string
          last_updated_at?: string
          metadata?: Json | null
          status: Database["public"]["Enums"]["submission_status"]
          submission_id?: string
          testmode?: boolean
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          form_version_id?: string
          last_updated_at?: string
          metadata?: Json | null
          status?: Database["public"]["Enums"]["submission_status"]
          submission_id?: string
          testmode?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_form_submissions_version"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["version_id"]
          },
        ]
      }
      form_versions: {
        Row: {
          archived_at: string | null
          created_at: string
          description: Json | null
          form_id: string
          published_at: string | null
          questions: Json
          settings: Json | null
          status: Database["public"]["Enums"]["form_status"]
          title: Json
          updated_at: string
          user_id: string | null
          version_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: Json | null
          form_id: string
          published_at?: string | null
          questions: Json
          settings?: Json | null
          status?: Database["public"]["Enums"]["form_status"]
          title: Json
          updated_at?: string
          user_id?: string | null
          version_id?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: Json | null
          form_id?: string
          published_at?: string | null
          questions?: Json
          settings?: Json | null
          status?: Database["public"]["Enums"]["form_status"]
          title?: Json
          updated_at?: string
          user_id?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_form_versions_form"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_versions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          agent_state: Json | null
          brand_id: string | null
          created_at: string
          current_draft_version_id: string | null
          current_published_version_id: string | null
          id: string
          short_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agent_state?: Json | null
          brand_id?: string | null
          created_at?: string
          current_draft_version_id?: string | null
          current_published_version_id?: string | null
          id?: string
          short_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agent_state?: Json | null
          brand_id?: string | null
          created_at?: string
          current_draft_version_id?: string | null
          current_published_version_id?: string | null
          id?: string
          short_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_forms_brand"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "fk_forms_current_draft_version"
            columns: ["current_draft_version_id"]
            isOneToOne: true
            referencedRelation: "form_versions"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "fk_forms_current_published_version"
            columns: ["current_published_version_id"]
            isOneToOne: true
            referencedRelation: "form_versions"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "forms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          content: Json | null
          created_at: string | null
          form_id: string | null
          id: number
          parts: Json | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          attachments?: Json | null
          content?: Json | null
          created_at?: string | null
          form_id?: string | null
          id?: never
          parts?: Json | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          attachments?: Json | null
          content?: Json | null
          created_at?: string | null
          form_id?: string | null
          id?: never
          parts?: Json | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_chat_attachments: {
        Row: {
          created_at: string
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: number
          submission_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: number
          submission_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: number
          submission_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submission_chat_attachments_form_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_chat_attachments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      submission_messages: {
        Row: {
          attachments: Json | null
          content: Json | null
          created_at: string | null
          id: number
          parts: Json | null
          role: string | null
          submission_id: string | null
          user_id: string | null
        }
        Insert: {
          attachments?: Json | null
          content?: Json | null
          created_at?: string | null
          id?: never
          parts?: Json | null
          role?: string | null
          submission_id?: string | null
          user_id?: string | null
        }
        Update: {
          attachments?: Json | null
          content?: Json | null
          created_at?: string | null
          id?: never
          parts?: Json | null
          role?: string | null
          submission_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submission_messages_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "submission_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          form_id: string
          id: string
          output: Json | null
          retries: number | null
          started_at: string | null
          status: string
          task_definition: Json
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          form_id: string
          id?: string
          output?: Json | null
          retries?: number | null
          started_at?: string | null
          status?: string
          task_definition: Json
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          form_id?: string
          id?: string
          output?: Json | null
          retries?: number | null
          started_at?: string | null
          status?: string
          task_definition?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_history: {
        Row: {
          created_at: string | null
          id: number
          message_count: number
          period_end: string
          period_start: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: never
          message_count: number
          period_end: string
          period_start: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: never
          message_count?: number
          period_end?: string
          period_start?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          anonymous: boolean | null
          created_at: string | null
          daily_message_count: number | null
          daily_reset: string | null
          display_name: string | null
          email: string
          id: string
          message_count: number | null
          preferred_model: string | null
          premium: boolean | null
          profile_image: string | null
        }
        Insert: {
          anonymous?: boolean | null
          created_at?: string | null
          daily_message_count?: number | null
          daily_reset?: string | null
          display_name?: string | null
          email: string
          id: string
          message_count?: number | null
          preferred_model?: string | null
          premium?: boolean | null
          profile_image?: string | null
        }
        Update: {
          anonymous?: boolean | null
          created_at?: string | null
          daily_message_count?: number | null
          daily_reset?: string | null
          display_name?: string | null
          email?: string
          id?: string
          message_count?: number | null
          preferred_model?: string | null
          premium?: boolean | null
          profile_image?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_filtered_submissions: {
        Args: {
          submission_filters: Json
          answer_filters: Json
          page?: number
          page_size?: number
        }
        Returns: {
          data: Json
          total_count: number
          total_completed_count: number
          total_in_progress_count: number
          total_filtered_count: number
          completed_count: number
          in_progress_count: number
        }[]
      }
    }
    Enums: {
      form_status: "draft" | "published" | "archived"
      submission_status: "in_progress" | "completed" | "abandoned"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      form_status: ["draft", "published", "archived"],
      submission_status: ["in_progress", "completed", "abandoned"],
    },
  },
} as const

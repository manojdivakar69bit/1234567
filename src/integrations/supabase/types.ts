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
      agents: {
        Row: {
          approval_status: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          razorpay_account_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approval_status?: string
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          razorpay_account_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approval_status?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          razorpay_account_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          caller_info: Json | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          qr_code: string
          status: string
        }
        Insert: {
          caller_info?: Json | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          qr_code: string
          status?: string
        }
        Update: {
          caller_info?: Json | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          qr_code?: string
          status?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          blood_group: string | null
          created_at: string
          id: string
          name: string
          qr_code_id: string
          updated_at: string
          vehicle_number: string | null
        }
        Insert: {
          address?: string | null
          blood_group?: string | null
          created_at?: string
          id?: string
          name: string
          qr_code_id: string
          updated_at?: string
          vehicle_number?: string | null
        }
        Update: {
          address?: string | null
          blood_group?: string | null
          created_at?: string
          id?: string
          name?: string
          qr_code_id?: string
          updated_at?: string
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
          qr_code_id: string
          relationship: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone: string
          qr_code_id: string
          relationship?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          qr_code_id?: string
          relationship?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          agent_id: string | null
          amount: number
          collected_by_id: string | null
          collected_by_role: string
          collector_name: string | null
          created_at: string
          customer_name: string | null
          id: string
          notes: string | null
          payment_method: string
          qr_code_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          amount: number
          collected_by_id?: string | null
          collected_by_role: string
          collector_name?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          qr_code_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          amount?: number
          collected_by_id?: string | null
          collected_by_role?: string
          collector_name?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          qr_code_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      print_history: {
        Row: {
          code_from: string | null
          code_to: string | null
          count: number | null
          created_at: string
          id: string
          printed_at: string
          printed_by: string | null
        }
        Insert: {
          code_from?: string | null
          code_to?: string | null
          count?: number | null
          created_at?: string
          id?: string
          printed_at?: string
          printed_by?: string | null
        }
        Update: {
          code_from?: string | null
          code_to?: string | null
          count?: number | null
          created_at?: string
          id?: string
          printed_at?: string
          printed_by?: string | null
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          assigned_agent_id: string | null
          assigned_salesman_id: string | null
          code: string
          created_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          assigned_salesman_id?: string | null
          code: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          assigned_salesman_id?: string | null
          code?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_assigned_salesman_id_fkey"
            columns: ["assigned_salesman_id"]
            isOneToOne: false
            referencedRelation: "salesmen"
            referencedColumns: ["id"]
          },
        ]
      }
      salesmen: {
        Row: {
          created_at: string
          created_by_agent_id: string | null
          email: string
          id: string
          name: string
          phone: string | null
          razorpay_account_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_agent_id?: string | null
          email: string
          id?: string
          name: string
          phone?: string | null
          razorpay_account_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_agent_id?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          razorpay_account_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salesmen_created_by_agent_id_fkey"
            columns: ["created_by_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

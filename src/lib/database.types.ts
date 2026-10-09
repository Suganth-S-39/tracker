
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "budgets": {
                  Row: {
                    "amount_minor": number,"category_id": string | null,"created_at": string,"deleted_at": string | null,"id": string,"month": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "amount_minor": number,"category_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"month": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"category_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"month"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "budgets_category_fkey"
      columns: ["user_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"icon": string,"id": string,"is_default": boolean,"is_hidden": boolean,"is_system": boolean,"kind": Database["public"]['Enums']["transaction_type"],"name": string,"sort_order": number,"system_key": Database["public"]['Enums']["system_category_key"] | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"icon"?: string,"id"?: string,"is_default"?: boolean,"is_hidden"?: boolean,"is_system"?: boolean,"kind": Database["public"]['Enums']["transaction_type"],"name": string,"sort_order"?: number,"system_key"?: Database["public"]['Enums']["system_category_key"] | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"icon"?: string,"id"?: string,"is_default"?: boolean,"is_hidden"?: boolean,"is_system"?: boolean,"kind"?: Database["public"]['Enums']["transaction_type"],"name"?: string,"sort_order"?: number,"system_key"?: Database["public"]['Enums']["system_category_key"] | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"currencies": {
                  Row: {
                    "code": string,"exponent": number,"name": string
                  }
                  Insert: {
                    "code": string,"exponent": number,"name": string
                  }
                  Update: {
                    "code"?: string,"exponent"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"exchange_rates": {
                  Row: {
                    "base": string,"date": string,"id": string,"quote": string,"rate": number
                  }
                  Insert: {
                    "base": string,"date": string,"id"?: string,"quote": string,"rate": number
                  }
                  Update: {
                    "base"?: string,"date"?: string,"id"?: string,"quote"?: string,"rate"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "exchange_rates_base_fkey"
      columns: ["base"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "exchange_rates_quote_fkey"
      columns: ["quote"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                },"iou_repayments": {
                  Row: {
                    "amount_minor": number,"base_amount_minor": number,"created_at": string,"currency": string,"date": string,"deleted_at": string | null,"exchange_rate": number,"id": string,"iou_currency_amount_minor": number,"iou_currency_rate": number,"iou_id": string,"note": string | null,"transaction_id": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "amount_minor": number,"base_amount_minor": number,"created_at"?: string,"currency": string,"date": string,"deleted_at"?: string | null,"exchange_rate": number,"id"?: string,"iou_currency_amount_minor": number,"iou_currency_rate": number,"iou_id": string,"note"?: string | null,"transaction_id": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"base_amount_minor"?: number,"created_at"?: string,"currency"?: string,"date"?: string,"deleted_at"?: string | null,"exchange_rate"?: number,"id"?: string,"iou_currency_amount_minor"?: number,"iou_currency_rate"?: number,"iou_id"?: string,"note"?: string | null,"transaction_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iou_repayments_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "iou_repayments_iou_fkey"
      columns: ["user_id","iou_id"]
isOneToOne: false
      referencedRelation: "ious"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "iou_repayments_transaction_fkey"
      columns: ["user_id","transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"ious": {
                  Row: {
                    "base_amount_minor": number,"created_at": string,"date": string,"deleted_at": string | null,"direction": Database["public"]['Enums']["iou_direction"],"due_date": string | null,"exchange_rate": number,"id": string,"note": string | null,"original_amount_minor": number,"original_currency": string,"person_name": string,"transaction_id": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "base_amount_minor": number,"created_at"?: string,"date": string,"deleted_at"?: string | null,"direction": Database["public"]['Enums']["iou_direction"],"due_date"?: string | null,"exchange_rate": number,"id"?: string,"note"?: string | null,"original_amount_minor": number,"original_currency": string,"person_name": string,"transaction_id": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "base_amount_minor"?: number,"created_at"?: string,"date"?: string,"deleted_at"?: string | null,"direction"?: Database["public"]['Enums']["iou_direction"],"due_date"?: string | null,"exchange_rate"?: number,"id"?: string,"note"?: string | null,"original_amount_minor"?: number,"original_currency"?: string,"person_name"?: string,"transaction_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ious_original_currency_fkey"
      columns: ["original_currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "ious_transaction_fkey"
      columns: ["user_id","transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "accent_theme": Database["public"]['Enums']["accent_theme"],"avatar_data_url": string | null,"base_currency": string | null,"created_at": string,"deleted_at": string | null,"display_name": string | null,"email": string | null,"id": string,"theme_mode": Database["public"]['Enums']["theme_mode"],"timezone": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "accent_theme"?: Database["public"]['Enums']["accent_theme"],"avatar_data_url"?: string | null,"base_currency"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"display_name"?: string | null,"email"?: string | null,"id"?: string,"theme_mode"?: Database["public"]['Enums']["theme_mode"],"timezone"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "accent_theme"?: Database["public"]['Enums']["accent_theme"],"avatar_data_url"?: string | null,"base_currency"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"display_name"?: string | null,"email"?: string | null,"id"?: string,"theme_mode"?: Database["public"]['Enums']["theme_mode"],"timezone"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_base_currency_fkey"
      columns: ["base_currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                },"recurring_rules": {
                  Row: {
                    "amount_minor": number,"anchor_day": number,"category_id": string,"created_at": string,"currency": string,"deleted_at": string | null,"frequency": Database["public"]['Enums']["recurrence_frequency"],"id": string,"is_active": boolean,"next_due_date": string,"note": string | null,"payee": string | null,"type": Database["public"]['Enums']["transaction_type"],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "amount_minor": number,"anchor_day": number,"category_id": string,"created_at"?: string,"currency": string,"deleted_at"?: string | null,"frequency": Database["public"]['Enums']["recurrence_frequency"],"id"?: string,"is_active"?: boolean,"next_due_date": string,"note"?: string | null,"payee"?: string | null,"type": Database["public"]['Enums']["transaction_type"],"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"anchor_day"?: number,"category_id"?: string,"created_at"?: string,"currency"?: string,"deleted_at"?: string | null,"frequency"?: Database["public"]['Enums']["recurrence_frequency"],"id"?: string,"is_active"?: boolean,"next_due_date"?: string,"note"?: string | null,"payee"?: string | null,"type"?: Database["public"]['Enums']["transaction_type"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_rules_category_fkey"
      columns: ["user_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "recurring_rules_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "base_amount_minor": number,"category_id": string,"created_at": string,"date": string,"deleted_at": string | null,"exchange_rate": number,"id": string,"iou_id": string | null,"note": string | null,"occurrence_date": string | null,"original_amount_minor": number,"original_currency": string,"payee": string | null,"recurring_rule_id": string | null,"type": Database["public"]['Enums']["transaction_type"],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "base_amount_minor": number,"category_id": string,"created_at"?: string,"date": string,"deleted_at"?: string | null,"exchange_rate": number,"id"?: string,"iou_id"?: string | null,"note"?: string | null,"occurrence_date"?: string | null,"original_amount_minor": number,"original_currency": string,"payee"?: string | null,"recurring_rule_id"?: string | null,"type": Database["public"]['Enums']["transaction_type"],"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "base_amount_minor"?: number,"category_id"?: string,"created_at"?: string,"date"?: string,"deleted_at"?: string | null,"exchange_rate"?: number,"id"?: string,"iou_id"?: string | null,"note"?: string | null,"occurrence_date"?: string | null,"original_amount_minor"?: number,"original_currency"?: string,"payee"?: string | null,"recurring_rule_id"?: string | null,"type"?: Database["public"]['Enums']["transaction_type"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_category_fkey"
      columns: ["user_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "transactions_iou_fkey"
      columns: ["user_id","iou_id"]
isOneToOne: false
      referencedRelation: "ious"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "transactions_original_currency_fkey"
      columns: ["original_currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "transactions_recurring_rule_fkey"
      columns: ["user_id","recurring_rule_id"]
isOneToOne: false
      referencedRelation: "recurring_rules"
      referencedColumns: ["user_id","id"]
    }
                  ]
                }
          }
          Views: {
            "iou_balances": {
                  Row: {
                    "base_amount_minor": number | null,"created_at": string | null,"date": string | null,"direction": Database["public"]['Enums']["iou_direction"] | null,"due_date": string | null,"exchange_rate": string | null,"id": string | null,"note": string | null,"original_amount_minor": number | null,"original_currency": string | null,"person_name": string | null,"remaining_minor": number | null,"repaid_minor": number | null,"repayment_count": number | null,"status": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ious_original_currency_fkey"
      columns: ["original_currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                },"iou_repayment_details": {
                  Row: {
                    "amount_minor": number | null,"base_amount_minor": number | null,"created_at": string | null,"currency": string | null,"date": string | null,"exchange_rate": string | null,"id": string | null,"iou_currency_amount_minor": number | null,"iou_currency_rate": string | null,"iou_id": string | null,"note": string | null
                  }
                  Insert: {
                           "amount_minor"?: number | null,"base_amount_minor"?: number | null,"created_at"?: string | null,"currency"?: string | null,"date"?: string | null,"exchange_rate"?: never,"id"?: string | null,"iou_currency_amount_minor"?: number | null,"iou_currency_rate"?: never,"iou_id"?: string | null,"note"?: string | null
                         }
                        Update: {
                           "amount_minor"?: number | null,"base_amount_minor"?: number | null,"created_at"?: string | null,"currency"?: string | null,"date"?: string | null,"exchange_rate"?: never,"id"?: string | null,"iou_currency_amount_minor"?: number | null,"iou_currency_rate"?: never,"iou_id"?: string | null,"note"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "iou_repayments_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                }
          }
          Functions: {
            "budget_status":
{ Args: { "p_month": string }; Returns: {
              "amount_minor": number,"category_id": string,"set_for_month": string,"spent_minor": number
            }[]
                           },
"complete_onboarding":
{ Args: { "p_avatar_data_url"?: string,"p_base_currency": string,"p_display_name"?: string,"p_timezone": string }; Returns: {
              "accent_theme": Database["public"]['Enums']["accent_theme"],
"avatar_data_url": string | null,
"base_currency": string | null,
"created_at": string,
"deleted_at": string | null,
"display_name": string | null,
"email": string | null,
"id": string,
"theme_mode": Database["public"]['Enums']["theme_mode"],
"timezone": string,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_iou":
{ Args: { "p_base_amount_minor": number,"p_date": string,"p_direction": Database["public"]['Enums']["iou_direction"],"p_due_date"?: string,"p_exchange_rate": string,"p_note"?: string,"p_original_amount_minor": number,"p_original_currency": string,"p_person_name": string }; Returns: string
                           },
"create_repayment":
{ Args: { "p_amount_minor": number,"p_base_amount_minor": number,"p_currency": string,"p_date": string,"p_exchange_rate": string,"p_iou_currency_amount_minor": number,"p_iou_currency_rate": string,"p_iou_id": string,"p_note"?: string }; Returns: string
                           },
"create_transaction":
{ Args: { "p_base_amount_minor": number,"p_category_id": string,"p_date": string,"p_exchange_rate": string,"p_note"?: string,"p_original_amount_minor": number,"p_original_currency": string,"p_payee"?: string,"p_repeat"?: Database["public"]['Enums']["recurrence_frequency"],"p_type": Database["public"]['Enums']["transaction_type"] }; Returns: string
                           },
"daily_totals":
{ Args: { "p_exclude_iou"?: boolean,"p_month": string }; Returns: {
              "day": string,"expense_minor": number,"income_minor": number,"transaction_count": number
            }[]
                           },
"delete_iou":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_recurring_rule":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_repayment":
{ Args: { "p_id": string }; Returns: undefined
                           },
"iou_totals":
{ Args: Record<PropertyKey, never>; Returns: {
              "i_owe_minor": number,"owe_approximate": boolean,"owed_approximate": boolean,"owed_to_me_minor": number
            }[]
                           },
"latest_rate":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "rate": string,"rate_date": string
            }[]
                           },
"list_transactions":
{ Args: { "p_category_id"?: string,"p_cursor_created_at"?: string,"p_cursor_date"?: string,"p_cursor_id"?: string,"p_from"?: string,"p_limit"?: number,"p_search"?: string,"p_to"?: string,"p_type"?: Database["public"]['Enums']["transaction_type"] }; Returns: {
              "base_amount_minor": number,"category_id": string,"created_at": string,"date": string,"exchange_rate": string,"id": string,"iou_id": string,"note": string,"original_amount_minor": number,"original_currency": string,"payee": string,"recurring_rule_id": string,"type": Database["public"]['Enums']["transaction_type"]
            }[]
                           },
"month_summary":
{ Args: { "p_month": string }; Returns: {
              "expense_minor": number,"income_minor": number,"investment_minor": number,"net_minor": number,"savings_minor": number
            }[]
                           },
"monthly_totals":
{ Args: { "p_exclude_iou"?: boolean,"p_from_month": string,"p_to_month": string }; Returns: {
              "expense_minor": number,"income_minor": number,"month": string
            }[]
                           },
"recent_payees":
{ Args: { "p_limit"?: number }; Returns: {
              "payee": string
            }[]
                           },
"set_budget":
{ Args: { "p_amount_minor": number,"p_category_id": string,"p_month": string }; Returns: undefined
                           },
"set_recurring_rule_active":
{ Args: { "p_active": boolean,"p_id": string }; Returns: undefined
                           },
"spending_by_category":
{ Args: { "p_exclude_iou"?: boolean,"p_month": string }; Returns: {
              "category_id": string,"spent_minor": number
            }[]
                           },
"update_iou":
{ Args: { "p_base_amount_minor": number,"p_date": string,"p_direction": Database["public"]['Enums']["iou_direction"],"p_due_date"?: string,"p_exchange_rate": string,"p_id": string,"p_note"?: string,"p_original_amount_minor": number,"p_original_currency": string,"p_person_name": string }; Returns: string
                           },
"update_recurring_rule":
{ Args: { "p_amount_minor": number,"p_category_id": string,"p_currency": string,"p_frequency": Database["public"]['Enums']["recurrence_frequency"],"p_id": string,"p_next_due_date": string,"p_note"?: string,"p_payee"?: string,"p_type": Database["public"]['Enums']["transaction_type"] }; Returns: string
                           },
"update_repayment":
{ Args: { "p_amount_minor": number,"p_base_amount_minor": number,"p_currency": string,"p_date": string,"p_exchange_rate": string,"p_id": string,"p_iou_currency_amount_minor": number,"p_iou_currency_rate": string,"p_note"?: string }; Returns: string
                           },
"update_transaction":
{ Args: { "p_base_amount_minor": number,"p_category_id": string,"p_date": string,"p_exchange_rate": string,"p_id": string,"p_note"?: string,"p_original_amount_minor": number,"p_original_currency": string,"p_payee"?: string,"p_type": Database["public"]['Enums']["transaction_type"] }; Returns: string
                           }
          }
          Enums: {
            "accent_theme": "graphite"|"green"|"teal"|"gold"|"rose","iou_direction": "lent"|"borrowed","recurrence_frequency": "daily"|"weekly"|"monthly"|"yearly","system_category_key": "lent"|"repayment_received"|"borrowed"|"repayment_paid","theme_mode": "light"|"dark"|"system","transaction_type": "expense"|"income"|"savings"|"investment"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "accent_theme": ["graphite", "green", "teal", "gold", "rose"],"iou_direction": ["lent", "borrowed"],"recurrence_frequency": ["daily", "weekly", "monthly", "yearly"],"system_category_key": ["lent", "repayment_received", "borrowed", "repayment_paid"],"theme_mode": ["light", "dark", "system"],"transaction_type": ["expense", "income", "savings", "investment"]
          }
        }
} as const

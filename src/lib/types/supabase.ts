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
		PostgrestVersion: '14.1'
	}
	public: {
		Tables: {
			error_logs: {
				Row: {
					browser_info: Json | null
					created_at: string | null
					error_message: string
					game_state: Json | null
					id: string
					stack_trace: string | null
					url: string | null
					user_id: string | null
				}
				Insert: {
					browser_info?: Json | null
					created_at?: string | null
					error_message: string
					game_state?: Json | null
					id?: string
					stack_trace?: string | null
					url?: string | null
					user_id?: string | null
				}
				Update: {
					browser_info?: Json | null
					created_at?: string | null
					error_message?: string
					game_state?: Json | null
					id?: string
					stack_trace?: string | null
					url?: string | null
					user_id?: string | null
				}
				Relationships: [
					{
						foreignKeyName: "error_logs_user_id_fkey"
						columns: ["user_id"]
						isOneToOne: false
						referencedRelation: "profiles"
						referencedColumns: ["id"]
					}
				]
			}
			game_messages: {
				Row: {
					created_at: string | null
					id: string
					is_active: boolean | null
					message_html: string
				}
				Insert: {
					created_at?: string | null
					id?: string
					is_active?: boolean | null
					message_html: string
				}
				Update: {
					created_at?: string | null
					id?: string
					is_active?: boolean | null
					message_html?: string
				}
				Relationships: []
			}
			player_entitlements: {
				Row: {
					acquired_at: string
					item_id: string
					user_id: string
				}
				Insert: {
					acquired_at?: string
					item_id: string
					user_id: string
				}
				Update: {
					acquired_at?: string
					item_id?: string
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: "player_entitlements_user_id_fkey"
						columns: ["user_id"]
						isOneToOne: false
						referencedRelation: "profiles"
						referencedColumns: ["id"]
					}
				]
			}
			player_quarks: {
				Row: {
					balance: number
					lifetime_earned: number
					updated_at: string
					user_id: string
				}
				Insert: {
					balance?: number
					lifetime_earned?: number
					updated_at?: string
					user_id: string
				}
				Update: {
					balance?: number
					lifetime_earned?: number
					updated_at?: string
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: "player_quarks_user_id_fkey"
						columns: ["user_id"]
						isOneToOne: true
						referencedRelation: "profiles"
						referencedColumns: ["id"]
					}
				]
			}
			profiles: {
				Row: {
					atoms: string
					created_at: string | null
					equipped_banner: string | null
					equipped_themes: Json
					id: string
					is_online: boolean | null
					last_updated: string | null
					level: number
					picture: string | null
					save: Json | null
					updated_at: string | null
					username: string | null
				}
				Insert: {
					atoms?: string
					created_at?: string | null
					equipped_banner?: string | null
					equipped_themes?: Json
					id: string
					is_online?: boolean | null
					last_updated?: string | null
					level?: number
					picture?: string | null
					save?: Json | null
					updated_at?: string | null
					username?: string | null
				}
				Update: {
					atoms?: string
					created_at?: string | null
					equipped_banner?: string | null
					equipped_themes?: Json
					id?: string
					is_online?: boolean | null
					last_updated?: string | null
					level?: number
					picture?: string | null
					save?: Json | null
					updated_at?: string | null
					username?: string | null
				}
				Relationships: []
			}
			quark_ledger: {
				Row: {
					created_at: string
					delta: number
					id: number
					item_id: string | null
					reason: string
					ref: string
					user_id: string
				}
				Insert: {
					created_at?: string
					delta: number
					id?: never
					item_id?: string | null
					reason: string
					ref: string
					user_id: string
				}
				Update: {
					created_at?: string
					delta?: number
					id?: number
					item_id?: string | null
					reason?: string
					ref?: string
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: "quark_ledger_user_id_fkey"
						columns: ["user_id"]
						isOneToOne: false
						referencedRelation: "profiles"
						referencedColumns: ["id"]
					}
				]
			}
			score_snapshots: {
				Row: {
					atoms: number
					id: number
					issues: string[]
					level: number
					opened_at: string
					received_at: string
					snapshot: Json
					status: string
					user_id: string
					warnings: string[]
				}
				Insert: {
					atoms: number
					id?: never
					issues?: string[]
					level: number
					opened_at?: string
					received_at?: string
					snapshot: Json
					status: string
					user_id: string
					warnings?: string[]
				}
				Update: {
					atoms?: number
					id?: never
					issues?: string[]
					level?: number
					opened_at?: string
					received_at?: string
					snapshot?: Json
					status?: string
					user_id?: string
					warnings?: string[]
				}
				Relationships: [
					{
						foreignKeyName: "score_snapshots_user_id_fkey"
						columns: ["user_id"]
						isOneToOne: false
						referencedRelation: "profiles"
						referencedColumns: ["id"]
					}
				]
			}
		}
		Views: {
			[_ in never]: never
		}
		Functions: {
			get_collider: {
				Args: {
					p_cooldown_seconds: number
					p_user_id?: string
				}
				Returns: Json
			}
			get_leaderboard: {
				Args: { p_limit?: number }
				Returns: {
					atoms: string
					equipped_banner: string | null
					id: string
					is_online: boolean
					last_updated: string
					level: number
					picture: string
					updated_at: string
					username: string
				}[]
			}
			get_score_context: {
				Args: { p_user_id: string }
				Returns: Json
			}
			get_secret: {
				Args: { name: string }
				Returns: string
			}
			grant_achievement_quarks: {
				Args: {
					p_achievement_ids: string[]
					p_reward: number
					p_user_id: string
				}
				Returns: Json
			}
			grant_quarks: {
				Args: {
					p_daily_cap?: number
					p_delta: number
					p_reason: string
					p_ref: string
					p_user_id: string
				}
				Returns: Json
			}
			inject_collider: {
				Args: {
					p_cooldown_seconds: number
					p_user_id: string
				}
				Returns: Json
			}
			purchase_quark_item: {
				Args: {
					p_cost: number
					p_item_id: string
					p_user_id: string
				}
				Returns: Json
			}
			refund_quark_item: {
				Args: {
					p_item_id: string
					p_user_id: string
				}
				Returns: Json
			}
			record_score: {
				Args: {
					p_atoms: number
					p_issues: string[]
					p_level: number
					p_picture?: string
					p_snapshot: Json
					p_user_id: string
					p_username?: string
					p_valid: boolean
					p_warnings: string[]
				}
				Returns: Json
			}
			send_discord_daily_recap: {
				Args: Record<PropertyKey, never>
				Returns: undefined
			}
		}
		Enums: {
			[_ in never]: never
		}
		CompositeTypes: {
			[_ in never]: never
		}
	}
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
				DefaultSchema['Views'])
		? (DefaultSchema['Tables'] &
				DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R
			}
			? R
			: never
		: never

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I
			}
			? I
			: never
		: never

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U
			}
			? U
			: never
		: never

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema['Enums']
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never = never
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema['CompositeTypes']
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never

export const Constants = {
	public: {
		Enums: {},
	},
} as const

// Helper types
export type Profile = Tables<'profiles'>
export type ProfileInsert = TablesInsert<'profiles'>
export type ProfileUpdate = TablesUpdate<'profiles'>
export type GameMessage = Tables<'game_messages'>

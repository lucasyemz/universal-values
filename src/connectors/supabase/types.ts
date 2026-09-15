// Contract for the initial migration. Regenerate with Supabase CLI after schema changes.
type ReadTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      workspaces: ReadTable<{ id: string; name: string; created_at: string }>;
      workspace_members: ReadTable<{ workspace_id: string; user_id: string; role: "owner" | "member"; created_at: string }>;
      workspace_previews: ReadTable<{ id: string; actor_id: string; name: string; created_at: string; expires_at: string; workspace_id: string | null; confirmed_at: string | null }>;
      audit_events: ReadTable<{ id: string; actor_id: string; workspace_id: string | null; preview_id: string; action: string; created_at: string }>;
    };
    Views: { [_ in never]: never };
    Functions: {
      preview_workspace: { Args: { p_id: string; p_name: string }; Returns: string };
      confirm_workspace: { Args: { p_id: string }; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

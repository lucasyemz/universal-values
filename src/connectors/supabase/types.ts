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
      webflow_connections: ReadTable<{ id: string; workspace_id: string; actor_id: string; state_hash: string; status: "pending" | "exchanging" | "ready"; created_at: string; expires_at: string }>;
      sites: ReadTable<{ id: string; workspace_id: string; connection_id: string; webflow_site_id: string; display_name: string; created_at: string }>;
      site_connection_previews: ReadTable<{ id: string; workspace_id: string; connection_id: string; actor_id: string; webflow_site_id: string; display_name: string; expires_at: string; site_id: string | null; expected_connection_id: string | null }>;
      integration_audit_events: ReadTable<{ id: string; workspace_id: string; actor_id: string; operation_id: string; action: string; created_at: string }>;
      workspaces: ReadTable<{ id: string; name: string; created_at: string }>;
      workspace_members: ReadTable<{ workspace_id: string; user_id: string; role: "owner" | "member"; created_at: string }>;
      workspace_previews: ReadTable<{ id: string; actor_id: string; name: string; created_at: string; expires_at: string; workspace_id: string | null; confirmed_at: string | null }>;
      audit_events: ReadTable<{ id: string; actor_id: string; workspace_id: string | null; preview_id: string; action: string; created_at: string }>;
    };
    Views: { [_ in never]: never };
    Functions: {
      start_webflow_oauth: { Args: { p_id: string; p_workspace_id: string; p_state_hash: string }; Returns: string };
      claim_webflow_callback: { Args: { p_id: string; p_state_hash: string }; Returns: string };
      complete_webflow_oauth: { Args: { p_id: string; p_ciphertext: string }; Returns: string };
      read_webflow_credential: { Args: { p_id: string }; Returns: string };
      preview_webflow_site: { Args: { p_id: string; p_connection_id: string; p_site_id: string; p_name: string }; Returns: string };
      confirm_webflow_site: { Args: { p_id: string }; Returns: string };
      preview_workspace: { Args: { p_id: string; p_name: string }; Returns: string };
      confirm_workspace: { Args: { p_id: string }; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

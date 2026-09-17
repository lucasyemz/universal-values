// Contract for the initial migration. Regenerate with Supabase CLI after schema changes.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type ReadTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      designer_sessions: ReadTable<{ id: string; site_id: string; actor_id: string; created_at: string; expires_at: string; revoked_at: string | null }>;
      designer_changes: ReadTable<{ id: string; site_id: string; actor_id: string; session_id: string; plan: Json; search_text: string; events: Json; created_at: string; expires_at: string }>;
      cms_change_requests: ReadTable<{ reverts_request_id: string | null; id: string; scan_id: string; site_id: string; workspace_id: string; actor_id: string; connection_id: string; changes: Json; status: string; cursor: number; total: number; dispatched: boolean; lease_token: string | null; lease_until: string | null; retry_at: string | null; results: Json; expires_at: string; created_at: string }>;
      cms_scans: ReadTable<{ id: string; site_id: string; workspace_id: string; actor_id: string; connection_id: string; plan: Json; status: string; collection_index: number; item_offset: number; revision: number; items_read: number; occurrences_count: number; truncated: boolean; skipped_fields: number; error_code: string | null; retry_at: string | null; expires_at: string; created_at: string; lease_token: string | null; lease_until: string | null }>;
      scan_occurrences: ReadTable<{ id: string; scan_id: string; site_id: string; workspace_id: string; collection_id: string; collection_name: string; item_id: string; item_name: string; locale: string; field_slug: string; field_name: string; field_type: string; source_value: string; raw_match: string; start_pos: number; end_pos: number; canonical: Json; source_key: string }>;
      managed_values: ReadTable<{ id: string; site_id: string; workspace_id: string; name: string; canonical: Json; version: number; created_at: string }>;
      managed_value_previews: ReadTable<{ id: string; scan_id: string; site_id: string; workspace_id: string; actor_id: string; name: string; canonical: Json; occurrence_ids: string[]; managed_value_id: string | null; expires_at: string }>;
      managed_value_bindings: ReadTable<{ id: string; managed_value_id: string; site_id: string; workspace_id: string; source_key: string; collection_id: string; item_id: string; locale: string; field_slug: string; field_type: string; source_value: string; locations: Json }>;
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
      authorize_designer_session: { Args: { p_id: string; p_site_id: string; p_token_hash: string }; Returns: string };
      revoke_designer_session: { Args: { p_id: string }; Returns: undefined };
      designer_gateway: { Args: { p_token_hash: string; p_webflow_site_id: string; p_action: string; p_payload: Json }; Returns: Json };
      set_scan_content_reviewed: { Args: { p_id: string; p_scan_id: string; p_occurrence_ids: string[]; p_reviewed: boolean }; Returns: string };
      scan_reviewed_occurrences: { Args: { p_scan_id: string }; Returns: { occurrence_id: string }[] };
      preview_cms_revert: { Args: { p_id: string; p_original_id: string; p_sources?: Json }; Returns: string };
      preview_cms_changes: { Args: { p_id: string; p_scan_id: string; p_changes: Json }; Returns: string };
      confirm_cms_changes: { Args: { p_id: string }; Returns: string };
      claim_cms_change: { Args: { p_id: string; p_cursor: number; p_lease: string }; Returns: boolean };
      dispatch_cms_change: { Args: { p_id: string; p_cursor: number; p_lease: string }; Returns: boolean };
      finish_cms_change: { Args: { p_id: string; p_cursor: number; p_lease: string; p_result: Json; p_wait?: number }; Returns: string };
      cancel_cms_changes: { Args: { p_id: string }; Returns: string };
      preview_cms_scan: { Args: { p_id: string; p_site_id: string; p_plan: Json; p_truncated: boolean }; Returns: string };
      confirm_cms_scan: { Args: { p_id: string }; Returns: string };
      claim_cms_scan_batch: { Args: { p_id: string; p_revision: number; p_lease: string }; Returns: boolean };
      save_cms_scan_batch: { Args: { p_id: string; p_revision: number; p_lease: string; p_rows: Json; p_items: number; p_next_collection: number; p_next_offset: number; p_truncated: boolean; p_skipped: number }; Returns: string };
      pause_cms_scan: { Args: { p_id: string; p_revision: number; p_lease: string; p_error: string; p_wait: number }; Returns: string };
      cancel_cms_scan: { Args: { p_id: string }; Returns: string };
      preview_managed_value: { Args: { p_id: string; p_scan_id: string; p_name: string; p_occurrence_ids: string[] }; Returns: string };
      confirm_managed_value: { Args: { p_id: string }; Returns: string };
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

begin;

-- Change only URL presentation in the existing capability gateways. Authentication,
-- quotas, scope predicates, dispatch and audit code remain byte-for-byte unchanged.
-- Fail closed if the expected function body has changed instead of silently
-- installing a partial patch. No customer data, slugs or resource numbers change.
do $migration$
declare definition text; old_fragment text; new_fragment text;
begin
  definition := pg_get_functiondef('public.designer_gateway(text,text,text,jsonb)'::regprocedure);
  old_fragment := $old$select '/dashboard/' || a.slug || '/sites/' || v_site.slug into v_base
      from public.account_routes a where a.user_id=v_site.account_id;$old$;
  new_fragment := $new$select '/dashboard/' || w.slug || '/sites/' || v_site.slug into v_base
      from public.workspace_routes w where w.account_id=v_site.account_id and w.workspace_id=v_site.workspace_id;$new$;
  if position(old_fragment in definition)=0 then raise exception 'Unexpected Designer URL contract'; end if;
  execute replace(definition,old_fragment,new_fragment);

  definition := pg_get_functiondef('public.mcp_read(text,text,jsonb)'::regprocedure);
  old_fragment := $old$if p_action='authenticate' then return jsonb_build_object('actor',t.actor_id,'workspace',t.workspace_id,'scope',t.scope); end if;$old$;
  new_fragment := $new$if p_action='authenticate' then return jsonb_build_object('actor',t.actor_id,'workspace',t.workspace_id,'scope',t.scope,
    'workspaceSlug',(select w.slug from public.workspace_routes w where w.account_id=t.actor_id and w.workspace_id=t.workspace_id)); end if;$new$;
  if position(old_fragment in definition)=0 then raise exception 'Unexpected MCP authentication contract'; end if;
  execute replace(definition,old_fragment,new_fragment);
end $migration$;

commit;

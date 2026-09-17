begin;

create or replace function public.valid_managed_canonical(v jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare n integer; ok boolean;
begin
  if v is null or jsonb_typeof(v) <> 'object' then return false; end if;
  select count(*) into n from jsonb_object_keys(v);
  case v->>'type'
    when 'link' then ok := n=2 and jsonb_typeof(v->'url')='string' and char_length(v->>'url') between 1 and 2000 and v->>'url' ~* '^(https?://|/[^/]|#[^[:space:]]|mailto:|tel:)' and v->>'url' !~ '[[:space:][:cntrl:]]';
    when 'image' then ok := n=2 and jsonb_typeof(v->'url')='string' and char_length(v->>'url') between 1 and 2000 and v->>'url' ~* '^https?://[^/[:space:]]+' and v->>'url' !~ '[[:space:][:cntrl:]]';
    when 'money' then ok := n=3 and jsonb_typeof(v->'amount')='string' and v->>'amount' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' and v->>'currency' in ('BRL','USD','EUR');
    when 'number' then ok := n=2 and jsonb_typeof(v->'number')='string' and v->>'number' ~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?$';
    when 'phone' then ok := n=2 and jsonb_typeof(v->'number')='string' and v->>'number' ~ '^\+[1-9][0-9]{6,14}$';
    when 'date' then ok := n=2 and v->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and to_char((v->>'date')::date,'YYYY-MM-DD')=v->>'date';
    when 'text' then ok := n=2 and jsonb_typeof(v->'text')='string' and char_length(btrim(v->>'text')) between 1 and 10000;
    else return false;
  end case;
  return coalesce(ok,false);
exception when others then return false;
end $$;
revoke all on function public.valid_managed_canonical(jsonb) from public, anon, authenticated;

alter table public.scan_occurrences drop constraint scan_occurrences_field_type_check;
alter table public.scan_occurrences add constraint scan_occurrences_field_type_check check(field_type in ('PlainText','Number','Link','RichText','Image','ImageRef','MultiImage'));

commit;

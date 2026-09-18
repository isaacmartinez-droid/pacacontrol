-- Permite agregar categorías por decisión del usuario, sin inventar compras.
begin;
alter table public.categories add column if not exists is_user_created boolean not null default false;

create or replace view public.inventory_summary
with (security_invoker = true) as
select c.id as category_id, c.owner_id, c.slug, c.name,
  coalesce(sum(bi.received_quantity), 0)::integer as received_pieces,
  coalesce(sum(bi.sold_quantity), 0)::integer as sold_pieces,
  coalesce(sum(bi.damaged_quantity), 0)::integer as damaged_pieces,
  coalesce(sum(bi.available_quantity), 0)::integer as available_pieces,
  c.economic_price, c.standard_price, c.premium_price, c.is_user_created
from public.categories c
left join public.bale_inventory bi on bi.category_id = c.id and bi.is_active
left join public.bales b on b.id = bi.bale_id and b.archived_at is null
where bi.id is null or b.id is not null
group by c.id;
grant select on public.inventory_summary to authenticated;
notify pgrst, 'reload schema';
commit;

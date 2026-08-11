-- ============================================================================
-- ລະບົບບັນທຶກສິນຄ້າຫັດຖະກຳ (Handicraft Store) — Supabase schema
-- Migration: 0001_init
-- ໄຟລ໌ນີ້ run ຊ້ຳໄດ້ຫຼາຍເທື່ອ (idempotent) — ບໍ່ພັງຂໍ້ມູນເກົ່າ
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. ຜູ້ໃຊ້ ແລະ ສິດ (admin / staff)
-- ----------------------------------------------------------------------------

-- ອີເມວທີ່ຈະໄດ້ສິດ admin ອັດຕະໂນມັດເມື່ອ login ຄັ້ງທຳອິດ
create table if not exists public.admin_allowlist (
  email text primary key,
  note  text
);

insert into public.admin_allowlist (email, note)
values ('sengdeuan.boutdavong@gmail.com', 'ເຈົ້າຂອງລະບົບ')
on conflict (email) do nothing;

create table if not exists public.app_users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  avatar_url text,
  role       text not null default 'staff' check (role in ('admin', 'staff')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.app_users is 'ໂປຣໄຟລ໌ຜູ້ໃຊ້ + ສິດການໃຊ້ງານ (admin / staff)';

-- ສ້າງແຖວ app_users ອັດຕະໂນມັດເມື່ອມີຄົນ sign-in ໃໝ່ (GitHub / email)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (id, email, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.email, new.raw_user_meta_data ->> 'email', ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    case
      when exists (
        select 1 from public.admin_allowlist a
        where lower(a.email) = lower(coalesce(new.email, new.raw_user_meta_data ->> 'email', ''))
      ) then 'admin'
      else 'staff'
    end
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(excluded.full_name,  app_users.full_name),
        avatar_url = coalesce(excluded.avatar_url, app_users.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ຮັບປະກັນວ່າຜູ້ໃຊ້ທີ່ login ຢູ່ມີແຖວໃນ app_users (ໃຊ້ກັບບັນຊີທີ່ສ້າງກ່ອນ trigger
-- ນີ້ຖືກຕິດຕັ້ງ) ແລະ ອັບເກຣດເປັນ admin ໃຫ້ ຖ້າອີເມວຢູ່ໃນ admin_allowlist
create or replace function public.ensure_profile()
returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  u   auth.users%rowtype;
  rec public.app_users%rowtype;
  em  text;
begin
  select * into u from auth.users where id = auth.uid();
  if u.id is null then
    raise exception 'ບໍ່ໄດ້ເຂົ້າສູ່ລະບົບ';
  end if;
  em := coalesce(u.email, u.raw_user_meta_data ->> 'email', '');

  insert into public.app_users (id, email, full_name, avatar_url, role)
  values (
    u.id, em,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
    u.raw_user_meta_data ->> 'avatar_url',
    case when exists (select 1 from public.admin_allowlist a where lower(a.email) = lower(em))
         then 'admin' else 'staff' end
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(excluded.full_name,  app_users.full_name),
        avatar_url = coalesce(excluded.avatar_url, app_users.avatar_url),
        role       = case
                       when app_users.role = 'admin' then 'admin'
                       when exists (select 1 from public.admin_allowlist a
                                    where lower(a.email) = lower(excluded.email)) then 'admin'
                       else app_users.role
                     end
  returning * into rec;

  return rec;
end;
$$;

-- SECURITY DEFINER: ອ່ານ role ໄດ້ໂດຍບໍ່ຕິດ RLS recursion
create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.role from public.app_users u where u.id = auth.uid() and u.active),
    'none'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role_name() = 'admin';
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role_name() in ('admin', 'staff');
$$;

-- ----------------------------------------------------------------------------
-- 2. ຕາຕະລາງຫຼັກ
-- ----------------------------------------------------------------------------

create table if not exists public.sources (
  id         uuid primary key default gen_random_uuid(),
  code       text,
  name       text not null,
  contact    text,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sources is 'ແຫຼ່ງສິນຄ້າ / ຜູ້ຜະລິດ';

create table if not exists public.products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text not null default 'ຕິບເຂົ້າ',
  source_id  uuid references public.sources (id) on delete set null,
  unit       text not null default 'ອັນ',
  min_stock  numeric not null default 8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.products is 'ລາຍການສິນຄ້າ';
comment on column public.products.min_stock is 'ຈຳນວນຕ່ຳສຸດ — ຕ່ຳກວ່ານີ້ຈະເຕືອນສິນຄ້າໃກ້ໝົດ';

create table if not exists public.incomings (
  id         uuid primary key default gen_random_uuid(),
  date       date not null default current_date,
  product_id uuid not null references public.products (id) on delete cascade,
  source_id  uuid references public.sources (id) on delete set null,
  qty        numeric not null check (qty > 0),
  unit       text not null default 'ອັນ',
  cost       numeric not null default 0 check (cost >= 0),
  note       text,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.incomings is 'ບັນທຶກການນຳເຂົ້າສິນຄ້າ (ຕົ້ນທຶນຕໍ່ໜ່ວຍ)';

create table if not exists public.sales (
  id         uuid primary key default gen_random_uuid(),
  date       date not null default current_date,
  product_id uuid not null references public.products (id) on delete cascade,
  customer   text,
  qty        numeric not null check (qty > 0),
  price      numeric not null default 0 check (price >= 0),
  note       text,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sales is 'ບັນທຶກການຂາຍ (ລາຄາຂາຍຕໍ່ໜ່ວຍ)';

create index if not exists idx_products_source   on public.products  (source_id);
create index if not exists idx_incomings_product on public.incomings (product_id);
create index if not exists idx_incomings_date    on public.incomings (date desc);
create index if not exists idx_sales_product     on public.sales     (product_id);
create index if not exists idx_sales_date        on public.sales     (date desc);

-- updated_at ອັດຕະໂນມັດ
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['sources', 'products', 'incomings', 'sales'] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$s
         for each row execute function public.touch_updated_at()', t);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Views ສຳລັບໜ້າພາບລວມ (Dashboard)
-- ----------------------------------------------------------------------------

-- ລຶບກ່ອນສ້າງໃໝ່ ເພື່ອໃຫ້ແກ້ຄໍລຳໃນ view ໄດ້ຕອນ run ຊ້ຳ
drop view if exists public.dashboard_summary cascade;
drop view if exists public.sales_by_source   cascade;
drop view if exists public.sales_by_month    cascade;
drop view if exists public.incomings_detail  cascade;
drop view if exists public.sales_detail      cascade;
drop view if exists public.product_stock     cascade;

-- ສະຕັອກ + ຕົ້ນທຶນສະເລ່ຍ ຕໍ່ສິນຄ້າ
create or replace view public.product_stock
with (security_invoker = on) as
select
  p.id                                                as product_id,
  p.name,
  p.category,
  p.unit,
  p.min_stock,
  p.source_id,
  s.name                                              as source_name,
  coalesce(i.in_qty, 0)                               as in_qty,
  coalesce(x.out_qty, 0)                              as out_qty,
  coalesce(i.in_qty, 0) - coalesce(x.out_qty, 0)      as stock,
  case when coalesce(i.in_qty, 0) > 0
       then round(i.total_cost / i.in_qty, 2) else 0 end as avg_cost,
  coalesce(x.revenue, 0)                              as revenue,
  (coalesce(i.in_qty, 0) - coalesce(x.out_qty, 0)) < p.min_stock as is_low
from public.products p
left join public.sources s on s.id = p.source_id
left join lateral (
  select sum(qty) as in_qty, sum(qty * cost) as total_cost
  from public.incomings where product_id = p.id
) i on true
left join lateral (
  select sum(qty) as out_qty, sum(qty * price) as revenue
  from public.sales where product_id = p.id
) x on true;

-- ລາຍລະອຽດການຂາຍ + ກຳໄລ (ໃຊ້ຕົ້ນທຶນສະເລ່ຍ)
create or replace view public.sales_detail
with (security_invoker = on) as
select
  sa.id,
  sa.date,
  sa.product_id,
  p.name                       as product_name,
  p.category,
  p.source_id,
  src.name                     as source_name,
  sa.customer,
  sa.qty,
  sa.price,
  sa.qty * sa.price            as subtotal,
  ps.avg_cost,
  sa.qty * ps.avg_cost         as cogs,
  sa.qty * sa.price - sa.qty * ps.avg_cost as profit,
  sa.note,
  sa.created_by,
  sa.created_at
from public.sales sa
join public.products p        on p.id = sa.product_id
left join public.sources src  on src.id = p.source_id
left join public.product_stock ps on ps.product_id = sa.product_id;

-- ລາຍລະອຽດການນຳເຂົ້າ
create or replace view public.incomings_detail
with (security_invoker = on) as
select
  i.id,
  i.date,
  i.product_id,
  p.name                as product_name,
  i.source_id,
  s.name                as source_name,
  i.qty,
  i.unit,
  i.cost,
  i.qty * i.cost        as total_cost,
  i.note,
  i.created_by,
  i.created_at
from public.incomings i
join public.products p       on p.id = i.product_id
left join public.sources s   on s.id = i.source_id;

-- ຍອດຂາຍຕາມເດືອນ
create or replace view public.sales_by_month
with (security_invoker = on) as
select
  to_char(date, 'YYYY-MM') as month,
  sum(subtotal)            as revenue,
  sum(profit)              as profit,
  sum(qty)                 as qty
from public.sales_detail
group by 1
order by 1;

-- ຍອດຂາຍຕາມແຫຼ່ງສິນຄ້າ
create or replace view public.sales_by_source
with (security_invoker = on) as
select
  coalesce(source_name, '-') as source_name,
  sum(subtotal)              as revenue,
  sum(profit)                as profit,
  sum(qty)                   as qty
from public.sales_detail
group by 1
order by 2 desc;

-- ສະຫຼຸບລວມ
create or replace view public.dashboard_summary
with (security_invoker = on) as
select
  (select coalesce(sum(subtotal), 0) from public.sales_detail)       as total_revenue,
  (select coalesce(sum(profit), 0)   from public.sales_detail)       as total_profit,
  (select coalesce(sum(stock), 0)    from public.product_stock)      as total_stock,
  (select count(*) from public.product_stock where is_low)           as low_stock_count,
  (select count(*) from public.products)                             as product_count,
  (select count(*) from public.sources)                              as source_count;

-- ----------------------------------------------------------------------------
-- 4. Row Level Security
--    admin = ເຮັດໄດ້ທຸກຢ່າງ | staff = ບັນທຶກນຳເຂົ້າ/ຂາຍ ໄດ້, ແກ້ໄຂໄດ້ສະເພາະຂອງຕົນ
-- ----------------------------------------------------------------------------

alter table public.app_users       enable row level security;
alter table public.admin_allowlist enable row level security;
alter table public.sources         enable row level security;
alter table public.products        enable row level security;
alter table public.incomings       enable row level security;
alter table public.sales           enable row level security;

do $$
declare pol record;
begin
  for pol in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('app_users','admin_allowlist','sources','products','incomings','sales')
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end;
$$;

-- app_users: ເບິ່ງໂປຣໄຟລ໌ຕົນເອງໄດ້ສະເໝີ; admin ເບິ່ງ/ແກ້ໄດ້ໝົດ
create policy app_users_select_self  on public.app_users for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy app_users_update_admin on public.app_users for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy app_users_delete_admin on public.app_users for delete to authenticated
  using (public.is_admin() and id <> auth.uid());

-- admin_allowlist: admin ເທົ່ານັ້ນ
create policy allowlist_all_admin on public.admin_allowlist for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- sources / products: ທຸກຄົນທີ່ login ອ່ານໄດ້, admin ເທົ່ານັ້ນທີ່ແກ້ໄດ້
create policy sources_select on public.sources for select to authenticated using (public.is_staff());
create policy sources_write  on public.sources for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy products_select on public.products for select to authenticated using (public.is_staff());
create policy products_write  on public.products for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- incomings / sales: staff ບັນທຶກໄດ້, ແກ້/ລຶບໄດ້ສະເພາະລາຍການທີ່ຕົນສ້າງ; admin ໄດ້ໝົດ
create policy incomings_select on public.incomings for select to authenticated
  using (public.is_staff());
create policy incomings_insert on public.incomings for insert to authenticated
  with check (public.is_staff() and (created_by = auth.uid() or created_by is null));
create policy incomings_update on public.incomings for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());
create policy incomings_delete on public.incomings for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

create policy sales_select on public.sales for select to authenticated
  using (public.is_staff());
create policy sales_insert on public.sales for insert to authenticated
  with check (public.is_staff() and (created_by = auth.uid() or created_by is null));
create policy sales_update on public.sales for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());
create policy sales_delete on public.sales for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. ສິດເຂົ້າເຖິງ
-- ----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on public.product_stock, public.sales_detail, public.incomings_detail,
                public.sales_by_month, public.sales_by_source, public.dashboard_summary
  to authenticated;
grant select, insert, update, delete
  on public.sources, public.products, public.incomings, public.sales, public.app_users,
     public.admin_allowlist
  to authenticated;

grant execute on function public.ensure_profile()     to authenticated;
grant execute on function public.is_admin()           to authenticated;
grant execute on function public.is_staff()           to authenticated;
grant execute on function public.current_role_name()  to authenticated;

-- ບອກ PostgREST ໃຫ້ໂຫຼດໂຄງສ້າງໃໝ່ (ບໍ່ຕ້ອງລໍ)
notify pgrst, 'reload schema';

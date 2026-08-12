-- ============================================================================
-- Migration: 0003_password_login
-- ຮອງຮັບການສະໝັກ/ເຂົ້າສູ່ລະບົບດ້ວຍລະຫັດຜ່ານ
--
-- ເມື່ອເປີດໃຫ້ສະໝັກເອງໃນເວັບສາທາລະນະ ຕ້ອງມີດ່ານກັນ:
-- ຜູ້ໃຊ້ໃໝ່ຈະຢູ່ໃນສະຖານະ "ລໍຖ້າອະນຸມັດ" (active = false) ຈົນກວ່າ admin ຈະເປີດໃຫ້
-- ຄົນທີ່ຢູ່ໃນ admin_allowlist ໄດ້ໃຊ້ທັນທີ ບໍ່ຕ້ອງລໍ
--
-- ຜູ້ໃຊ້ທີ່ມີຢູ່ແລ້ວບໍ່ໄດ້ຮັບຜົນກະທົບ — ຍັງໃຊ້ໄດ້ຄືເກົ່າ
-- ============================================================================

-- ຄ່າເລີ່ມຕົ້ນໃໝ່: ຕ້ອງລໍອະນຸມັດ (ແຖວເກົ່າບໍ່ປ່ຽນ)
alter table public.app_users alter column active set default false;

comment on column public.app_users.active is
  'false = ລໍຖ້າ admin ອະນຸມັດ ຫຼື ຖືກປິດການໃຊ້ງານ. is_staff()/is_admin() ຈະເປັນ false';

-- ບອກວັນທີອະນຸມັດ ເພື່ອໃຫ້ admin ຮູ້ວ່າໃຜລໍຢູ່ດົນປານໃດ
alter table public.app_users add column if not exists approved_at timestamptz;

update public.app_users set approved_at = created_at
  where active and approved_at is null;

create or replace function public.stamp_approval()
returns trigger
language plpgsql
as $$
begin
  if new.active and not coalesce(old.active, false) then
    new.approved_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_approval on public.app_users;
create trigger trg_stamp_approval
  before update on public.app_users
  for each row execute function public.stamp_approval();

-- ----------------------------------------------------------------------------
-- ອັບເດດ 2 ຟັງຊັນໃຫ້ຮູ້ຈັກ active
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  em       text;
  is_owner boolean;
begin
  em := coalesce(new.email, new.raw_user_meta_data ->> 'email', '');
  is_owner := exists (
    select 1 from public.admin_allowlist a where lower(a.email) = lower(em)
  );

  insert into public.app_users (id, email, full_name, avatar_url, role, active, approved_at)
  values (
    new.id, em,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    case when is_owner then 'admin' else 'staff' end,
    is_owner,                              -- admin ໃຊ້ໄດ້ທັນທີ, ຄົນອື່ນລໍອະນຸມັດ
    case when is_owner then now() end
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(excluded.full_name,  app_users.full_name),
        avatar_url = coalesce(excluded.avatar_url, app_users.avatar_url);
  return new;
end;
$$;

create or replace function public.ensure_profile()
returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  u        auth.users%rowtype;
  rec      public.app_users%rowtype;
  em       text;
  is_owner boolean;
begin
  select * into u from auth.users where id = auth.uid();
  if u.id is null then
    raise exception 'ບໍ່ໄດ້ເຂົ້າສູ່ລະບົບ';
  end if;
  em := coalesce(u.email, u.raw_user_meta_data ->> 'email', '');
  is_owner := exists (
    select 1 from public.admin_allowlist a where lower(a.email) = lower(em)
  );

  insert into public.app_users (id, email, full_name, avatar_url, role, active, approved_at)
  values (
    u.id, em,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
    u.raw_user_meta_data ->> 'avatar_url',
    case when is_owner then 'admin' else 'staff' end,
    is_owner,
    case when is_owner then now() end
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(excluded.full_name,  app_users.full_name),
        avatar_url = coalesce(excluded.avatar_url, app_users.avatar_url),
        role       = case
                       when app_users.role = 'admin' then 'admin'
                       when is_owner then 'admin'
                       else app_users.role
                     end,
        -- ບໍ່ແຕະ active ຂອງຄົນທົ່ວໄປ (ເຄົາລົບການຕັດສິນຂອງ admin)
        -- ແຕ່ເຈົ້າຂອງລະບົບຕ້ອງເຂົ້າໄດ້ສະເໝີ ກັນລັອກຕົນເອງອອກ
        active     = case when is_owner then true else app_users.active end
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;

-- ----------------------------------------------------------------------------
-- View ໃຫ້ admin ເຫັນຄົນທີ່ລໍອະນຸມັດ
-- ----------------------------------------------------------------------------

drop view if exists public.pending_users cascade;
create view public.pending_users
with (security_invoker = on) as
select id, email, full_name, role, created_at
from public.app_users
where not active
order by created_at;

grant select on public.pending_users to authenticated;

notify pgrst, 'reload schema';

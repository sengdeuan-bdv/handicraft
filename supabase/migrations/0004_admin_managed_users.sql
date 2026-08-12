-- ============================================================================
-- Migration: 0004_admin_managed_users
--
-- ປ່ຽນຈາກ "ພະນັກງານສະໝັກເອງ + ລໍອະນຸມັດ" ມາເປັນ "admin ສ້າງບັນຊີໃຫ້"
-- ຜົນຄື: ບໍ່ຕ້ອງເພິ່ງອີເມວເລີຍ — ບໍ່ມີລິ້ງຢືນຢັນ, ບໍ່ຕິດຂີດຈຳກັດການສົ່ງອີເມວ
--
-- ຟັງຊັນລຸ່ມນີ້ຂຽນລົງ auth.users ໂດຍກົງ. Supabase ບໍ່ໄດ້ຮັບປະກັນໂຄງສ້າງ
-- ຕາຕະລາງນີ້ຂ້າມລຸ້ນ — ຖ້າວັນໃດ upgrade ແລ້ວພັງ ໃຫ້ກັບມາເບິ່ງໄຟລ໌ນີ້ກ່ອນ
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ຕັ້ງບັນຊີ admin ຄັ້ງທຳອິດ — ແລ່ນຈາກ SQL Editor ເທົ່ານັ້ນ
--    ໃຊ້ໄດ້ທັງສ້າງໃໝ່ ແລະ ຕັ້ງລະຫັດຜ່ານໃຫ້ບັນຊີທີ່ມີຢູ່ແລ້ວ
-- ----------------------------------------------------------------------------

create or replace function public.bootstrap_admin(p_email text, p_password text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid;
  note text;
begin
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ';
  end if;
  p_email := lower(trim(p_email));

  select id into uid from auth.users where lower(email) = p_email;

  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      uid, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
    );
    note := 'ສ້າງບັນຊີໃໝ່';
  else
    update auth.users
    set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at         = now()
    where id = uid;
    note := 'ຕັ້ງລະຫັດຜ່ານໃໝ່ໃຫ້ບັນຊີເກົ່າ';
  end if;

  -- ຕ້ອງມີແຖວ identity ແບບ email ຈຶ່ງເຂົ້າດ້ວຍລະຫັດຜ່ານໄດ້
  if not exists (
    select 1 from auth.identities where user_id = uid and provider = 'email'
  ) then
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      created_at, updated_at, last_sign_in_at
    ) values (
      gen_random_uuid(), uid::text, uid,
      jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  insert into public.admin_allowlist (email, note)
  values (p_email, 'ຕັ້ງໂດຍ bootstrap_admin')
  on conflict (email) do nothing;

  insert into public.app_users (id, email, role, active, approved_at)
  values (uid, p_email, 'admin', true, now())
  on conflict (id) do update
    set role = 'admin', active = true,
        approved_at = coalesce(app_users.approved_at, now());

  return note || ': ' || p_email || ' → admin (ເຂົ້າດ້ວຍອີເມວ + ລະຫັດຜ່ານໄດ້ເລີຍ)';
end;
$$;

-- ຫ້າມເອີ້ນຈາກເວັບ — ແລ່ນຈາກ SQL Editor ເທົ່ານັ້ນ
revoke all on function public.bootstrap_admin(text, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. admin ສ້າງບັນຊີໃຫ້ພະນັກງານຈາກໃນເວັບ
-- ----------------------------------------------------------------------------

create or replace function public.admin_create_user(
  p_email     text,
  p_password  text,
  p_role      text default 'staff',
  p_full_name text default null
)
returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  rec public.app_users%rowtype;
begin
  if not public.is_admin() then
    raise exception 'ສະເພາະ admin ເທົ່ານັ້ນທີ່ສ້າງບັນຊີໄດ້';
  end if;
  if p_role not in ('admin', 'staff') then
    raise exception 'ສິດຕ້ອງເປັນ admin ຫຼື staff';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ';
  end if;

  p_email := lower(trim(p_email));
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'ຮູບແບບອີເມວບໍ່ຖືກຕ້ອງ';
  end if;
  if exists (select 1 from auth.users where lower(email) = p_email) then
    raise exception 'ອີເມວນີ້ມີບັນຊີຢູ່ແລ້ວ';
  end if;

  uid := gen_random_uuid();

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    uid, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    case when p_full_name is null then '{}'::jsonb
         else jsonb_build_object('full_name', p_full_name) end
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    created_at, updated_at, last_sign_in_at
  ) values (
    gen_random_uuid(), uid::text, uid,
    jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- trigger handle_new_user ສ້າງແຖວໃຫ້ແລ້ວ — ຕັ້ງຄ່າຕາມທີ່ admin ເລືອກ
  update public.app_users
  set role        = p_role,
      full_name   = coalesce(p_full_name, full_name),
      active      = true,
      approved_at = now()
  where id = uid
  returning * into rec;

  return rec;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. admin ຕັ້ງລະຫັດຜ່ານໃໝ່ໃຫ້ຜູ້ໃຊ້ (ກໍລະນີພະນັກງານລືມ)
-- ----------------------------------------------------------------------------

create or replace function public.admin_set_password(p_user_id uuid, p_password text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare em text;
begin
  if not public.is_admin() then
    raise exception 'ສະເພາະ admin ເທົ່ານັ້ນ';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ';
  end if;

  select email into em from auth.users where id = p_user_id;
  if em is null then
    raise exception 'ບໍ່ພົບຜູ້ໃຊ້';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at         = now()
  where id = p_user_id;

  return em;
end;
$$;

grant execute on function public.admin_create_user(text, text, text, text) to authenticated;
grant execute on function public.admin_set_password(uuid, text)            to authenticated;

notify pgrst, 'reload schema';

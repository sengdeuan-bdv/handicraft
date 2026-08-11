-- ============================================================================
-- Migration: 0002_seed — ຂໍ້ມູນຕົວຢ່າງຈາກ HTML ເດີມ
-- ໃສ່ໃຫ້ເທື່ອດຽວ. ຖ້າຕາຕະລາງມີຂໍ້ມູນຢູ່ແລ້ວ ຈະຂ້າມໄປ (ບໍ່ຊ້ຳ).
-- ບໍ່ຢາກໄດ້ຂໍ້ມູນຕົວຢ່າງ → ລຶບໄຟລ໌ນີ້ອອກກ່ອນ run
-- ============================================================================

do $$
declare
  src1 uuid; src2 uuid; src5 uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid;
begin
  if exists (select 1 from public.sources) then
    raise notice 'ມີຂໍ້ມູນຢູ່ແລ້ວ — ຂ້າມການໃສ່ຂໍ້ມູນຕົວຢ່າງ';
    return;
  end if;

  insert into public.sources (code, name, contact, note) values
    ('C1',      'C1',      'ບ້ານນາໄຊ',              null),
    ('C2',      'C2',      'ກຸ່ມສານແມ່ຍິງ ບ້ານໂພນ',  null),
    ('C3',      'C3',      null,                    null),
    ('C4',      'C4',      null,                    null),
    ('C6-7-8',  'C6-7-8',  null,                    null),
    ('C10',     'C10',     null,                    null);

  select id into src1 from public.sources where code = 'C1';
  select id into src2 from public.sources where code = 'C2';
  select id into src5 from public.sources where code = 'C6-7-8';

  insert into public.products (name, category, source_id, unit) values
    ('ຕິບເຂົ້າ ໄມ້ໄຜ່ ຂະໜາດນ້ອຍ', 'ຕິບເຂົ້າ', src1, 'ອັນ'),
    ('ຕິບເຂົ້າ ໄມ້ໄຜ່ ຂະໜາດກາງ', 'ຕິບເຂົ້າ', src1, 'ອັນ'),
    ('ຕິບເຂົ້າ ຫວາຍ ຂະໜາດໃຫຍ່',  'ຕິບເຂົ້າ', src2, 'ອັນ'),
    ('ຕິບເຂົ້າ ໄມ້ໄຜ່ ລາຍພິເສດ',  'ຕິບເຂົ້າ', src5, 'ອັນ');

  select id into p1 from public.products where name = 'ຕິບເຂົ້າ ໄມ້ໄຜ່ ຂະໜາດນ້ອຍ';
  select id into p2 from public.products where name = 'ຕິບເຂົ້າ ໄມ້ໄຜ່ ຂະໜາດກາງ';
  select id into p3 from public.products where name = 'ຕິບເຂົ້າ ຫວາຍ ຂະໜາດໃຫຍ່';
  select id into p4 from public.products where name = 'ຕິບເຂົ້າ ໄມ້ໄຜ່ ລາຍພິເສດ';

  insert into public.incomings (date, product_id, source_id, qty, unit, cost, note) values
    ('2026-07-05', p1, src1, 30, 'ອັນ', 25000, null),
    ('2026-07-05', p2, src1, 20, 'ອັນ', 35000, null),
    ('2026-07-12', p3, src2, 15, 'ອັນ', 55000, null),
    ('2026-07-20', p4, src5, 10, 'ອັນ', 60000, 'ລາຍພິເສດສັ່ງເຮັດ'),
    ('2026-08-01', p1, src1, 20, 'ອັນ', 25000, null);

  insert into public.sales (date, product_id, customer, qty, price, note) values
    ('2026-07-10', p1, 'ຮ້ານ ໄມ້ຫອມ',      12,  45000, null),
    ('2026-07-15', p2, 'ຮ້ານ ໄມ້ຫອມ',       8,  60000, null),
    ('2026-07-22', p3, 'ລູກຄ້າຍ່ອຍ',        5,  90000, null),
    ('2026-08-02', p4, 'ຕົວແທນຈຳໜ່າຍ',      4, 100000, null),
    ('2026-08-05', p1, 'ຮ້ານ ໄມ້ຫອມ',      10,  45000, null);

  raise notice 'ໃສ່ຂໍ້ມູນຕົວຢ່າງສຳເລັດ';
end;
$$;

# ລະບົບບັນທຶກສິນຄ້າຫັດຖະກຳ

ເວັບແອັບບັນທຶກ **ການນຳເຂົ້າ / ການຂາຍ / ສະຕັອກ / ກຳໄລ** ຂອງສິນຄ້າຫັດຖະກຳ
ເກັບຂໍ້ມູນຢູ່ **Supabase** (PostgreSQL) — ຂໍ້ມູນບໍ່ຫາຍເມື່ອປິດ browser ແລະ ໃຊ້ຮ່ວມກັນຫຼາຍຄົນໄດ້

---

## ໂຄງສ້າງໄຟລ໌

```
index.html                       ໜ້າເວັບຫຼັກ
assets/
  ├─ app.js                      ໂຄ້ດການເຮັດວຽກທັງໝົດ
  ├─ styles.css                  ຮູບແບບ / ສີ
  └─ config.js                   ໃສ່ Supabase URL + anon key ບ່ອນນີ້
supabase/migrations/
  ├─ 0001_init.sql               ຕາຕະລາງ, views, ສິດ (RLS), ຟັງຊັນ
  └─ 0002_seed.sql               ຂໍ້ມູນຕົວຢ່າງ (ບໍ່ຢາກໄດ້ → ລຶບໄຟລ໌ນີ້)
.github/workflows/
  ├─ db-migrate.yml              run ຕາຕະລາງອັດຕະໂນມັດເມື່ອ push
  └─ deploy-pages.yml            ເອົາເວັບຂຶ້ນ GitHub Pages ອັດຕະໂນມັດ
```

---

## ສະຖານະປັດຈຸບັນ

| | |
|---|---|
| ໂປຣເຈັກ | `vlazkjklsqhcwsmggrqq` · PostgreSQL 17.6 · ap-southeast-1 |
| Project URL | `https://vlazkjklsqhcwsmggrqq.supabase.co` (ໃສ່ໃນ config.js ແລ້ວ) |
| ຕາຕະລາງ + views | ✅ ສ້າງຄົບແລ້ວ (11/08/2026) |
| ຂໍ້ມູນຕົວຢ່າງ | ✅ ໃສ່ແລ້ວ — 6 ແຫຼ່ງ, 4 ສິນຄ້າ, 5 ນຳເຂົ້າ, 5 ຂາຍ |
| RLS | ✅ ເປີດ + ທົດສອບແລ້ວ |
| **ຍັງເຫຼືອ** | ⬜ ໃສ່ anon key · ⬜ ຕັ້ງ GitHub OAuth |

---

## ຂັ້ນຕອນທີ 1 — ສ້າງຕາຕະລາງໃນຖານຂໍ້ມູນ ✅ (ເຮັດແລ້ວ)

> ພາກນີ້ເຮັດສຳເລັດແລ້ວ. ເກັບໄວ້ເປັນເອກະສານອ້າງອີງ ຫຼື ໃຊ້ຕອນຍ້າຍໄປໂປຣເຈັກໃໝ່.

### ວິທີ ຄ. ຈາກເຄື່ອງນີ້ (ບໍ່ຕ້ອງມີ psql)

```bash
python3 -m pip install pg8000
export DATABASE_URL='postgresql://postgres.<ref>:<ລະຫັດ>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
python3 supabase/run_migrations.py
```

ໃຊ້ `--dry-run` ເພື່ອເບິ່ງຄຳສັ່ງກ່ອນ ໂດຍບໍ່ຕໍ່ຖານຂໍ້ມູນ.
ໝາຍເຫດ: direct connection (`db.<ref>.supabase.co`) ເປັນ **IPv6-only** ໃຊ້ຈາກເຄື່ອງນີ້ບໍ່ໄດ້ — ຕ້ອງໃຊ້ pooler ຕາມຂ້າງເທິງ.

### ວິທີ ກ. ເຮັດດ້ວຍມື

1. ເປີດ Supabase → ໂປຣເຈັກ **handicraft** → **SQL Editor** → **New query**
2. ກ໊ອບປີ້ເນື້ອໃນ `supabase/migrations/0001_init.sql` ທັງໝົດ → ວາງ → ກົດ **Run**
3. ເຮັດແບບດຽວກັນກັບ `0002_seed.sql` (ຖ້າຢາກໄດ້ຂໍ້ມູນຕົວຢ່າງ)

### ວິທີ ຂ. ອັດຕະໂນມັດຜ່ານ GitHub

ຫຼັງຈາກ push ໂຄ້ດຂຶ້ນ GitHub ແລ້ວ:

1. Supabase → **Project Settings → Database → Connection string → URI**
   ກ໊ອບປີ້ມາ ແລ້ວປ່ຽນ `[YOUR-PASSWORD]` ເປັນລະຫັດຖານຂໍ້ມູນຂອງທ່ານ
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `SUPABASE_DB_URL`
   - Value: connection string ຈາກຂໍ້ 1
3. ແທັບ **Actions → Run Supabase migrations → Run workflow**

ຈາກນັ້ນທຸກຄັ້ງທີ່ push ໄຟລ໌ໃໝ່ໃນ `supabase/migrations/` ຕາຕະລາງຈະຖືກ
ສ້າງ/ອັບເດດໃຫ້ເອງ. ໄຟລ໌ SQL run ຊ້ຳໄດ້ໂດຍບໍ່ພັງຂໍ້ມູນເກົ່າ.

---

## ຂັ້ນຕອນທີ 2 — ເປີດການເຂົ້າສູ່ລະບົບດ້ວຍ GitHub

1. **ສ້າງ GitHub OAuth App**
   GitHub → Settings → Developer settings → **OAuth Apps → New OAuth App**
   - Application name: `Handicraft Store`
   - Homepage URL: URL ຂອງເວັບທ່ານ (ເຊັ່ນ `https://<username>.github.io/<repo>/`)
   - Authorization callback URL:
     `https://vlazkjklsqhcwsmggrqq.supabase.co/auth/v1/callback`
   - ກົດ **Register** → **Generate a new client secret** → ກ໊ອບປີ້ Client ID + Secret

2. **ໃສ່ໃນ Supabase**
   Supabase → **Authentication → Providers → GitHub** → ເປີດໃຊ້ →
   ວາງ Client ID ແລະ Client Secret → **Save**

3. **ຕັ້ງ URL ທີ່ອະນຸຍາດ**
   Supabase → **Authentication → URL Configuration**
   - Site URL: URL ຂອງເວັບທ່ານ
   - Redirect URLs: ເພີ່ມ URL ຂອງເວັບ + `http://localhost:8765/` (ສຳລັບທົດສອບ)

> ບັນຊີ GitHub ທີ່ໃຊ້ອີເມວ **sengdeuan.boutdavong@gmail.com** ຈະໄດ້ສິດ
> **admin** ອັດຕະໂນມັດເມື່ອເຂົ້າສູ່ລະບົບຄັ້ງທຳອິດ (ຕັ້ງໄວ້ໃນຕາຕະລາງ `admin_allowlist`).
> ຖ້າ GitHub ຂອງທ່ານບໍ່ໄດ້ໃຊ້ອີເມວນີ້ ຫຼື ຕັ້ງເປັນ private → ໃຫ້ໃຊ້ວິທີ
> **ສົ່ງລິ້ງໄປອີເມວ** ໃນໜ້າ login ແທນ (ໃຊ້ອີເມວດຽວກັນ ກໍ່ໄດ້ສິດ admin ຄືກັນ).

---

## ຂັ້ນຕອນທີ 3 — ຕັ້ງຄ່າ ແລະ ເປີດເວັບ

Project URL ໃສ່ໃນ `assets/config.js` ໃຫ້ແລ້ວ. ຍັງເຫຼືອແຕ່ **anon key**:

Supabase → **Project Settings → API Keys** → ກ໊ອບປີ້ **anon / public** →
ວາງໃສ່ `SUPABASE_ANON_KEY` ໃນ [assets/config.js](assets/config.js)

ຫຼື ບໍ່ຕ້ອງແກ້ໄຟລ໌ກໍ່ໄດ້ — ເປີດເວັບ ແລ້ວວາງໃສ່ໃນໜ້າຕັ້ງຄ່າທີ່ຂຶ້ນມາເອງ
(Project URL ຈະຖືກຕື່ມໃຫ້ລ່ວງໜ້າແລ້ວ).

> anon key ເປັນ key ສາທາລະນະ — ອອກແບບມາໃຫ້ຢູ່ໃນໂຄ້ດເວັບ ແລະ ຄົນເຫັນໄດ້.
> ຄວາມປອດໄພມາຈາກ RLS ໃນຖານຂໍ້ມູນ ບໍ່ແມ່ນຈາກການປິດບັງ key ນີ້.

### ເປີດເວັບ

ຕ້ອງເປີດຜ່ານ web server — **ເປີດໄຟລ໌ໂດຍກົງ (`file://`) ໃຊ້ບໍ່ໄດ້** ເພາະ OAuth ບໍ່ຮອງຮັບ.

ທົດສອບໃນເຄື່ອງ:

```bash
cd "/Users/sabaiydev/Desktop/໊handicraft store" && python3 -m http.server 8765
```

ແລ້ວເປີດ http://localhost:8765

---

## ຂັ້ນຕອນທີ 4 — ເອົາຂຶ້ນອອນລາຍ (ບໍ່ບັງຄັບ)

1. GitHub repo → **Settings → Pages → Source: GitHub Actions**
2. (ບໍ່ບັງຄັບ) ເພີ່ມ secrets `SUPABASE_URL` ແລະ `SUPABASE_ANON_KEY`
   → workflow ຈະສ້າງ `config.js` ໃຫ້ອັດຕະໂນມັດຕອນ deploy
3. push ຂຶ້ນ `main` → ເວັບຈະຂຶ້ນທີ່ `https://<username>.github.io/<repo>/`

---

## ການເພີ່ມພະນັກງານ

ພະນັກງານມີ 3 ວິທີເຂົ້າລະບົບ — ໃຊ້ວິທີໃດກໍ່ໄດ້:

| ວິທີ | ເໝາະກັບ | ຕ້ອງໃຊ້ອີເມວບໍ |
|---|---|---|
| **ລະຫັດຜ່ານ** | ພະນັກງານທົ່ວໄປ | ບໍ່ (ຖ້າປິດການຢືນຢັນອີເມວ) |
| **GitHub** | ຄົນທີ່ມີບັນຊີ GitHub | ບໍ່ |
| **ລິ້ງທາງອີເມວ** | ສຳຮອງ / ລືມລະຫັດ | ຕ້ອງ |

### ຂັ້ນຕອນ

1. ພະນັກງານເປີດເວັບ → ໃສ່ອີເມວ + ລະຫັດຜ່ານ → ກົດ **ສະໝັກບັນຊີໃໝ່**
2. ຈະເຫັນໜ້າ **"ລໍຖ້າການອະນຸມັດ"** — ຍັງເຂົ້າເບິ່ງຂໍ້ມູນບໍ່ໄດ້
3. admin ເປີດແທັບ **ຜູ້ໃຊ້** → ເຫັນລາຍຊື່ຄົນລໍຢູ່ → ກົດ **ອະນຸມັດ**
4. ພະນັກງານກົດ **ກວດອີກເທື່ອ** → ເຂົ້າໃຊ້ໄດ້ທັນທີ

> **ເປັນຫຍັງຕ້ອງອະນຸມັດ:** ເວັບເປັນສາທາລະນະ ໃຜກໍ່ເປີດໄດ້. ຖ້າບໍ່ມີດ່ານນີ້
> ຄົນທີ່ຮູ້ລິ້ງຈະສະໝັກເອງແລ້ວເຫັນຂໍ້ມູນການຂາຍທັງໝົດ.
> ຜູ້ໃຊ້ທີ່ຍັງບໍ່ອະນຸມັດຈະດຶງຂໍ້ມູນອອກມາບໍ່ໄດ້ເລີຍ (ບັງຄັບດ້ວຍ RLS ບໍ່ແມ່ນແຕ່ເຊື່ອງໃນໜ້າຈໍ)

### ⚙️ ຕ້ອງປິດການຢືນຢັນອີເມວ ຈຶ່ງຈະສະໝັກດ້ວຍລະຫັດຜ່ານໄດ້ສະດວກ

Supabase → **Authentication → Sign In / Providers → Email** → ປິດ **Confirm email** → Save

ຖ້າບໍ່ປິດ ພະນັກງານຕ້ອງລໍອີເມວຢືນຢັນ ຊຶ່ງບໍລິການອີເມວແຖມຂອງ Supabase
ຈຳກັດພຽງ 2-4 ສະບັບຕໍ່ຊົ່ວໂມງ. ການປິດປອດໄພ ເພາະມີດ່ານອະນຸມັດຂອງ admin ກັນຢູ່ແລ້ວ.

---

## ໂຄງສ້າງຖານຂໍ້ມູນ

| ຕາຕະລາງ | ໜ້າທີ່ |
|---|---|
| `sources` | ແຫຼ່ງສິນຄ້າ / ຜູ້ຜະລິດ (ລະຫັດ, ຊື່, ຕິດຕໍ່) |
| `products` | ລາຍການສິນຄ້າ (ຊື່, ປະເພດ, ແຫຼ່ງ, ໜ່ວຍ, ຈຳນວນຕ່ຳສຸດ) |
| `incomings` | ການນຳເຂົ້າ (ວັນທີ, ສິນຄ້າ, ຈຳນວນ, ຕົ້ນທຶນ/ໜ່ວຍ) |
| `sales` | ການຂາຍ (ວັນທີ, ສິນຄ້າ, ລູກຄ້າ, ຈຳນວນ, ລາຄາ/ໜ່ວຍ) |
| `app_users` | ຜູ້ໃຊ້ + ສິດ (admin / staff) |
| `admin_allowlist` | ອີເມວທີ່ໄດ້ສິດ admin ອັດຕະໂນມັດ |

**Views** (ຄິດໄລ່ໃຫ້ອັດຕະໂນມັດ ບໍ່ຕ້ອງເກັບຊ້ຳ):

| View | ໃຫ້ຫຍັງ |
|---|---|
| `product_stock` | ສະຕັອກຄົງເຫຼືອ, ຕົ້ນທຶນສະເລ່ຍ, ທຸງເຕືອນສິນຄ້າໃກ້ໝົດ |
| `sales_detail` | ການຂາຍ + ຍອດລວມ + **ກຳໄລ** (ໃຊ້ຕົ້ນທຶນສະເລ່ຍ) |
| `incomings_detail` | ການນຳເຂົ້າ + ຊື່ສິນຄ້າ/ແຫຼ່ງ + ຕົ້ນທຶນລວມ |
| `sales_by_month` / `sales_by_source` | ຍອດຂາຍຕາມເດືອນ / ຕາມແຫຼ່ງ |
| `dashboard_summary` | ຕົວເລກສະຫຼຸບໜ້າພາບລວມ |

### ສິດການໃຊ້ງານ (ບັງຄັບຢູ່ຊັ້ນຖານຂໍ້ມູນ ດ້ວຍ Row Level Security)

| | admin | staff |
|---|---|---|
| ເບິ່ງຂໍ້ມູນທັງໝົດ | ✅ | ✅ |
| ບັນທຶກນຳເຂົ້າ / ຂາຍ | ✅ | ✅ |
| ແກ້ / ລຶບ ລາຍການ | ທຸກລາຍການ | ສະເພາະທີ່ຕົນບັນທຶກ |
| ເພີ່ມ/ແກ້ ສິນຄ້າ ແລະ ແຫຼ່ງສິນຄ້າ | ✅ | ❌ |
| ຈັດການຜູ້ໃຊ້ ແລະ ສິດ | ✅ | ❌ |

ກົດເຫຼົ່ານີ້ບັງຄັບຢູ່ Postgres ໂດຍກົງ — ຕໍ່ໃຫ້ມີຄົນແກ້ JavaScript ໃນ browser
ກໍ່ຂ້າມບໍ່ໄດ້.

---

## ຂໍ້ຄວນລະວັງເລື່ອງຄວາມປອດໄພ

- ໃສ່ໄດ້ສະເພາະ **anon key** ໃນ `config.js` — key ນີ້ຖືກອອກແບບໃຫ້ເປີດເຜີຍໄດ້
- **ຫ້າມ** ໃສ່ `service_role` key ຫຼື ລະຫັດຖານຂໍ້ມູນ ໃນໄຟລ໌ໃດໆຂອງເວັບ
- ລະຫັດຖານຂໍ້ມູນໃຫ້ເກັບໄວ້ໃນ **GitHub Secrets** ເທົ່ານັ້ນ
- ຖ້າລະຫັດຖານຂໍ້ມູນເຄີຍຖືກສົ່ງຜ່ານ chat / ອີເມວ ໃຫ້ຕັ້ງໃໝ່ທີ່
  Supabase → Settings → Database → **Reset database password**

/* ============================================================================
 * ລະບົບບັນທຶກສິນຄ້າຫັດຖະກຳ — ຕໍ່ກັບ Supabase
 * ໂຄງສ້າງ: ຕັ້ງຄ່າ → ເຂົ້າສູ່ລະບົບ → ໂຫຼດຂໍ້ມູນ → ສະແດງ/ບັນທຶກ
 * ========================================================================= */
'use strict';

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ── ຕົວຊ່ວຍທົ່ວໄປ ────────────────────────────────────────────────────── */

const CFG_KEY = 'handicraft.supabase.config';

const fmt      = n => Math.round(Number(n) || 0).toLocaleString('en-US');
const today    = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD ຕາມເວລາທ້ອງຖິ່ນ
const esc      = s => String(s ?? '').replace(/[&<>"']/g, c =>
                   ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nullable = v => { const s = String(v ?? '').trim(); return s === '' ? null : s; };
const numOr    = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

function show(id) {
  ['screen-loading', 'screen-setup', 'screen-login', 'screen-denied', 'screen-app']
    .forEach(s => { $('#' + s).hidden = (s !== id); });
}

let toastTimer;
function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('err', isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function alertBox(id, msg, kind = 'err') {
  const el = $('#' + id);
  if (!el) return;
  el.className = 'alert ' + kind;
  el.textContent = msg || '';
}

/** ແປຂໍ້ຄວາມ error ຂອງ Postgres/Supabase ໃຫ້ຄົນອ່ານເຂົ້າໃຈ */
function friendlyError(err) {
  const msg  = err?.message || String(err);
  const code = err?.code;
  if (code === '42P01' || /relation .* does not exist/i.test(msg))
    return 'ຍັງບໍ່ພົບຕາຕະລາງໃນຖານຂໍ້ມູນ — ກະລຸນາ run ໄຟລ໌ supabase/migrations/*.sql ກ່ອນ';
  if (code === '42501' || /row-level security/i.test(msg))
    return 'ບໍ່ມີສິດເຮັດລາຍການນີ້ (ຕ້ອງເປັນ admin)';
  if (code === '23503') return 'ລຶບບໍ່ໄດ້ — ຍັງມີຂໍ້ມູນອື່ນອ້າງອີງຢູ່';
  if (code === '23514') return 'ຂໍ້ມູນບໍ່ຖືກຕ້ອງ — ກວດຈຳນວນ ແລະ ລາຄາ';
  if (code === 'PGRST301' || /JWT/i.test(msg)) return 'ເຊດຊັນໝົດອາຍຸ — ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່';
  if (/Failed to fetch|NetworkError/i.test(msg))
    return 'ຕໍ່ Supabase ບໍ່ໄດ້ — ກວດອິນເຕີເນັດ ຫຼື Project URL';
  return msg;
}

/* ── ສະຖານະແອັບ ──────────────────────────────────────────────────────── */

let sb = null;                      // Supabase client
let me = null;                      // ແຖວຈາກ app_users
const db = {                        // ຂໍ້ມູນທີ່ໂຫຼດມາ
  sources: [], products: [], stock: [],
  incomings: [], sales: [], users: [], allowlist: []
};
let activeTab = 'dashboard';
const isAdmin = () => me?.role === 'admin';

const TABS = [
  { id: 'dashboard', label: 'ພາບລວມ',       adminOnly: false },
  { id: 'in',        label: 'ນຳເຂົ້າ',       adminOnly: false },
  { id: 'sale',      label: 'ຂາຍ',          adminOnly: false },
  { id: 'products',  label: 'ສິນຄ້າ',        adminOnly: true  },
  { id: 'sources',   label: 'ແຫຼ່ງສິນຄ້າ',   adminOnly: true  },
  { id: 'users',     label: 'ຜູ້ໃຊ້',        adminOnly: true  }
];

/* ============================================================================
 * 1. ຕັ້ງຄ່າ ແລະ ເຊື່ອມຕໍ່
 * ========================================================================= */

function readConfig() {
  const file = window.HANDICRAFT_CONFIG || {};
  if (file.SUPABASE_URL && file.SUPABASE_ANON_KEY) {
    return { url: file.SUPABASE_URL.trim(), key: file.SUPABASE_ANON_KEY.trim() };
  }
  try {
    const saved = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (saved?.url && saved?.key) return saved;
  } catch { /* ຄ່າເສຍຫາຍ — ຖືວ່າບໍ່ມີ */ }
  return null;
}

function setupScreen() {
  show('screen-setup');
  // ຕື່ມຄ່າທີ່ມີຢູ່ແລ້ວໃຫ້ກ່ອນ — ຈາກ config.js ຫຼື ຈາກທີ່ເຄີຍພິມໄວ້
  const saved = (() => { try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch { return null; } })();
  const file  = window.HANDICRAFT_CONFIG || {};
  $('#cfg-url').value = saved?.url || file.SUPABASE_URL     || '';
  $('#cfg-key').value = saved?.key || file.SUPABASE_ANON_KEY || '';

  $('#cfg-save').onclick = () => {
    const url = $('#cfg-url').value.trim().replace(/\/+$/, '');
    const key = $('#cfg-key').value.trim();
    if (!/^https:\/\/.+/.test(url)) return alertBox('setup-alert', 'Project URL ຕ້ອງຂຶ້ນຕົ້ນດ້ວຍ https://');
    if (!key)                        return alertBox('setup-alert', 'ກະລຸນາໃສ່ anon key');
    if (/^eyJ/.test(key)) {
      try {
        const role = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role;
        if (role === 'service_role')
          return alertBox('setup-alert', 'ນີ້ແມ່ນ service_role key — ຫ້າມໃຊ້ໃນເວັບ. ໃຊ້ anon key ແທນ');
      } catch { /* ຖອດລະຫັດບໍ່ໄດ້ — ປ່ອຍຜ່ານ */ }
    }
    localStorage.setItem(CFG_KEY, JSON.stringify({ url, key }));
    location.reload();
  };
}

/* ============================================================================
 * 2. Auth
 * ========================================================================= */

function loginScreen() {
  show('screen-login');
  alertBox('login-alert', '');
  alertBox('login-ok', '', 'ok');

  const redirectTo = location.origin + location.pathname;

  $('#btn-github').onclick = async () => {
    alertBox('login-alert', '');
    const { error } = await sb.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } });
    if (error) alertBox('login-alert', 'GitHub login ບໍ່ສຳເລັດ: ' + error.message
      + ' — ກວດວ່າເປີດ GitHub provider ໃນ Supabase → Authentication → Providers ແລ້ວບໍ');
  };

  const creds = () => ({
    email: $('#login-email').value.trim(),
    password: $('#login-password').value
  });

  /** ແປ error ຂອງລະບົບ auth ໃຫ້ເປັນພາສາລາວ */
  function authError(err) {
    const m = err?.message || '';
    if (/Invalid login credentials/i.test(m))
      return 'ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ';
    if (/Email not confirmed/i.test(m))
      return 'ຍັງບໍ່ໄດ້ຢືນຢັນອີເມວ — ກວດກ່ອງອີເມວຂອງທ່ານ ຫຼື ແຈ້ງຜູ້ດູແລໃຫ້ປິດການຢືນຢັນອີເມວ';
    if (/User already registered|already been registered/i.test(m))
      return 'ອີເມວນີ້ສະໝັກແລ້ວ — ໃຫ້ກົດ “ເຂົ້າສູ່ລະບົບ” ແທນ';
    if (/Password should be at least/i.test(m))
      return 'ລະຫັດຜ່ານສັ້ນເກີນໄປ — ຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ';
    if (/rate limit|too many requests/i.test(m))
      return 'ລອງຫຼາຍເທື່ອເກີນໄປ — ລໍສັກຄູ່ແລ້ວລອງໃໝ່';
    if (/Signups not allowed|signup is disabled/i.test(m))
      return 'ລະບົບປິດການສະໝັກໃໝ່ຢູ່ — ແຈ້ງຜູ້ດູແລລະບົບ';
    return m || 'ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ';
  }

  async function withButton(btn, label, fn) {
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = label;
    try { await fn(); } finally { btn.disabled = false; btn.textContent = old; }
  }

  // ── ເຂົ້າສູ່ລະບົບດ້ວຍລະຫັດຜ່ານ ──────────────────────────────────────
  $('#form-password').onsubmit = async (e) => {
    e.preventDefault();
    alertBox('login-alert', ''); alertBox('login-ok', '', 'ok');
    const btn = e.target.querySelector('button[type=submit]');
    await withButton(btn, 'ກຳລັງເຂົ້າ…', async () => {
      const { error } = await sb.auth.signInWithPassword(creds());
      if (error) alertBox('login-alert', authError(error));
    });
  };

  // ── ສະໝັກບັນຊີໃໝ່ ───────────────────────────────────────────────────
  $('#btn-signup').onclick = async () => {
    alertBox('login-alert', ''); alertBox('login-ok', '', 'ok');
    const { email, password } = creds();
    if (!email)               return alertBox('login-alert', 'ກະລຸນາໃສ່ອີເມວ');
    if (!password || password.length < 6)
      return alertBox('login-alert', 'ຕັ້ງລະຫັດຜ່ານຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ');

    await withButton($('#btn-signup'), 'ກຳລັງສະໝັກ…', async () => {
      const { data, error } = await sb.auth.signUp({
        email, password, options: { emailRedirectTo: redirectTo }
      });
      if (error) return alertBox('login-alert', authError(error));
      // ຖ້າເປີດການຢືນຢັນອີເມວໄວ້ ຈະຍັງບໍ່ມີ session
      if (!data.session) {
        alertBox('login-ok', 'ສະໝັກແລ້ວ — ກວດອີເມວເພື່ອຢືນຢັນບັນຊີ ແລ້ວຈຶ່ງເຂົ້າສູ່ລະບົບ', 'ok');
      }
      // ມີ session → onAuthStateChange ຈະພາໄປໜ້າ “ລໍຖ້າອະນຸມັດ” ເອງ
    });
  };

  // ── ລິ້ງທາງອີເມວ (ສຳຮອງ / ລືມລະຫັດ) ─────────────────────────────────
  $('#btn-magic').onclick = async () => {
    const email = $('#login-email').value.trim();
    if (!email) return alertBox('login-alert', 'ກະລຸນາໃສ່ອີເມວກ່ອນ');
    alertBox('login-alert', '');
    await withButton($('#btn-magic'), 'ກຳລັງສົ່ງ…', async () => {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (error) alertBox('login-alert', authError(error));
      else alertBox('login-ok', 'ສົ່ງລິ້ງໄປທີ່ ' + email + ' ແລ້ວ — ກວດອີເມວຂອງທ່ານ', 'ok');
    });
  };
}

async function signOut() {
  await sb.auth.signOut();
  location.reload();
}

/* ============================================================================
 * 3. ໂຫຼດຂໍ້ມູນ
 * ========================================================================= */

async function loadAll() {
  const q = [
    sb.from('sources').select('*').order('code', { nullsFirst: false }).order('name'),
    sb.from('products').select('*').order('name'),
    sb.from('product_stock').select('*').order('name'),
    sb.from('incomings_detail').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
    sb.from('sales_detail').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
  ];
  if (isAdmin()) {
    q.push(sb.from('app_users').select('*').order('created_at'));
    q.push(sb.from('admin_allowlist').select('*').order('email'));
  }

  const res = await Promise.all(q);
  const bad = res.find(r => r.error);
  if (bad) throw bad.error;

  db.sources   = res[0].data || [];
  db.products  = res[1].data || [];
  db.stock     = res[2].data || [];
  db.incomings = res[3].data || [];
  db.sales     = res[4].data || [];
  db.users     = isAdmin() ? (res[5].data || []) : [];
  db.allowlist = isAdmin() ? (res[6].data || []) : [];
}

async function refresh(silent = false) {
  try {
    await loadAll();
    alertBox('app-alert', '');   // ລ້າງກ່ອນ render — renderSelects ອາດຕັ້ງຄຳເຕືອນໃໝ່
    renderAll();
    if (!silent) toast('ໂຫຼດຂໍ້ມູນໃໝ່ແລ້ວ');
  } catch (err) {
    alertBox('app-alert', friendlyError(err));
  }
}

/* ============================================================================
 * 4. ການສະແດງຜົນ
 * ========================================================================= */

function renderAll() {
  renderTabs();
  renderSelects();
  renderDashboard();
  renderIncomings();
  renderSales();
  renderProducts();
  renderSources();
  renderUsers();
}

/* ── ແທັບ ─────────────────────────────────────────────────────────────── */

function renderTabs() {
  const visible = TABS.filter(t => !t.adminOnly || isAdmin());
  if (!visible.some(t => t.id === activeTab)) activeTab = 'dashboard';

  $('#tabs').innerHTML = visible
    .map(t => `<button class="tab${t.id === activeTab ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`)
    .join('');
  $$('#tabs .tab').forEach(b => b.onclick = () => { activeTab = b.dataset.tab; renderTabs(); });
  $$('.panel').forEach(p => p.classList.toggle('active', p.dataset.panel === activeTab));
}

/* ── dropdown ────────────────────────────────────────────────────────── */

function fillSelect(el, rows, { valueKey = 'id', labelKey = 'name', blank = null } = {}) {
  if (!el) return;
  const prev = el.value;
  const opts = rows.map(r => `<option value="${esc(r[valueKey])}">${esc(r[labelKey])}</option>`);
  if (blank !== null) opts.unshift(`<option value="">${esc(blank)}</option>`);
  el.innerHTML = opts.join('');
  if (prev && rows.some(r => String(r[valueKey]) === prev)) el.value = prev;
}

function renderSelects() {
  const srcLabel = db.sources.map(s => ({ id: s.id, name: s.code ? `${s.code} — ${s.name}` : s.name }));
  fillSelect($('#form-in    [name=product_id]'), db.products);
  fillSelect($('#form-in    [name=source_id]'),  srcLabel, { blank: '— ບໍ່ລະບຸ —' });
  fillSelect($('#form-sale  [name=product_id]'), db.products);
  fillSelect($('#form-product [name=source_id]'), srcLabel, { blank: '— ບໍ່ລະບຸ —' });

  const noProducts = db.products.length === 0;
  $$('#form-in button, #form-sale button').forEach(b => { if (b.type === 'submit') b.disabled = noProducts; });
  if (noProducts) alertBox('app-alert', 'ຍັງບໍ່ມີສິນຄ້າໃນລະບົບ — ໃຫ້ admin ເພີ່ມສິນຄ້າກ່ອນຈຶ່ງບັນທຶກລາຍການໄດ້', 'info');
}

/* ── ພາບລວມ ──────────────────────────────────────────────────────────── */

function barChart(rows, labelKey, valueKey) {
  if (!rows.length) return '<p class="empty">ຍັງບໍ່ມີຂໍ້ມູນ</p>';
  const max = Math.max(1, ...rows.map(r => Number(r[valueKey]) || 0));
  return rows.map(r => {
    const v = Number(r[valueKey]) || 0;
    return `<div class="bar-row">
      <div class="bar-head"><span>${esc(r[labelKey])}</span><span class="r">${fmt(v)} ກີບ</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v / max * 100)}%"></div></div>
    </div>`;
  }).join('');
}

function renderDashboard() {
  const revenue = db.sales.reduce((a, r) => a + numOr(r.subtotal), 0);
  const profit  = db.sales.reduce((a, r) => a + numOr(r.profit), 0);
  const stock   = db.stock.reduce((a, r) => a + numOr(r.stock), 0);

  $('#kpi-revenue').textContent = fmt(revenue);
  $('#kpi-profit').textContent  = fmt(profit);
  $('#kpi-stock').textContent   = fmt(stock);

  // ສິນຄ້າຂາຍດີ
  const byProduct = new Map();
  db.sales.forEach(r => byProduct.set(r.product_name, (byProduct.get(r.product_name) || 0) + numOr(r.qty)));
  const top = [...byProduct.entries()].sort((a, b) => b[1] - a[1])[0];
  $('#kpi-top').textContent     = top ? top[0] : '-';
  $('#kpi-top-qty').textContent = top ? `ຂາຍໄປ ${fmt(top[1])} ໜ່ວຍ` : '';

  // ຍອດຂາຍຕາມແຫຼ່ງ
  const bySource = new Map();
  db.sales.forEach(r => {
    const k = r.source_name || '-';
    bySource.set(k, (bySource.get(k) || 0) + numOr(r.subtotal));
  });
  $('#chart-source').innerHTML = barChart(
    [...bySource.entries()].map(([name, rev]) => ({ name, rev })).sort((a, b) => b.rev - a.rev),
    'name', 'rev');

  // ຍອດຂາຍຕາມເດືອນ
  const byMonth = new Map();
  db.sales.forEach(r => {
    const k = String(r.date).slice(0, 7);
    byMonth.set(k, (byMonth.get(k) || 0) + numOr(r.subtotal));
  });
  $('#chart-month').innerHTML = barChart(
    [...byMonth.entries()].map(([label, rev]) => ({ label, rev })).sort((a, b) => a.label < b.label ? -1 : 1),
    'label', 'rev');

  // ສະຫຼຸບຕາມປະເພດ
  const soldByProduct = new Map();
  db.sales.forEach(r => soldByProduct.set(r.product_id, (soldByProduct.get(r.product_id) || 0) + numOr(r.qty)));
  const byCat = new Map();
  db.stock.forEach(p => {
    const c = byCat.get(p.category) || { category: p.category, sold: 0, stock: 0 };
    c.sold  += soldByProduct.get(p.product_id) || 0;
    c.stock += numOr(p.stock);
    byCat.set(p.category, c);
  });
  $('#tbl-category').innerHTML = [...byCat.values()].length
    ? [...byCat.values()].map(c => `<tr>
        <td>${esc(c.category)}</td>
        <td class="num">${fmt(c.sold)}</td>
        <td class="num">${fmt(c.stock)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="empty">ຍັງບໍ່ມີຂໍ້ມູນ</td></tr>';

  // ສິນຄ້າໃກ້ໝົດ
  const low = db.stock.filter(p => p.is_low).sort((a, b) => numOr(a.stock) - numOr(b.stock));
  $('#tbl-low').innerHTML = low.length
    ? low.map(p => `<tr class="low">
        <td>${esc(p.name)}</td>
        <td>${esc(p.source_name || '-')}</td>
        <td class="num">${fmt(p.stock)} ${esc(p.unit)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="empty">ສິນຄ້າທຸກລາຍການຢູ່ໃນລະດັບປົກກະຕິ ✓</td></tr>';
}

/* ── ນຳເຂົ້າ ──────────────────────────────────────────────────────────── */

/** staff ລຶບໄດ້ສະເພາະລາຍການທີ່ຕົນເອງບັນທຶກ (ຕົງກັບ RLS ໃນຖານຂໍ້ມູນ) */
const canEditRow = row => isAdmin() || (row.created_by && row.created_by === me?.id);

const delBtn = (row, attr) => canEditRow(row)
  ? `<button class="link-btn del" data-${attr}="${esc(row.id)}">ລຶບ</button>`
  : `<button class="link-btn del" disabled title="ລຶບໄດ້ສະເພາະລາຍການທີ່ທ່ານບັນທຶກເອງ">ລຶບ</button>`;

function renderIncomings() {
  $('#count-in').textContent = db.incomings.length ? `${db.incomings.length} ລາຍການ` : '';
  $('#tbl-in').innerHTML = db.incomings.length
    ? db.incomings.map(r => `<tr>
        <td>${esc(r.date)}</td>
        <td>${esc(r.product_name)}</td>
        <td>${esc(r.source_name || '-')}</td>
        <td class="num">${fmt(r.qty)} ${esc(r.unit)}</td>
        <td class="num">${fmt(r.cost)}</td>
        <td class="num">${fmt(r.total_cost)}</td>
        <td>${esc(r.note || '')}</td>
        <td class="num">${delBtn(r, 'del-in')}</td>
      </tr>`).join('')
    : '<tr><td colspan="8" class="empty">ຍັງບໍ່ມີການນຳເຂົ້າ</td></tr>';

  $$('[data-del-in]').forEach(b => b.onclick = () => removeRow('incomings', b.dataset.delIn, 'ລຶບລາຍການນຳເຂົ້ານີ້?'));
}

/* ── ຂາຍ ─────────────────────────────────────────────────────────────── */

function renderSales() {
  $('#count-sale').textContent = db.sales.length ? `${db.sales.length} ລາຍການ` : '';
  $('#tbl-sale').innerHTML = db.sales.length
    ? db.sales.map(r => `<tr>
        <td>${esc(r.date)}</td>
        <td>${esc(r.product_name)}</td>
        <td>${esc(r.source_name || '-')}</td>
        <td>${esc(r.customer || '-')}</td>
        <td class="num">${fmt(r.qty)}</td>
        <td class="num">${fmt(r.price)}</td>
        <td class="num">${fmt(r.subtotal)}</td>
        <td class="num" style="color:${numOr(r.profit) < 0 ? 'var(--red)' : 'var(--green)'}">${fmt(r.profit)}</td>
        <td class="num">${delBtn(r, 'del-sale')}</td>
      </tr>`).join('')
    : '<tr><td colspan="9" class="empty">ຍັງບໍ່ມີການຂາຍ</td></tr>';

  $$('[data-del-sale]').forEach(b => b.onclick = () => removeRow('sales', b.dataset.delSale, 'ລຶບລາຍການຂາຍນີ້?'));
}

/* ── ສິນຄ້າ ───────────────────────────────────────────────────────────── */

function renderProducts() {
  if (!isAdmin()) return;
  $('#count-product').textContent = db.products.length ? `${db.products.length} ລາຍການ` : '';
  const stockById = new Map(db.stock.map(s => [s.product_id, s]));

  $('#tbl-product').innerHTML = db.products.length
    ? db.products.map(p => {
        const s = stockById.get(p.id) || {};
        return `<tr class="${s.is_low ? 'low' : ''}">
          <td>${esc(p.name)}</td>
          <td>${esc(p.category)}</td>
          <td>${esc(s.source_name || '-')}</td>
          <td>${esc(p.unit)}</td>
          <td class="num">${fmt(s.stock)}</td>
          <td class="num">${fmt(s.avg_cost)}</td>
          <td class="num" style="white-space:nowrap">
            <button class="link-btn edit" data-edit-product="${esc(p.id)}">ແກ້ໄຂ</button>
            &nbsp;
            <button class="link-btn del" data-del-product="${esc(p.id)}">ລຶບ</button>
          </td></tr>`;
      }).join('')
    : '<tr><td colspan="7" class="empty">ຍັງບໍ່ມີສິນຄ້າ</td></tr>';

  $$('[data-edit-product]').forEach(b => b.onclick = () => editProduct(b.dataset.editProduct));
  $$('[data-del-product]').forEach(b => b.onclick = () =>
    removeRow('products', b.dataset.delProduct,
      'ລຶບສິນຄ້ານີ້? ປະຫວັດການນຳເຂົ້າ ແລະ ການຂາຍຂອງມັນຈະຖືກລຶບໄປນຳ'));
}

function editProduct(id) {
  const p = db.products.find(x => x.id === id);
  if (!p) return;
  const f = $('#form-product');
  f.id.value        = p.id;
  f.name.value      = p.name;
  f.category.value  = p.category;
  f.source_id.value = p.source_id || '';
  f.unit.value      = p.unit;
  f.min_stock.value = p.min_stock;
  $('#title-product').textContent    = 'ແກ້ໄຂສິນຄ້າ';
  $('#btn-product-save').textContent = 'ບັນທຶກການແກ້ໄຂ';
  $('#btn-product-cancel').hidden    = false;
  f.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetProductForm() {
  const f = $('#form-product');
  f.reset(); f.id.value = '';
  $('#title-product').textContent    = 'ເພີ່ມສິນຄ້າໃໝ່';
  $('#btn-product-save').textContent = 'ເພີ່ມສິນຄ້າ';
  $('#btn-product-cancel').hidden    = true;
}

/* ── ແຫຼ່ງສິນຄ້າ ──────────────────────────────────────────────────────── */

function renderSources() {
  if (!isAdmin()) return;
  $('#count-source').textContent = db.sources.length ? `${db.sources.length} ແຫຼ່ງ` : '';

  const agg = new Map();
  db.stock.forEach(s => {
    if (!s.source_id) return;
    const a = agg.get(s.source_id) || { n: 0, stock: 0 };
    a.n += 1; a.stock += numOr(s.stock);
    agg.set(s.source_id, a);
  });

  $('#tbl-source').innerHTML = db.sources.length
    ? db.sources.map(s => {
        const a = agg.get(s.id) || { n: 0, stock: 0 };
        return `<tr>
          <td>${esc(s.code || '-')}</td>
          <td>${esc(s.name)}</td>
          <td>${esc(s.contact || '-')}</td>
          <td>${esc(s.note || '')}</td>
          <td class="num">${fmt(a.n)}</td>
          <td class="num">${fmt(a.stock)}</td>
          <td class="num" style="white-space:nowrap">
            <button class="link-btn edit" data-edit-source="${esc(s.id)}">ແກ້ໄຂ</button>
            &nbsp;
            <button class="link-btn del" data-del-source="${esc(s.id)}">ລຶບ</button>
          </td></tr>`;
      }).join('')
    : '<tr><td colspan="7" class="empty">ຍັງບໍ່ມີແຫຼ່ງສິນຄ້າ</td></tr>';

  $$('[data-edit-source]').forEach(b => b.onclick = () => editSource(b.dataset.editSource));
  $$('[data-del-source]').forEach(b => b.onclick = () =>
    removeRow('sources', b.dataset.delSource, 'ລຶບແຫຼ່ງສິນຄ້ານີ້? ສິນຄ້າທີ່ຜູກຢູ່ຈະກາຍເປັນ “ບໍ່ລະບຸ”'));
}

function editSource(id) {
  const s = db.sources.find(x => x.id === id);
  if (!s) return;
  const f = $('#form-source');
  f.id.value      = s.id;
  f.code.value    = s.code || '';
  f.name.value    = s.name;
  f.contact.value = s.contact || '';
  f.note.value    = s.note || '';
  $('#title-source').textContent    = 'ແກ້ໄຂແຫຼ່ງສິນຄ້າ';
  $('#btn-source-save').textContent = 'ບັນທຶກການແກ້ໄຂ';
  $('#btn-source-cancel').hidden    = false;
  f.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetSourceForm() {
  const f = $('#form-source');
  f.reset(); f.id.value = '';
  $('#title-source').textContent    = 'ເພີ່ມແຫຼ່ງສິນຄ້າໃໝ່';
  $('#btn-source-save').textContent = 'ເພີ່ມແຫຼ່ງສິນຄ້າ';
  $('#btn-source-cancel').hidden    = true;
}

/* ── ຜູ້ໃຊ້ ────────────────────────────────────────────────────────────── */

function renderUsers() {
  if (!isAdmin()) return;

  const pending = db.users.filter(u => !u.active && !u.approved_at).length;
  $('#users-pending').textContent = pending
    ? `${pending} ຄົນລໍຖ້າການອະນຸມັດ` : '';
  $('#users-pending').className = pending ? 'alert info' : 'alert';

  // ຄົນທີ່ລໍອະນຸມັດຂຶ້ນກ່ອນ ຈະໄດ້ບໍ່ຕົກຫຼົ່ນ
  const rows = [...db.users].sort((a, b) =>
    (a.active === b.active) ? 0 : (a.active ? 1 : -1));

  $('#tbl-users').innerHTML = rows.length
    ? rows.map(u => {
        const self    = u.id === me.id;
        const waiting = !u.active && !u.approved_at;
        const status  = u.active
          ? 'ໃຊ້ງານໄດ້'
          : waiting
            ? '<span style="color:var(--brown);font-weight:600">ລໍອະນຸມັດ</span>'
            : '<span style="color:var(--red)">ປິດແລ້ວ</span>';
        return `<tr${waiting ? ' class="low"' : ''}>
          <td>${esc(u.email)}</td>
          <td>${esc(u.full_name || '-')}</td>
          <td><span class="badge ${u.role === 'admin' ? 'admin' : ''}">${esc(u.role)}</span></td>
          <td>${status}</td>
          <td>${esc(String(u.created_at).slice(0, 10))}</td>
          <td class="num" style="white-space:nowrap">
            <button class="link-btn edit" data-role-user="${esc(u.id)}" ${self ? 'disabled' : ''}>
              ${u.role === 'admin' ? 'ປ່ຽນເປັນ staff' : 'ປ່ຽນເປັນ admin'}</button>
            &nbsp;
            <button class="link-btn ${u.active ? 'del' : 'edit'}" data-active-user="${esc(u.id)}" ${self ? 'disabled' : ''}>
              ${u.active ? 'ປິດການໃຊ້ງານ' : (waiting ? 'ອະນຸມັດ' : 'ເປີດໃຊ້ງານ')}</button>
          </td></tr>`;
      }).join('')
    : '<tr><td colspan="6" class="empty">ຍັງບໍ່ມີຜູ້ໃຊ້</td></tr>';

  $$('[data-role-user]').forEach(b => b.onclick = async () => {
    const u = db.users.find(x => x.id === b.dataset.roleUser);
    await updateRow('app_users', u.id, { role: u.role === 'admin' ? 'staff' : 'admin' }, 'ປ່ຽນສິດແລ້ວ');
  });
  $$('[data-active-user]').forEach(b => b.onclick = async () => {
    const u = db.users.find(x => x.id === b.dataset.activeUser);
    if (u.active && !confirm(`ປິດການໃຊ້ງານ ${u.email}? ຈະເຂົ້າລະບົບບໍ່ໄດ້ອີກ`)) return;
    await updateRow('app_users', u.id, { active: !u.active },
      u.active ? 'ປິດການໃຊ້ງານແລ້ວ' : 'ອະນຸມັດແລ້ວ — ຜູ້ໃຊ້ເຂົ້າລະບົບໄດ້ເລີຍ');
  });

  $('#tbl-allow').innerHTML = db.allowlist.length
    ? db.allowlist.map(a => `<tr>
        <td>${esc(a.email)}</td>
        <td>${esc(a.note || '')}</td>
        <td class="num"><button class="link-btn del" data-del-allow="${esc(a.email)}">ລຶບ</button></td>
      </tr>`).join('')
    : '<tr><td colspan="3" class="empty">ຍັງບໍ່ມີລາຍຊື່</td></tr>';

  $$('[data-del-allow]').forEach(b => b.onclick = async () => {
    if (!confirm('ລຶບອີເມວນີ້ອອກຈາກລາຍຊື່ admin?')) return;
    const { error } = await sb.from('admin_allowlist').delete().eq('email', b.dataset.delAllow);
    if (error) return toast(friendlyError(error), true);
    toast('ລຶບແລ້ວ');
    refresh(true);
  });
}

/* ============================================================================
 * 5. ການບັນທຶກ / ລຶບ
 * ========================================================================= */

async function removeRow(table, id, question) {
  if (!confirm(question)) return;
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) return toast(friendlyError(error), true);
  toast('ລຶບແລ້ວ');
  refresh(true);
}

async function updateRow(table, id, patch, okMsg) {
  const { error } = await sb.from(table).update(patch).eq('id', id);
  if (error) return toast(friendlyError(error), true);
  toast(okMsg);
  refresh(true);
}

/** ຫຸ້ມການ submit: ກັນກົດຊ້ຳ + ຈັດການ error ໃຫ້ອັດຕະໂນມັດ */
function onSubmit(formSel, handler) {
  const form = $(formSel);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'ກຳລັງບັນທຶກ…';
    try {
      await handler(Object.fromEntries(new FormData(form)), form);
    } catch (err) {
      toast(friendlyError(err), true);
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  });
}

let formsWired = false;

function wireForms() {
  if (formsWired) return;   // ກັນຜູກ event ຊ້ຳເມື່ອ login ໃໝ່ໃນໜ້າດຽວກັນ
  formsWired = true;

  // ນຳເຂົ້າ
  onSubmit('#form-in', async (v, form) => {
    const { error } = await sb.from('incomings').insert({
      date: v.date || today(),
      product_id: v.product_id,
      source_id: nullable(v.source_id),
      qty: numOr(v.qty),
      unit: nullable(v.unit) || 'ອັນ',
      cost: numOr(v.cost),
      note: nullable(v.note),
      created_by: me.id
    });
    if (error) throw error;
    toast('ບັນທຶກການນຳເຂົ້າແລ້ວ');
    form.reset(); form.date.value = today();
    await refresh(true);
  });

  // ຂາຍ
  onSubmit('#form-sale', async (v, form) => {
    const { error } = await sb.from('sales').insert({
      date: v.date || today(),
      product_id: v.product_id,
      customer: nullable(v.customer),
      qty: numOr(v.qty),
      price: numOr(v.price),
      note: nullable(v.note),
      created_by: me.id
    });
    if (error) throw error;
    toast('ບັນທຶກການຂາຍແລ້ວ');
    form.reset(); form.date.value = today();
    await refresh(true);
  });

  // ສິນຄ້າ
  onSubmit('#form-product', async v => {
    const payload = {
      name: v.name.trim(),
      category: v.category.trim() || 'ຕິບເຂົ້າ',
      source_id: nullable(v.source_id),
      unit: nullable(v.unit) || 'ອັນ',
      min_stock: numOr(v.min_stock, 8)
    };
    const { error } = v.id
      ? await sb.from('products').update(payload).eq('id', v.id)
      : await sb.from('products').insert(payload);
    if (error) throw error;
    toast(v.id ? 'ບັນທຶກການແກ້ໄຂແລ້ວ' : 'ເພີ່ມສິນຄ້າແລ້ວ');
    resetProductForm();
    await refresh(true);
  });
  $('#btn-product-cancel').onclick = resetProductForm;

  // ແຫຼ່ງສິນຄ້າ
  onSubmit('#form-source', async v => {
    const payload = {
      code: nullable(v.code),
      name: v.name.trim(),
      contact: nullable(v.contact),
      note: nullable(v.note)
    };
    const { error } = v.id
      ? await sb.from('sources').update(payload).eq('id', v.id)
      : await sb.from('sources').insert(payload);
    if (error) throw error;
    toast(v.id ? 'ບັນທຶກການແກ້ໄຂແລ້ວ' : 'ເພີ່ມແຫຼ່ງສິນຄ້າແລ້ວ');
    resetSourceForm();
    await refresh(true);
  });
  $('#btn-source-cancel').onclick = resetSourceForm;

  // ລາຍຊື່ admin
  onSubmit('#form-allow', async (v, form) => {
    const { error } = await sb.from('admin_allowlist')
      .upsert({ email: v.email.trim().toLowerCase(), note: nullable(v.note) });
    if (error) throw error;
    toast('ເພີ່ມແລ້ວ');
    form.reset();
    await refresh(true);
  });

  // ວັນທີເລີ່ມຕົ້ນ = ມື້ນີ້
  ['#form-in', '#form-sale'].forEach(sel => {
    const f = $(sel);
    f.date.value = today();
    f.addEventListener('reset', () => setTimeout(() => { f.date.value = today(); }, 0));
  });

  $('#btn-refresh').onclick        = () => refresh();
  $('#btn-logout').onclick         = signOut;
  $('#btn-logout-denied').onclick  = signOut;
}

/* ============================================================================
 * 6. ເລີ່ມຕົ້ນ
 * ========================================================================= */

async function startApp(session) {
  // ຮັບປະກັນວ່າມີໂປຣໄຟລ໌ + ອ່ານສິດ
  const { data, error } = await sb.rpc('ensure_profile');
  if (error) {
    show('screen-denied');
    $('#denied-msg').textContent = friendlyError(error);
    return;
  }
  me = Array.isArray(data) ? data[0] : data;

  if (!me || me.active === false) {
    // ຍັງບໍ່ເຄີຍຖືກອະນຸມັດ = ຄົນໃໝ່ລໍຢູ່ | ເຄີຍອະນຸມັດແລ້ວຖືກປິດ = ຖືກລະງັບ
    const neverApproved = me && !me.approved_at;
    $('#denied-title').textContent = neverApproved ? 'ລໍຖ້າການອະນຸມັດ' : 'ບັນຊີຖືກລະງັບ';
    $('#denied-msg').textContent = neverApproved
      ? 'ສະໝັກສຳເລັດແລ້ວ. ຜູ້ດູແລລະບົບຕ້ອງອະນຸມັດບັນຊີຂອງທ່ານກ່ອນ ຈຶ່ງຈະໃຊ້ງານໄດ້ — ກະລຸນາແຈ້ງໃຫ້ຜູ້ດູແລຮູ້ ແລ້ວກົດ “ກວດອີກເທື່ອ”'
      : 'ບັນຊີຂອງທ່ານຖືກປິດການໃຊ້ງານໂດຍຜູ້ດູແລລະບົບ — ຕິດຕໍ່ຜູ້ດູແລເພື່ອເປີດຄືນ';
    $('#denied-email').textContent = me?.email ? 'ບັນຊີ: ' + me.email : '';
    // ປຸ່ມໜ້ານີ້ຕ້ອງຜູກຢູ່ບ່ອນນີ້ — wireForms() ບໍ່ໄດ້ແລ່ນເມື່ອຍັງບໍ່ຜ່ານດ່ານ
    $('#btn-logout-denied').onclick = signOut;
    $('#btn-recheck').onclick = () => startApp(session);
    show('screen-denied');
    return;
  }

  const u = session.user;
  $('#me-name').textContent   = me.full_name || me.email;
  $('#me-role').textContent   = me.role === 'admin' ? 'admin — ສິດເຕັມ' : 'staff — ບັນທຶກໄດ້';
  $('#me-role').className     = 'badge' + (me.role === 'admin' ? ' admin' : '');
  const avatar = me.avatar_url || u.user_metadata?.avatar_url;
  if (avatar) { $('#me-avatar').src = avatar; $('#me-avatar').hidden = false; }
  try { $('#conn-label').textContent = 'ຖານຂໍ້ມູນ: ' + new URL(sb.supabaseUrl ?? '').hostname; } catch { /* ຂ້າມ */ }

  show('screen-app');
  wireForms();
  await refresh(true);
}

async function main() {
  const cfg = readConfig();
  if (!cfg) return setupScreen();

  if (!window.supabase?.createClient) {
    show('screen-setup');
    return alertBox('setup-alert', 'ໂຫຼດ supabase-js ຈາກ CDN ບໍ່ໄດ້ — ກວດການເຊື່ອມຕໍ່ອິນເຕີເນັດ');
  }

  sb = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const { data: { session }, error } = await sb.auth.getSession();
  if (error) {
    setupScreen();
    return alertBox('setup-alert', friendlyError(error));
  }

  let started = false;
  sb.auth.onAuthStateChange((event, s) => {
    if (event === 'SIGNED_OUT') { me = null; loginScreen(); started = false; }
    else if (s && !started)     { started = true; startApp(s); }
  });

  if (session) { started = true; await startApp(session); }
  else         { loginScreen(); }
}

main().catch(err => {
  show('screen-setup');
  alertBox('setup-alert', friendlyError(err));
});

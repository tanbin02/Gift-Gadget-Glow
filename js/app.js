(() => {
'use strict';

/* ================= config & helpers ================= */
const CFG = Object.assign({ CURRENCY: '৳', SHOP_NAME: 'Gift-Gadget-Glow', TAGLINE: '', FOOTER_NOTE: '', DELIVERY_PRESETS: [0, 60, 100, 130] }, window.APP_CONFIG || {});

// Category গুলো Google Sheet এ থাকে ও Stock → ⚙ Category থেকে বদলানো যায়। নিচেরটা শুধু শুরুর ডিফল্ট।
const DEFAULT_CATS = [
  { key: 'main',        label: 'Main',               prefix: 'MN', icon: '📦' },
  { key: 'accessories', label: 'Mobile Accessories', prefix: 'AC', icon: '🔌' },
  { key: 'gift',        label: 'Gift',               prefix: 'GF', icon: '🎁' },
  { key: 'combo',       label: 'Combo',              prefix: 'CB', icon: '✨' }
];
const CATS = {};
function applyCats(list) {
  Object.keys(CATS).forEach(k => delete CATS[k]);
  list.forEach(c => { CATS[c.key] = { label: c.label, prefix: c.prefix, icon: c.icon || '📦' }; });
}
const catOf = k => CATS[k] || { label: k, prefix: 'XX', icon: '📦' };
const prodCatKeys = () => Object.keys(CATS).filter(k => k !== 'combo');
applyCats(DEFAULT_CATS);

const store = {
  get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
const money = n => CFG.CURRENCY + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const pad = (n, l = 3) => String(n).padStart(l, '0');
const empty = t => `<div class="empty">${t}</div>`;

/* ----- product photos (Google Drive file id) ----- */
const photoSrc = (id, alt) => String(id).startsWith('data:') ? id : alt ? `https://drive.google.com/thumbnail?id=${id}&sz=w800` : `https://lh3.googleusercontent.com/d/${id}=w800`;
const thumb = id => id ? `<img class="th" src="${photoSrc(id)}" data-pid="${esc(id)}" alt="" loading="lazy">` : '';
// একটা Google link না চললে আরেকটা চেষ্টা করে
document.addEventListener('error', e => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.dataset && t.dataset.pid) {
    if (!t.dataset.alt) { t.dataset.alt = '1'; t.src = photoSrc(t.dataset.pid, true); } else t.style.visibility = 'hidden';
  }
}, true);

// ছবি ছোট করে (max 900px, JPEG) — ফোনের বড় ছবিও দ্রুত upload হবে
function compressImage(file, max = 900, q = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const s = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', q));
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    im.src = url;
  });
}
function photoFieldHTML(id) {
  return `<div class="field">Product এর ছবি (ঐচ্ছিক)
    <div class="photo-field">
      <div class="photo-prev" id="ph-prev">${id ? thumb(id) : '<span>📷</span>'}</div>
      <div class="photo-btns">
        <label class="btn sm" for="ph-file">📷 ছবি তুলুন / বাছুন</label>
        <input id="ph-file" type="file" accept="image/*" hidden>
        <button type="button" class="btn sm ghost danger" id="ph-rm" ${id ? '' : 'hidden'}>ছবি সরান</button>
        <small id="ph-info"></small>
      </div>
    </div></div>`;
}
function wirePhoto(m, hadPhoto) {
  const st = { data: '', remove: false };
  const file = $('#ph-file', m), prev = $('#ph-prev', m), rm = $('#ph-rm', m), info = $('#ph-info', m);
  file.addEventListener('change', async () => {
    const f = file.files[0]; if (!f) return;
    try {
      st.data = await compressImage(f); st.remove = false;
      prev.innerHTML = `<img class="th" src="${st.data}" alt="">`;
      rm.hidden = false; info.textContent = Math.round(st.data.length * 0.75 / 1024) + ' KB';
    } catch (e) { toast('ছবিটা পড়া যায়নি, অন্য ছবি দিন', 'err'); }
  });
  rm.addEventListener('click', () => {
    st.data = ''; st.remove = hadPhoto; file.value = '';
    prev.innerHTML = '<span>📷</span>'; rm.hidden = true; info.textContent = '';
  });
  return st;
}

/* ----- QR (customer view link) ----- */
function viewUrl(o) {
  if (typeof CFG.viewUrl === 'function') return CFG.viewUrl(o);
  const base = CFG.PUBLIC_VIEW_URL || new URL('view.html', location.href).href;
  return `${base}?o=${encodeURIComponent(o.invoiceNo)}&t=${encodeURIComponent(o.token || '')}`;
}
function qrDataUrl(text) {
  if (!window.qrcode) return '';
  try { const q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createDataURL(6, 2); }
  catch (e) { return ''; }
}

function nowStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)} ${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`;
}
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

const state = {
  pin: store.get('ggg_pin'),
  products: [], combos: [], orders: [],
  cart: [],            // { sku, qty, price }
  pCat: 'all', sCat: 'all',
  oFilter: 'all',      // Orders filter: all | Confirmed | Cancelled
  sel: new Set(),      // select করা order (delete এর জন্য)
  summary: null,       // আজ / এই মাস / সব সময়: বিক্রি, কেনা দাম, লাভ (backend থেকে)
  fin: ['today', 'month', 'all'].includes(store.get('ggg_fin')) ? store.get('ggg_fin') : 'month'
};

/* ================= API ================= */
async function api(action, data = {}) {
  if (!CFG.API_URL) throw new Error('API_URL সেট করা হয়নি (js/config.js)');
  let res;
  try {
    res = await fetch(CFG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // preflight এড়াতে
      body: JSON.stringify({ pin: state.pin, action, data })
    });
  } catch (e) {
    throw new Error('Internet বা server এ সমস্যা — আবার চেষ্টা করুন');
  }
  let json;
  try { json = await res.json(); } catch (e) { throw new Error('Server থেকে ঠিক উত্তর আসেনি (Deploy settings চেক করুন)'); }
  if (!json.ok) throw new Error(json.error || 'কিছু একটা ভুল হয়েছে');
  return json.data;
}

function setSync(kind, text) {
  const el = $('#sync');
  el.className = 'sync ' + kind;
  el.title = text || '';
}

const SHOP_MAP = { shopName: 'SHOP_NAME', tagline: 'TAGLINE', phone: 'SHOP_PHONE', address: 'SHOP_ADDRESS', facebook: 'SHOP_FACEBOOK', footer: 'FOOTER_NOTE' };
function applyShop(st) {
  Object.keys(SHOP_MAP).forEach(k => { if (st[k] !== undefined && !(k === 'shopName' && !st[k])) CFG[SHOP_MAP[k]] = st[k]; });
  const n = CFG.SHOP_NAME || 'Gift-Gadget-Glow';
  const b = $('#brand-name'), l = $('#brand-logo');
  if (b) b.textContent = n;
  if (l) l.textContent = n.charAt(0).toUpperCase();
  document.title = `${n} · Invoice & Stock`;
}

async function load(silent) {
  setSync('busy', 'Syncing…');
  try {
    const d = await api('getAll');
    if (d.categories && d.categories.length) applyCats(d.categories);
    if (state.pCat !== 'all' && !CATS[state.pCat]) state.pCat = 'all';
    if (state.sCat !== 'all' && !CATS[state.sCat]) state.sCat = 'all';
    state.products = d.products || [];
    state.combos = d.combos || [];
    state.orders = d.orders || [];
    state.summary = d.summary || null;
    applyShop(d.settings || {});
    // cart এ যে SKU আর নেই সেগুলো বাদ
    const have = new Set(catalog().map(i => i.sku));
    state.cart = state.cart.filter(l => have.has(l.sku));
    setSync('ok', 'Synced');
    renderAll();
  } catch (e) {
    setSync('err', e.message);
    if (!silent) toast(e.message, 'err');
    throw e;
  }
}

/* ================= catalog ================= */
function productMap() { const m = {}; state.products.forEach(p => m[p.sku] = p); return m; }
function comboStock(c, pm) {
  if (!c.items || !c.items.length) return 0;
  return Math.min(...c.items.map(it => { const p = pm[it.sku]; return p ? Math.floor(p.stock / it.qty) : 0; }));
}
function catalog() {
  const pm = productMap();
  const comboCost = c => (c.items || []).reduce((s, it) => s + ((pm[it.sku] || {}).cost || 0) * it.qty, 0);
  const combos = state.combos.map(c => ({ sku: c.sku, name: c.name, price: c.price, cost: comboCost(c), category: 'combo', isCombo: true, items: c.items, photo: c.photo || '', stock: comboStock(c, pm), lowStockAt: 3 }));
  return state.products.map(p => ({ ...p, cost: p.cost || 0, isCombo: false })).concat(combos);
}
function stockBadge(i) {
  if (i.stock <= 0) return '<span class="badge bad">Stock নেই</span>';
  if (i.stock <= i.lowStockAt) return `<span class="badge warn">Low · ${i.stock}</span>`;
  return `<span class="badge ok">${i.stock} pcs</span>`;
}
function chipsHTML(active) {
  const all = catalog();
  const mk = (id, label, n) => `<button class="chip ${active === id ? 'on' : ''}" data-cat="${id}">${label}<span>${n}</span></button>`;
  return mk('all', 'সব', all.length) + Object.keys(CATS).map(k => mk(k, `${CATS[k].icon} ${esc(CATS[k].label)}`, all.filter(i => i.category === k).length)).join('');
}
function nextSku(cat) {
  const prefix = catOf(cat).prefix;
  let max = 0;
  catalog().forEach(i => {
    const m = String(i.sku).toUpperCase().match(new RegExp('^' + prefix + '-(\\d+)$'));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${prefix}-${pad(max + 1)}`;
}

/* ================= UI utils ================= */
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = '.3s'; setTimeout(() => el.remove(), 300); }, type === 'err' ? 5200 : 2600);
}
function openModal(html, { wide = false, onMount } = {}) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="backdrop"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  root.classList.add('open');
  document.body.classList.add('noscroll');
  $('.backdrop', root).addEventListener('mousedown', e => { if (e.target.classList.contains('backdrop')) closeModal(); });
  if (onMount) onMount($('.modal', root));
}
function closeModal() {
  const r = $('#modal-root');
  r.classList.remove('open'); r.innerHTML = '';
  document.body.classList.remove('noscroll');
}
async function withBusy(btn, fn) {
  if (!btn || btn.disabled) return;
  btn.disabled = true; btn.classList.add('loading');
  try { return await fn(); }
  finally { btn.disabled = false; btn.classList.remove('loading'); }
}

/* ================= tabs ================= */
function switchTab(name) {
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $$('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + name));
  window.scrollTo({ top: 0 });
}

/* ================= INVOICE: picker & cart ================= */
function renderPicker() {
  $('#p-chips').innerHTML = chipsHTML(state.pCat);
  const q = $('#p-search').value.trim().toLowerCase();
  const list = catalog().filter(i => (state.pCat === 'all' || i.category === state.pCat) &&
    (!q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)));
  $('#p-grid').innerHTML = list.length ? list.map(i => `
    <button class="pcard ${i.stock <= 0 ? 'out' : ''}" data-sku="${esc(i.sku)}" ${i.stock <= 0 ? 'disabled' : ''}>
      <span class="pimg">${i.photo ? thumb(i.photo) : `<span class="pcat">${catOf(i.category).icon}</span>`}</span>
      <b>${esc(i.name)}</b>
      <small>${esc(i.sku)}</small>
      <span class="prow"><em>${money(i.price)}</em>${stockBadge(i)}</span>
    </button>`).join('') : `<div style="grid-column:1/-1">${empty(catalog().length ? 'কোনো product পাওয়া যায়নি' : 'এখনো কোনো product নেই — Stock ট্যাব থেকে যোগ করুন')}</div>`;
}

function addToCart(sku) {
  const item = catalog().find(i => i.sku === sku);
  if (!item) return;
  const line = state.cart.find(l => l.sku === sku);
  if (line) {
    if (line.qty + 1 > item.stock) return toast(`${item.name}: stock এ আছে মাত্র ${item.stock}টি`, 'warn');
    line.qty++;
  } else {
    state.cart.push({ sku, qty: 1, price: item.price });
  }
  renderCart(); renderPreview();
}

function renderCart() {
  const cat = Object.fromEntries(catalog().map(i => [i.sku, i]));
  const sub = state.cart.reduce((s, l) => s + l.qty * num(l.price), 0);
  $('#cart').innerHTML = state.cart.length ? state.cart.map(l => {
    const it = cat[l.sku] || { name: l.sku };
    return `<div class="cline" data-sku="${esc(l.sku)}">
      <div class="nm"><b>${esc(it.name)}</b><small>${esc(l.sku)}</small></div>
      <div class="stepper"><button data-act="dec" aria-label="কমান">−</button><span>${l.qty}</span><button data-act="inc" aria-label="বাড়ান">＋</button></div>
      <input class="pr" data-act="price" inputmode="decimal" value="${esc(l.price)}" aria-label="দাম">
      <div class="lt">${money(l.qty * num(l.price))}</div>
      <button class="rm" data-act="del" aria-label="বাদ দিন">×</button>
    </div>`;
  }).join('') + `<div class="csum"><span>Subtotal</span><span>${money(sub)}</span></div>`
    : '<div class="cart-empty">Cart খালি — উপর থেকে product এ ট্যাপ করুন</div>';
}

function draftOrder() {
  const cat = Object.fromEntries(catalog().map(i => [i.sku, i]));
  const items = state.cart.map(l => ({ sku: l.sku, name: (cat[l.sku] || {}).name || l.sku, category: (cat[l.sku] || {}).category, qty: l.qty, price: num(l.price) }));
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const delivery = Math.max(0, num($('#delivery').value)), discount = Math.max(0, num($('#discount').value));
  return {
    invoiceNo: 'DRAFT', date: nowStr(),
    customer: $('#c-name').value.trim(), phone: $('#c-phone').value.trim(), address: $('#c-address').value.trim(),
    items, subtotal, delivery, discount, total: Math.max(0, subtotal + delivery - discount),
    payment: $('#payment').value, note: $('#note').value.trim(), status: 'Draft'
  };
}
function renderPreview() { $('#inv-preview').innerHTML = invoiceHTML(draftOrder()); }

function clearForm() {
  state.cart = [];
  ['#c-name', '#c-phone', '#c-address', '#note'].forEach(s => $(s).value = '');
  $('#delivery').value = '0'; $('#discount').value = '0'; $('#payment').selectedIndex = 0;
  renderCart(); renderPreview(); renderPicker();
}

async function createInvoice() {
  const d = draftOrder();
  if (!d.items.length) return toast('আগে Cart এ product যোগ করুন', 'warn');
  if (!d.customer) return toast('Customer এর নাম দিন', 'warn');
  if (!d.phone) return toast('মোবাইল নম্বর দিন', 'warn');
  if (!/^(\+?88)?01[3-9]\d{8}$/.test(d.phone.replace(/[\s-]/g, '')) &&
      !confirm('মোবাইল নম্বরটা ঠিক মনে হচ্ছে না। তবুও এগিয়ে যাবেন?')) return;
  if (!d.address && !confirm('ঠিকানা দেওয়া হয়নি। তবুও এগিয়ে যাবেন?')) return;

  await withBusy($('#btn-create'), async () => {
    try {
      const order = await api('createOrder', {
        customer: d.customer, phone: d.phone, address: d.address,
        items: state.cart.map(l => ({ sku: l.sku, qty: l.qty, price: num(l.price) })),
        delivery: d.delivery, discount: d.discount, payment: d.payment, note: d.note
      });
      clearForm();
      await load(true).catch(() => {});
      toast('Invoice তৈরি হয়েছে, stock আপডেট ✓', 'ok');
      invoiceModal(order);
    } catch (e) { toast(e.message, 'err'); }
  });
}

/* ================= INVOICE sheet ================= */
function invoiceHTML(o) {
  const draft = o.invoiceNo === 'DRAFT';
  const rows = o.items.length ? o.items.map((i, n) => `
    <tr><td>${n + 1}</td>
      <td>${esc(i.name)}${i.category === 'combo' ? '<span class="tag">COMBO</span>' : ''}<small>${esc(i.sku)}</small></td>
      <td>${i.qty}</td><td>${money(i.price)}</td><td><b>${money(i.qty * i.price)}</b></td></tr>`).join('')
    : '<tr><td colspan="5" class="inv-empty">এখনো কোনো product যোগ করা হয়নি</td></tr>';
  const contact = [CFG.SHOP_PHONE, CFG.SHOP_ADDRESS, CFG.SHOP_FACEBOOK].filter(Boolean).map(esc).join(' · ');
  const cancelled = o.status === 'Cancelled';
  const qr = !draft && o.token ? qrDataUrl(viewUrl(o)) : '';
  const qrBlock = draft
    ? `<div class="inv-qr ph"><div class="qrbox">QR</div><div class="qrtxt"><b>Scan করে product দেখুন</b>Invoice তৈরি হলে এখানে QR আসবে</div></div>`
    : (qr ? `<div class="inv-qr"><img class="qrimg" src="${qr}" alt="QR code"><div class="qrtxt"><b>Scan করে product দেখুন</b>আপনার order এর product এর নাম, দাম আর ছবি</div></div>` : '');
  return `<div class="inv">
    ${cancelled ? '<div class="inv-watermark">CANCELLED</div>' : ''}
    <div class="inv-head">
      <div>
        <div class="inv-brand"><div class="inv-logo">${esc(CFG.SHOP_NAME.charAt(0))}</div>
          <div><div class="inv-shop">${esc(CFG.SHOP_NAME)}</div><div class="inv-tag">${esc(CFG.TAGLINE || '')}</div></div></div>
        ${contact ? `<div class="inv-contact">${contact}</div>` : ''}
      </div>
      <div class="inv-title"><h2>INVOICE</h2><div class="no">${draft ? 'DRAFT' : esc(o.invoiceNo)}</div><div>${esc(fmtDate(o.date))}</div></div>
    </div>
    <div class="inv-body">
      <div class="inv-parties">
        <div><h5>Billed to</h5>
          <div class="cn">${esc(o.customer) || '<span class="muted">Customer এর নাম</span>'}</div>
          <div>${esc(o.phone) || '<span class="muted">মোবাইল নম্বর</span>'}</div>
          <div class="muted">${esc(o.address) || 'ঠিকানা'}</div></div>
        <div class="inv-pay"><h5>Payment</h5><span class="pill ${cancelled ? 'cancel' : ''}">${cancelled ? 'Cancelled' : esc(o.payment)}</span></div>
      </div>
      <table class="inv-table">
        <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="inv-totals">
        <div><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
        ${o.delivery ? `<div><span>Delivery</span><span>${money(o.delivery)}</span></div>` : ''}
        ${o.discount ? `<div><span>Discount</span><span>− ${money(o.discount)}</span></div>` : ''}
        <div class="grand"><span>${o.payment === 'Paid' ? 'Total (Paid)' : 'Total'}</span><span>${money(o.total)}</span></div>
      </div>
      ${o.note ? `<div class="inv-note">📝 ${esc(o.note)}</div>` : ''}
    </div>
    ${qrBlock}
    <div class="inv-foot"><b>${esc(CFG.FOOTER_NOTE || 'Thank you!')}</b>${esc(CFG.SHOP_NAME)}</div>
  </div>`;
}

function textInvoice(o) {
  const L = [`*${CFG.SHOP_NAME}*`, `Invoice: ${o.invoiceNo}`, `Date: ${fmtDate(o.date)}`, '',
    `Name: ${o.customer}`, `Phone: ${o.phone}`, `Address: ${o.address}`, '--------------------'];
  o.items.forEach((i, n) => L.push(`${n + 1}. ${i.name} × ${i.qty} = ${money(i.qty * i.price)}`));
  L.push('--------------------', `Subtotal: ${money(o.subtotal)}`);
  if (o.delivery) L.push(`Delivery: ${money(o.delivery)}`);
  if (o.discount) L.push(`Discount: -${money(o.discount)}`);
  L.push(`*Total: ${money(o.total)}*`, `Payment: ${o.payment}`);
  if (o.note) L.push(`Note: ${o.note}`);
  if (o.token) L.push('', `Product এর ছবি দেখুন: ${viewUrl(o)}`);
  L.push('', CFG.FOOTER_NOTE || 'Thank you!');
  return L.join('\n');
}

async function downloadPNG(el, name, btn) {
  if (!window.html2canvas) return toast('Image library লোড হয়নি — Print → Save as PDF ব্যবহার করুন', 'warn');
  await withBusy(btn, async () => {
    try {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const a = document.createElement('a');
      a.download = name + '.png'; a.href = canvas.toDataURL('image/png'); a.click();
    } catch (e) { toast('Image বানানো যায়নি — Print ব্যবহার করুন', 'err'); }
  });
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copy হয়েছে — Messenger এ paste করুন', 'ok'); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copy হয়েছে', 'ok'); } catch (_) { toast('Copy করা যায়নি', 'err'); }
    ta.remove();
  }
}

function invoiceModal(o) {
  const canCancel = o.status !== 'Cancelled';
  openModal(`
    <div class="mhead"><h3>${esc(o.invoiceNo)}</h3><button class="x" data-close aria-label="বন্ধ">×</button></div>
    <div class="inv-modal-body"><div class="print-area" id="inv-final">${invoiceHTML(o)}</div></div>
    <div class="mfoot">
      <button class="btn primary" id="m-png">⬇ Image (PNG)</button>
      <button class="btn" id="m-print">🖨 Print / PDF</button>
      <button class="btn" id="m-copy">📋 Text copy</button>
      ${o.token ? '<a class="btn" id="m-view" target="_blank" rel="noopener">👁 Customer view</a>' : ''}
      <span class="spacer"></span>
      ${canCancel ? '<button class="btn danger sm" id="m-cancel">Order cancel</button>' : ''}
    </div>`, {
    wide: true,
    onMount(m) {
      $('#m-png', m).onclick = e => downloadPNG($('.inv', m), o.invoiceNo, e.currentTarget);
      $('#m-print', m).onclick = () => window.print();
      $('#m-copy', m).onclick = () => copyText(textInvoice(o));
      const v = $('#m-view', m);
      if (v) {
        v.href = viewUrl(o);
        if (typeof CFG.openView === 'function') v.onclick = e => { e.preventDefault(); CFG.openView(o); };
      }
      const c = $('#m-cancel', m);
      if (c) c.onclick = () => {
        if (!confirm(`${o.invoiceNo} cancel করবেন? Stock ফেরত চলে যাবে।`)) return;
        withBusy(c, async () => {
          try { await api('cancelOrder', { invoiceNo: o.invoiceNo }); await load(true); closeModal(); toast('Order cancel হয়েছে, stock ফেরত এসেছে', 'ok'); }
          catch (e) { toast(e.message, 'err'); }
        });
      };
    }
  });
}

/* ================= STOCK ================= */
const stat = (label, value, tone = '') => `<div class="stat ${tone}"><small>${label}</small><b>${value}</b></div>`;

const FIN_LABEL = { today: 'আজ', month: 'এই মাস', all: 'সব সময়' };
function finHTML() {
  const all = catalog(), prods = state.products;
  const low = all.filter(i => i.stock > 0 && i.stock <= i.lowStockAt).length;
  const out = all.filter(i => i.stock <= 0).length;
  const units = prods.reduce((s, p) => s + p.stock, 0);
  const costVal = prods.reduce((s, p) => s + (p.cost || 0) * p.stock, 0);
  const saleVal = prods.reduce((s, p) => s + p.price * p.stock, 0);
  const noCost = prods.filter(p => !(p.cost > 0)).length;
  const cur = (state.summary && state.summary[state.fin]) || { orders: 0, sales: 0, cost: 0, profit: 0 };
  const margin = cur.sales > 0 ? (cur.profit / cur.sales) * 100 : 0;
  const gain = saleVal - costVal;
  const tile = (label, val, cls = '', sub = '') => `<div class="ftile ${cls}"><small>${label}</small><b>${val}</b>${sub ? `<i>${sub}</i>` : ''}</div>`;
  return `
  <div class="fin-group">
    <div class="fin-head"><h3>📦 Inventory (এখন যা আছে)</h3></div>
    <div class="fin-tiles">
      ${tile('মোট stock এর মূল্য (কেনা দামে)', money(costVal), 'hero', `${units} পিস · ${prods.length}টা product`)}
      ${tile('সব বিক্রি হলে পাবেন', money(saleVal), '', 'বিক্রয় মূল্যে')}
      ${tile('সম্ভাব্য লাভ', money(gain), gain < 0 ? 'bad' : 'ok', 'সব বিক্রি হলে')}
      ${tile('মোট SKU', all.length)}
      ${tile('Low stock', low, low ? 'warn' : '')}
      ${tile('Stock শেষ', out, out ? 'bad' : '')}
    </div>
    ${noCost ? `<div class="fin-warn">⚠ ${noCost}টা product এর কেনা দাম দেওয়া নেই। Edit করে কেনা দাম দিলে হিসাব ঠিক হবে।</div>` : ''}
  </div>
  <div class="fin-group">
    <div class="fin-head"><h3>💰 বিক্রি ও লাভ</h3>
      <div class="seg" role="group" aria-label="সময়">${Object.keys(FIN_LABEL).map(k => `<button type="button" data-fin="${k}" class="${state.fin === k ? 'on' : ''}">${FIN_LABEL[k]}</button>`).join('')}</div></div>
    <div class="fin-tiles">
      ${tile('Order', cur.orders)}
      ${tile('মোট বিক্রি', money(cur.sales), '', 'discount বাদে')}
      ${tile('কেনা দাম (যা বিক্রি হয়েছে)', money(cur.cost))}
      ${tile('লাভ', money(cur.profit), (cur.profit < 0 ? 'bad' : 'ok') + ' hero', cur.sales > 0 ? margin.toFixed(1) + '% margin' : '')}
    </div>
    <p class="fin-note">লাভ = মোট বিক্রি − কেনা দাম। Delivery charge হিসাবে ধরা হয়নি। Cancel করা order গোনা হয় না।</p>
  </div>`;
}

function renderStock() {
  const all = catalog();
  $('#stock-stats').innerHTML = finHTML();
  $('#s-chips').innerHTML = chipsHTML(state.sCat);

  const q = $('#s-search').value.trim().toLowerCase();
  const list = all.filter(i => (state.sCat === 'all' || i.category === state.sCat) &&
    (!q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)));
  if (!list.length) { $('#s-table').innerHTML = empty(all.length ? 'কিছু পাওয়া যায়নি' : 'এখনো কোনো SKU নেই — “＋ নতুন SKU” চাপুন'); return; }

  $('#s-table').innerHTML = `<table class="tbl cards"><thead><tr>
    <th></th><th class="d-only">SKU</th><th>Product</th><th class="d-only">Category</th><th class="r d-only">Buy</th><th class="r d-only">Sell</th><th class="r">Stock</th><th></th></tr></thead><tbody>` +
    list.map(i => {
      const cat = catOf(i.category);
      const comp = i.isCombo ? `<span class="sub">${i.items.map(x => `${x.qty}× ${esc(x.sku)}`).join(' + ')}</span>` : '';
      const acts = i.isCombo
        ? `<button class="btn sm" data-act="edit-combo" data-sku="${esc(i.sku)}">Edit</button>`
        : `<button class="btn sm" data-act="stock" data-sku="${esc(i.sku)}">± Stock</button><button class="btn sm ghost" data-act="edit" data-sku="${esc(i.sku)}">Edit</button>`;
      const hasCost = i.cost > 0, g = i.price - i.cost, bad = g < 0 ? ' bad' : '';
      return `<tr>
        <td class="c-img"><span class="timg">${i.photo ? thumb(i.photo) : cat.icon}</span></td>
        <td class="mono d-only">${esc(i.sku)}</td>
        <td class="c-name"><b>${esc(i.name)}</b>${comp}<span class="sub m-only">${esc(i.sku)} · ${cat.icon} ${esc(cat.label)}</span></td>
        <td class="d-only">${cat.icon} ${esc(cat.label)}</td>
        <td class="r buy d-only">${hasCost ? money(i.cost) : '—'}</td>
        <td class="r d-only"><b>${money(i.price)}</b>${hasCost ? `<span class="gain${bad}">লাভ ${money(g)}</span>` : ''}</td>
        <td class="r c-stock">${stockBadge(i)}</td>
        <td class="c-money m-only"><div><small>কেনা</small><b>${hasCost ? money(i.cost) : '—'}</b></div><div><small>বিক্রি</small><b>${money(i.price)}</b></div><div><small>লাভ / পিস</small><b class="gain${bad}">${hasCost ? money(g) : '—'}</b></div></td>
        <td class="c-acts"><div class="acts">${acts}</div></td></tr>`;
    }).join('') + '</tbody></table>';
}

const EMOJI_CHOICES = ['📦','🔌','🎁','✨','🎧','⌚','📱','🔋','💡','🧸','👜','👕','👟','💄','🕶️','🎮','📷','🔊','🧴','☕','🎀','🛍️','💍','🌹'];

function catModal() {
  const used = k => catalog().filter(i => i.category === k).length;
  let rows = Object.keys(CATS).map(k => ({ key: k, label: CATS[k].label, prefix: CATS[k].prefix, icon: CATS[k].icon }));
  let lastIcon = null;
  openModal(`<form id="catf">
    <div class="mhead"><h3>Category বদলান</h3><button type="button" class="x" data-close aria-label="বন্ধ">×</button></div>
    <div class="mbody">
      <div class="note-box">নাম, icon আর SKU prefix নিজের মতো করুন। ↑ ↓ দিয়ে ক্রম বদলান। Prefix বদলালে শুধু <b>নতুন</b> SKU তে কাজ করবে, আগের SKU বদলাবে না।</div>
      <div class="cat-head"><span></span><span>Icon</span><span>নাম</span><span>Prefix</span><span></span></div>
      <div id="cat-rows"></div>
      <button type="button" class="btn sm" id="cat-add">＋ নতুন category</button>
      <div class="field" style="margin:14px 0 0">Icon বাছুন (আগে icon ঘরে ট্যাপ করুন, তারপর এখান থেকে)</div>
      <div class="emoji-row" id="cat-emoji">${EMOJI_CHOICES.map(e => `<button type="button" class="emo" data-e="${e}">${e}</button>`).join('')}</div>
    </div>
    <div class="mfoot"><span class="spacer"></span><button type="button" class="btn" data-close>বাতিল</button><button class="btn primary" type="submit">Save</button></div>
  </form>`, {
    onMount(m) {
      const list = $('#cat-rows', m);
      function draw() {
        list.innerHTML = rows.map((r, i) => `<div class="cat-row" data-i="${i}">
          <div class="cat-mv"><button type="button" data-mv="-1" ${i === 0 ? 'disabled' : ''} aria-label="উপরে">▲</button><button type="button" data-mv="1" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="নিচে">▼</button></div>
          <input class="ci" data-f="icon" value="${esc(r.icon)}" maxlength="8" aria-label="Icon">
          <input data-f="label" value="${esc(r.label)}" maxlength="30" placeholder="Category এর নাম" aria-label="নাম">
          <input class="cp" data-f="prefix" value="${esc(r.prefix)}" maxlength="4" placeholder="AB" aria-label="Prefix">
          <button type="button" class="x" data-del aria-label="মুছুন" ${r.key === 'combo' ? 'disabled title="Combo মুছা যায় না"' : ''}>×</button>
        </div>`).join('');
      }
      draw();
      list.addEventListener('input', e => {
        const t = e.target, row = t.closest('.cat-row'); if (!row) return;
        const r = rows[Number(row.dataset.i)];
        let v = t.value;
        if (t.dataset.f === 'prefix') { v = v.toUpperCase().replace(/[^A-Z0-9]/g, ''); t.value = v; }
        r[t.dataset.f] = v;
      });
      list.addEventListener('focusin', e => { if (e.target.dataset.f === 'icon') lastIcon = e.target; });
      list.addEventListener('click', e => {
        const row = e.target.closest('.cat-row'); if (!row) return;
        const i = Number(row.dataset.i), mv = e.target.closest('[data-mv]');
        if (mv) {
          const j = i + Number(mv.dataset.mv);
          if (j >= 0 && j < rows.length) { [rows[i], rows[j]] = [rows[j], rows[i]]; draw(); }
          return;
        }
        if (e.target.closest('[data-del]')) {
          const r = rows[i];
          if (r.key && r.key !== 'combo' && used(r.key)) return toast(`"${r.label}" এ ${used(r.key)}টা product আছে। আগে সেগুলো অন্য category তে নিন বা সরান`, 'warn');
          rows.splice(i, 1); draw();
        }
      });
      $('#cat-emoji', m).addEventListener('click', e => {
        const b = e.target.closest('[data-e]'); if (!b) return;
        const input = lastIcon && lastIcon.isConnected ? lastIcon : $('.cat-row .ci', m);
        if (!input) return;
        input.value = b.dataset.e; input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      $('#cat-add', m).onclick = () => {
        rows.push({ key: '', label: '', prefix: '', icon: '📦' }); draw();
        const inputs = $$('.cat-row [data-f=label]', m); inputs[inputs.length - 1].focus();
      };
      $('#catf', m).addEventListener('submit', e => {
        e.preventDefault();
        for (const r of rows) {
          if (!r.label.trim()) return toast('প্রতিটা category র নাম দিন', 'warn');
          if (!/^[A-Z][A-Z0-9]{0,3}$/.test(r.prefix)) return toast(`"${r.label}" এর prefix দিন (১–৪ অক্ষর, শুরুতে ইংরেজি অক্ষর, যেমন AC)`, 'warn');
        }
        withBusy($('button[type=submit]', m), async () => {
          try {
            await api('saveCategories', { cats: rows.map(r => ({ key: r.key, label: r.label.trim(), prefix: r.prefix, icon: r.icon.trim() || '📦' })) });
            await load(true); closeModal(); toast('Category আপডেট হয়েছে ✓', 'ok');
          } catch (err) { toast(err.message, 'err'); }
        });
      });
    }
  });
}

function productModal(sku) {
  const p = sku ? state.products.find(x => x.sku === sku) : null;
  const cat = p ? p.category : (prodCatKeys().includes(state.sCat) ? state.sCat : prodCatKeys()[0]);
  openModal(`<form id="pf">
    <div class="mhead"><h3>${p ? 'SKU Edit' : 'নতুন SKU'}</h3><button type="button" class="x" data-close aria-label="বন্ধ">×</button></div>
    <div class="mbody">
      <label class="field">Category
        <select name="category" ${p ? 'disabled' : ''}>${(p && !CATS[cat] ? [cat] : []).concat(prodCatKeys()).map(k => `<option value="${esc(k)}" ${k === cat ? 'selected' : ''}>${catOf(k).icon} ${esc(catOf(k).label)}</option>`).join('')}</select></label>
      <label class="field">SKU<input name="sku" value="${p ? esc(p.sku) : nextSku(cat)}" ${p ? 'readonly' : ''} required></label>
      <label class="field">Product এর নাম<input name="name" value="${p ? esc(p.name) : ''}" required autocomplete="off"></label>
      <div class="row3q">
        <label class="field">কেনা দাম (${CFG.CURRENCY})<input name="cost" inputmode="decimal" value="${p && p.cost ? p.cost : ''}" placeholder="0" autocomplete="off"></label>
        <label class="field">বিক্রয় মূল্য (${CFG.CURRENCY})<input name="price" inputmode="decimal" value="${p ? p.price : ''}" required></label>
        <label class="field">Stock (পিস)<input name="stock" inputmode="numeric" value="${p ? p.stock : 0}"></label>
      </div>
      <div class="margin-hint" id="pf-margin" aria-live="polite"></div>
      <label class="field">Low-stock সতর্কতা (এর নিচে নামলে লাল/হলুদ দেখাবে)<input name="lowStockAt" inputmode="numeric" value="${p ? p.lowStockAt : 5}"></label>
      ${photoFieldHTML(p ? p.photo : '')}
    </div>
    <div class="mfoot">
      ${p ? '<button type="button" class="btn danger ghost sm" id="pf-del">তালিকা থেকে সরান</button>' : ''}
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>বাতিল</button>
      <button class="btn primary" type="submit">Save</button>
    </div></form>`, {
    onMount(m) {
      const form = $('#pf', m), f = form.elements;   // f.name = input "name" (form.name would clash)
      const ph = wirePhoto(m, !!(p && p.photo));
      const mh = $('#pf-margin', m);
      const showMargin = () => {
        const c = num(f.cost.value), pr = num(f.price.value), g = pr - c;
        if (!String(f.cost.value).trim() || pr <= 0) { mh.className = 'margin-hint'; mh.textContent = 'কেনা দাম আর বিক্রয় মূল্য দিলে প্রতি পিসে লাভ এখানে দেখাবে'; return; }
        mh.className = 'margin-hint ' + (g < 0 ? 'bad' : 'ok');
        mh.textContent = g < 0 ? `⚠ লোকসান: প্রতি পিসে ${money(-g)}` : `প্রতি পিসে লাভ ${money(g)} (${(g / pr * 100).toFixed(0)}% margin)`;
      };
      f.cost.addEventListener('input', showMargin); f.price.addEventListener('input', showMargin); showMargin();
      let dirty = false;
      f.sku.addEventListener('input', () => dirty = true);
      f.category.addEventListener('change', () => { if (!dirty) f.sku.value = nextSku(f.category.value); });
      form.addEventListener('submit', e => {
        e.preventDefault();
        withBusy($('button[type=submit]', form), async () => {
          try {
            await api('saveProduct', {
              isNew: !p, category: f.category.value, sku: f.sku.value, name: f.name.value,
              price: num(f.price.value), cost: num(f.cost.value), stock: num(f.stock.value), lowStockAt: num(f.lowStockAt.value),
              photoData: ph.data, removePhoto: ph.remove
            });
            await load(true); closeModal(); toast(p ? 'Update হয়েছে ✓' : 'নতুন SKU যোগ হয়েছে ✓', 'ok');
          } catch (err) { toast(err.message, 'err'); }
        });
      });
      const del = $('#pf-del', m);
      if (del) del.onclick = () => hideSku(p.sku, del);
    }
  });
}

function hideSku(sku, btn) {
  if (!confirm(`${sku} তালিকা থেকে সরাবেন? (পুরনো invoice এ কোনো সমস্যা হবে না)`)) return;
  withBusy(btn, async () => {
    try { await api('deleteItem', { sku }); await load(true); closeModal(); toast('সরানো হয়েছে', 'ok'); }
    catch (e) { toast(e.message, 'err'); }
  });
}

function stockModal(sku) {
  const p = state.products.find(x => x.sku === sku);
  if (!p) return;
  openModal(`<form id="sf">
    <div class="mhead"><h3>Stock আপডেট</h3><button type="button" class="x" data-close aria-label="বন্ধ">×</button></div>
    <div class="mbody">
      <div class="note-box"><b>${esc(p.name)}</b> · ${esc(p.sku)}<br>এখন stock আছে: <b>${p.stock}</b> পিস</div>
      <label class="field">কত যোগ/বিয়োগ করবেন? (বিয়োগ করতে − দিন, যেমন −3)
        <input name="delta" inputmode="numeric" placeholder="+20" required autocomplete="off"></label>
      <div class="quick">${[1, 5, 10, 20, 50].map(n => `<button type="button" class="btn sm" data-q="${n}">+${n}</button>`).join('')}</div>
      <div id="sf-after" class="hint" style="text-align:left;margin-top:14px"></div>
    </div>
    <div class="mfoot"><span class="spacer"></span><button type="button" class="btn" data-close>বাতিল</button><button class="btn primary" type="submit">Apply</button></div>
  </form>`, {
    onMount(m) {
      const form = $('#sf', m), f = form.elements, after = $('#sf-after', m);
      const parse = () => num(String(f.delta.value).replace('−', '-').replace('+', ''));
      const upd = () => { const v = parse(); after.textContent = f.delta.value ? `নতুন stock হবে: ${p.stock + v}` : ''; };
      f.delta.addEventListener('input', upd);
      $$('[data-q]', m).forEach(b => b.onclick = () => { f.delta.value = '+' + (Math.max(0, parse()) + Number(b.dataset.q)); upd(); });
      setTimeout(() => f.delta.focus(), 50);
      form.addEventListener('submit', e => {
        e.preventDefault();
        const v = Math.trunc(parse());
        if (!v) return toast('০ ছাড়া একটা সংখ্যা দিন', 'warn');
        withBusy($('button[type=submit]', form), async () => {
          try { await api('adjustStock', { sku: p.sku, delta: v }); await load(true); closeModal(); toast('Stock আপডেট হয়েছে ✓', 'ok'); }
          catch (err) { toast(err.message, 'err'); }
        });
      });
    }
  });
}

function comboModal(sku) {
  const c = sku ? state.combos.find(x => x.sku === sku) : null;
  if (!state.products.length) return toast('আগে অন্তত একটা সাধারণ product যোগ করুন', 'warn');
  const rows = c ? c.items.map(i => ({ ...i })) : [{ sku: '', qty: 1 }];
  openModal(`<form id="cf">
    <div class="mhead"><h3>${c ? 'Combo Edit' : 'নতুন Combo'}</h3><button type="button" class="x" data-close aria-label="বন্ধ">×</button></div>
    <div class="mbody">
      <div class="row2">
        <label class="field">SKU<input name="sku" value="${c ? esc(c.sku) : nextSku('combo')}" ${c ? 'readonly' : ''} required></label>
        <label class="field">বিক্রয় মূল্য (${CFG.CURRENCY})<input name="price" inputmode="decimal" value="${c ? c.price : ''}" required></label>
      </div>
      <label class="field">Combo এর নাম<input name="name" value="${c ? esc(c.name) : ''}" required autocomplete="off"></label>
      ${photoFieldHTML(c ? c.photo : '')}
      <div class="field" style="margin-bottom:6px">Combo তে যা যা থাকবে</div>
      <div id="crows"></div>
      <button type="button" class="btn sm" id="c-add">＋ আরেকটা product</button>
      <div class="note-box" id="c-sum" style="margin-top:14px"></div>
      <div class="hint" style="text-align:left">Combo বিক্রি হলে ভেতরের প্রতিটা product এর stock নিজে থেকে কমবে।</div>
    </div>
    <div class="mfoot">
      ${c ? '<button type="button" class="btn danger ghost sm" id="cf-del">তালিকা থেকে সরান</button>' : ''}
      <span class="spacer"></span><button type="button" class="btn" data-close>বাতিল</button><button class="btn primary" type="submit">Save</button>
    </div></form>`, {
    onMount(m) {
      const form = $('#cf', m), f = form.elements, list = $('#crows', m);
      const pm = productMap();
      const ph = wirePhoto(m, !!(c && c.photo));
      function draw() {
        list.innerHTML = rows.map((r, i) => `<div class="crow">
          <select data-i="${i}" data-f="sku"><option value="">Product বাছুন…</option>
            ${state.products.map(p => `<option value="${esc(p.sku)}" ${p.sku === r.sku ? 'selected' : ''}>${esc(p.name)} (${esc(p.sku)}) · ${p.stock}</option>`).join('')}</select>
          <input data-i="${i}" data-f="qty" type="number" min="1" value="${r.qty}">
          <button type="button" class="x" data-del="${i}" aria-label="বাদ">×</button></div>`).join('');
        sum();
      }
      function sum() {
        const sep = rows.reduce((s, r) => s + (pm[r.sku] ? pm[r.sku].price * (num(r.qty) || 0) : 0), 0);
        const mine = num(f.price.value);
        const buy = rows.reduce((s, r) => s + (pm[r.sku] ? (pm[r.sku].cost || 0) * (num(r.qty) || 0) : 0), 0);
        $('#c-sum', m).innerHTML = `আলাদা আলাদা কিনলে মোট: <b>${money(sep)}</b>` + (mine && sep ? ` · Combo তে ছাড়: <b>${money(Math.max(0, sep - mine))}</b>` : '') +
          (buy ? `<br>কেনা দাম (ভেতরের product এর): <b>${money(buy)}</b>` + (mine ? ` · লাভ: <b style="color:var(--${mine - buy < 0 ? 'bad' : 'ok'})">${money(mine - buy)}</b>` : '') : '');
      }
      list.addEventListener('input', e => {
        const t = e.target, i = Number(t.dataset.i);
        if (isNaN(i)) return;
        rows[i][t.dataset.f] = t.dataset.f === 'qty' ? Math.max(1, Math.floor(num(t.value)) || 1) : t.value;
        sum();
      });
      list.addEventListener('click', e => {
        const d = e.target.closest('[data-del]');
        if (!d) return;
        rows.splice(Number(d.dataset.del), 1); if (!rows.length) rows.push({ sku: '', qty: 1 }); draw();
      });
      $('#c-add', m).onclick = () => { rows.push({ sku: '', qty: 1 }); draw(); };
      f.price.addEventListener('input', sum);
      draw();
      form.addEventListener('submit', e => {
        e.preventDefault();
        const items = rows.filter(r => r.sku);
        if (!items.length) return toast('Combo তে অন্তত একটা product বাছুন', 'warn');
        withBusy($('button[type=submit]', form), async () => {
          try {
            await api('saveCombo', { isNew: !c, sku: f.sku.value, name: f.name.value, price: num(f.price.value), items, photoData: ph.data, removePhoto: ph.remove });
            await load(true); closeModal(); toast(c ? 'Combo update হয়েছে ✓' : 'Combo যোগ হয়েছে ✓', 'ok');
          } catch (err) { toast(err.message, 'err'); }
        });
      });
      const del = $('#cf-del', m);
      if (del) del.onclick = () => hideSku(c.sku, del);
    }
  });
}

/* ================= ORDERS ================= */
const orderProfit = o => o.subtotal - o.discount - (o.cost || 0);
const O_FILTERS = [['all', 'সব'], ['Confirmed', 'Confirmed'], ['Cancelled', 'Cancelled']];
function visibleOrders() {
  const q = $('#o-search').value.trim().toLowerCase();
  return state.orders.filter(o => (state.oFilter === 'all' || o.status === state.oFilter) &&
    (!q || o.invoiceNo.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || o.phone.includes(q)));
}
function updateBulk() {
  const list = visibleOrders(), n = list.filter(o => state.sel.has(o.invoiceNo)).length;
  const bar = $('#o-bulk');
  bar.hidden = !list.length;
  if (!list.length) return;
  const all = n === list.length;
  bar.innerHTML = `<label class="chk"><input type="checkbox" id="o-selall" ${all ? 'checked' : ''}><span>${n ? `${n}টা select করা` : `সব select (${list.length})`}</span></label>
    <span class="spacer"></span>
    ${n ? `<button type="button" class="btn sm ghost" id="o-selclear">বাদ দিন</button><button type="button" class="btn sm danger" id="o-del">🗑 Delete (${n})</button>` : ''}`;
  const cb = $('#o-selall'); if (cb) cb.indeterminate = n > 0 && !all;
  $$('#o-table tr[data-no]').forEach(tr => tr.classList.toggle('sel', state.sel.has(tr.dataset.no)));
}
function renderOrders() {
  const today = nowStr().slice(0, 10);
  const live = state.orders.filter(o => o.status !== 'Cancelled');
  const tod = live.filter(o => o.date.slice(0, 10) === today);
  const month = live.filter(o => o.date.slice(0, 7) === today.slice(0, 7));
  const total = state.summary ? state.summary.all.orders : live.length;
  $('#order-stats').innerHTML =
    stat('আজকের order', tod.length) + stat('আজকের মোট (delivery সহ)', money(tod.reduce((s, o) => s + o.total, 0)), 'ok') +
    stat('এই মাসের মোট (delivery সহ)', money(month.reduce((s, o) => s + o.total, 0))) + stat('মোট order', total);

  // যে order আর নেই সেগুলো select থেকে বাদ
  const have = new Set(state.orders.map(o => o.invoiceNo));
  state.sel.forEach(n => { if (!have.has(n)) state.sel.delete(n); });
  $('#o-chips').innerHTML = O_FILTERS.map(([k, l]) => {
    const c = k === 'all' ? state.orders.length : state.orders.filter(o => o.status === k).length;
    return `<button type="button" class="chip ${state.oFilter === k ? 'on' : ''}" data-ofilter="${k}">${l} <span>${c}</span></button>`;
  }).join('');

  const list = visibleOrders();
  const shown = new Set(list.map(o => o.invoiceNo));
  state.sel.forEach(n => { if (!shown.has(n)) state.sel.delete(n); });   // filter/search এ লুকানো order কখনো select থাকে না
  $('#o-table').innerHTML = list.length ? `<table class="tbl cards o"><thead><tr>
    <th class="c-sel-h"></th><th>Invoice</th><th>Customer</th><th class="d-only">Items</th><th class="r d-only">Total</th><th class="r d-only">Profit</th><th class="d-only">Payment</th><th>Status</th></tr></thead><tbody>` +
    list.map(o => {
      const liveO = o.status !== 'Cancelled', pr = orderProfit(o);
      const prTxt = liveO ? `${o.costEstimated ? '<span class="est">~</span>' : ''}${money(pr)}` : '—';
      const bad = liveO && pr < 0 ? ' bad' : '';
      return `<tr class="click" data-no="${esc(o.invoiceNo)}">
      <td class="c-sel"><label class="chk" aria-label="Select ${esc(o.invoiceNo)}"><input type="checkbox" data-sel="${esc(o.invoiceNo)}" ${state.sel.has(o.invoiceNo) ? 'checked' : ''}></label></td>
      <td class="c-name"><span class="mono">${esc(o.invoiceNo)}</span><span class="sub">${esc(fmtDate(o.date))}</span></td>
      <td class="c-cust"><b>${esc(o.customer)}</b><span class="sub">${esc(o.phone)}</span></td>
      <td class="d-only">${o.items.reduce((s, i) => s + i.qty, 0)} pcs</td>
      <td class="r d-only"><b>${money(o.total)}</b></td>
      <td class="r d-only"><span class="gain${bad}" style="margin:0">${prTxt}</span></td>
      <td class="d-only">${esc(o.payment)}</td>
      <td class="c-stock"><span class="badge ${o.status === 'Cancelled' ? 'bad' : 'ok'}">${esc(o.status)}</span></td>
      <td class="c-money m-only"><div><small>Total</small><b>${money(o.total)}</b></div><div><small>লাভ</small><b class="gain${bad}">${prTxt}</b></div><div><small>${esc(o.payment)}</small><b>${o.items.reduce((s, i) => s + i.qty, 0)} pcs</b></div></td></tr>`;
    }).join('') + '</tbody></table>'
    : empty(state.orders.length ? 'কিছু পাওয়া যায়নি' : 'এখনো কোনো order নেই');
  updateBulk();
}

async function deleteSelectedOrders(btn) {
  const nos = [...state.sel];
  if (!nos.length) return;
  const conf = state.orders.filter(o => state.sel.has(o.invoiceNo) && o.status !== 'Cancelled').length;
  const msg = `${nos.length}টা order মুছে ফেলবেন? এটা আর ফেরানো যাবে না।` +
    (conf ? `\n\n⚠ এর মধ্যে ${conf}টা Confirmed order। মুছলে stock ফেরত আসবে না, আর ওগুলো বিক্রি ও লাভের হিসাব থেকে বাদ যাবে। (Stock ফেরত চাইলে আগে Order cancel করুন।)` : '');
  if (!confirm(msg)) return;
  await withBusy(btn, async () => {
    try {
      for (let i = 0; i < nos.length; i += 200) await api('deleteOrders', { invoiceNos: nos.slice(i, i + 200) });
      state.sel.clear();
      await load(true);
      toast(`${nos.length}টা order মোছা হয়েছে`, 'ok');
    } catch (e) { toast(e.message, 'err'); }
  });
}

/* ================= SETTINGS: theme & Excel ================= */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src; el.onload = resolve; el.onerror = () => reject(new Error('load'));
    document.head.appendChild(el);
  });
}
function buildWorkbook(X) {
  const wb = X.utils.book_new();
  const all = catalog(), prods = state.products, sm = state.summary || {};
  const units = prods.reduce((s, p) => s + p.stock, 0);
  const costVal = prods.reduce((s, p) => s + (p.cost || 0) * p.stock, 0);
  const saleVal = prods.reduce((s, p) => s + p.price * p.stock, 0);
  const per = (label, k) => { const r = sm[k] || { orders: 0, sales: 0, cost: 0, profit: 0 }; return [label, r.orders, r.sales, r.cost, r.profit]; };
  const summary = X.utils.aoa_to_sheet([
    [CFG.SHOP_NAME + ' — Report'], ['Generated', nowStr()], [],
    ['Sales & profit', 'Orders', 'Sales (after discount, excl. delivery)', 'Cost (buy price)', 'Profit'],
    per('Today', 'today'), per('This month', 'month'), per('All time', 'all'), [],
    ['Inventory (now)', 'Value'],
    ['Total stock (pcs)', units], ['Stock value at buy price', costVal], ['Stock value at sell price', saleVal], ['Potential profit', saleVal - costVal]
  ]);
  summary['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 36 }, { wch: 18 }, { wch: 14 }];
  const inv = [['SKU', 'Category', 'Name', 'Type', 'Buy price', 'Sell price', 'Profit / pc', 'Stock (pcs)', 'Stock value (buy)', 'Stock value (sell)']];
  all.forEach(i => inv.push([i.sku, catOf(i.category).label, i.name, i.isCombo ? 'Combo' : 'Product', i.cost || 0, i.price, i.price - (i.cost || 0), i.stock,
    i.isCombo ? '' : (i.cost || 0) * i.stock, i.isCombo ? '' : i.price * i.stock]));
  inv.push([], ['TOTAL (products only)', '', '', '', '', '', '', units, costVal, saleVal]);
  const invWs = X.utils.aoa_to_sheet(inv);
  invWs['!cols'] = [{ wch: 11 }, { wch: 20 }, { wch: 34 }, { wch: 9 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 17 }, { wch: 17 }];
  const sales = [['Invoice', 'Date', 'Customer', 'Phone', 'Payment', 'Status', 'Items', 'Sales (after discount)', 'Delivery', 'Discount', 'Total collected', 'Cost (buy price)', 'Profit']];
  state.orders.forEach(o => {
    const live = o.status !== 'Cancelled';
    sales.push([o.invoiceNo, o.date, o.customer, o.phone, o.payment, o.status, o.items.map(i => `${i.qty}× ${i.name}`).join(', '),
      o.subtotal - o.discount, o.delivery, o.discount, o.total, live ? o.cost || 0 : 0, live ? orderProfit(o) : 0]);
  });
  const salesWs = X.utils.aoa_to_sheet(sales);
  salesWs['!cols'] = [{ wch: 17 }, { wch: 19 }, { wch: 22 }, { wch: 14 }, { wch: 9 }, { wch: 11 }, { wch: 46 }, { wch: 14 }, { wch: 9 }, { wch: 9 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
  X.utils.book_append_sheet(wb, summary, 'Summary');
  X.utils.book_append_sheet(wb, invWs, 'Inventory');
  X.utils.book_append_sheet(wb, salesWs, 'Sales');
  return wb;
}
function csvFallback() {
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = [['SKU', 'Category', 'Name', 'Buy price', 'Sell price', 'Stock']].concat(catalog().map(i => [i.sku, catOf(i.category).label, i.name, i.cost || 0, i.price, i.stock]));
  const blob = new Blob(['﻿' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `Gift-Gadget-Glow_inventory_${nowStr().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
}
async function exportExcel(btn) {
  await withBusy(btn, async () => {
    try {
      if (!window.XLSX) await loadScript('js/xlsx.full.min.js');
      window.XLSX.writeFile(buildWorkbook(window.XLSX), `Gift-Gadget-Glow_${nowStr().slice(0, 10)}.xlsx`);
      toast('Excel download শুরু হয়েছে ✓', 'ok');
    } catch (e) {
      try { csvFallback(); toast('Excel library লোড হয়নি, তাই CSV নামানো হয়েছে (Excel এ খোলা যায়)', 'warn'); }
      catch (e2) { toast('Download করা যায়নি', 'err'); }
    }
  });
}


function settingsModal() {
  const T = window.GGG_THEME;
  if (!T) return toast('Theme ফাইল লোড হয়নি', 'err');
  const modes = [['auto', '🖥 Auto'], ['light', '☀️ Light'], ['dark', '🌙 Dark']];
  const sizes = [['s', 'ছোট'], ['m', 'মাঝারি'], ['l', 'বড়']];
  const tick = '<i class="tick">✓</i>';
  const fld = (k, label, val, ph = '') => `<label class="field">${label}<input name="${k}" value="${esc(val || '')}" maxlength="200" placeholder="${esc(ph)}" autocomplete="off"></label>`;
  openModal(`
    <div class="mhead"><h3>⚙ Settings</h3><button type="button" class="x" data-close aria-label="বন্ধ">×</button></div>
    <form class="mbody" id="set-form" autocomplete="off">
      <div class="set-sec"><h4>🎨 থিম</h4>
        <div class="thm-grid" id="set-mode" role="group" aria-label="Theme">${modes.map(([k, l]) => `
          <button type="button" class="thm ${T.mode() === k ? 'on' : ''}" data-mode="${k}">${tick}
            <span class="thm-prev ${k}"><b></b><b></b><b></b></span><span class="thm-l">${l}</span></button>`).join('')}</div></div>
      <div class="set-sec"><h4>রঙ বাছুন</h4>
        <div class="swatches" id="set-accent">${Object.keys(T.accents).map(k => { const a = T.accents[k]; return `<button type="button" class="swatch ${T.accent() === k ? 'on' : ''}" data-accent="${k}" style="--g:linear-gradient(135deg,${a.a},${a.b} 65%,${a.c})"><span>${tick}</span>${a.n}</button>`; }).join('')}</div></div>
      <div class="set-sec"><h4>লেখার size</h4>
        <div class="seg wide" id="set-size" role="group" aria-label="Text size">${sizes.map(([k, l]) => `<button type="button" data-size="${k}" class="${T.size() === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="set-sec"><h4>🏪 দোকানের তথ্য <em>Invoice এ দেখাবে</em></h4>
        ${fld('shopName', 'দোকানের নাম', CFG.SHOP_NAME)}
        ${fld('tagline', 'Tagline', CFG.TAGLINE, 'Gifts • Gadgets • Accessories')}
        <div class="row2">${fld('phone', 'ফোন', CFG.SHOP_PHONE, '01XXXXXXXXX')}${fld('facebook', 'Facebook page', CFG.SHOP_FACEBOOK, 'facebook.com/…')}</div>
        ${fld('address', 'ঠিকানা', CFG.SHOP_ADDRESS)}
        ${fld('footer', 'Invoice এর নিচের লেখা', CFG.FOOTER_NOTE, 'ধন্যবাদ!')}
        <p class="set-note">এই তথ্য Sheet এ জমা থাকে, তাই ফোন আর ল্যাপটপ দুটোতেই একই দেখাবে।</p></div>
      <div class="set-sec"><h4>📊 Data</h4>
        <button type="button" class="btn block" id="set-xlsx">⬇ Excel download (Inventory + Sales)</button>
        <p class="set-note">তিনটা sheet: Summary (বিক্রি ও লাভ), Inventory (কেনা দাম, বিক্রয় মূল্য, stock), Sales (সর্বশেষ ৫০০ order)।</p></div>
    </form>
    <div class="mfoot"><span class="spacer"></span><button type="submit" form="set-form" class="btn primary" id="set-save">ঠিক আছে</button></div>`, {
    onMount(m) {
      const pick = (box, attr, cls, fn) => $(box, m).addEventListener('click', e => {
        const b = e.target.closest(`[data-${attr}]`); if (!b) return;
        fn(b.dataset[attr]); $$(`${box} ${cls}`, m).forEach(x => x.classList.toggle('on', x === b));
      });
      pick('#set-mode', 'mode', '.thm', v => T.setMode(v));
      pick('#set-accent', 'accent', '.swatch', v => T.setAccent(v));
      pick('#set-size', 'size', 'button', v => T.setSize(v));
      $('#set-xlsx', m).addEventListener('click', e => exportExcel(e.currentTarget));
      const f = $('#set-form', m).elements;
      const keys = Object.keys(SHOP_MAP), before = Object.fromEntries(keys.map(k => [k, f[k].value]));
      $('#set-form', m).addEventListener('submit', async e => {
        e.preventDefault();
        const data = {}; keys.forEach(k => { data[k] = f[k].value.trim(); });
        if (!data.shopName) { toast('দোকানের নাম দিন', 'err'); f.shopName.focus(); return; }
        if (keys.every(k => data[k] === before[k].trim())) return closeModal();     // কিছু বদলায়নি
        await withBusy($('#set-save', m), async () => {
          try { applyShop(await api('saveSettings', data)); renderAll(); closeModal(); toast('সেভ হয়েছে ✓', 'ok'); }
          catch (err) { toast(err.message, 'err'); }
        });
      });
    }
  });
}

/* ================= render all & wiring ================= */
function renderAll() { renderPicker(); renderCart(); renderPreview(); renderStock(); renderOrders(); }

function showLock(msg) {
  $('#lock').hidden = false;
  $('#lock-err').textContent = msg || '';
  setTimeout(() => $('#pin-input').focus(), 50);
}

function wire() {
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) switchTab(b.dataset.tab); });
  document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // invoice tab
  $('#p-search').addEventListener('input', renderPicker);
  $('#p-chips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) { state.pCat = c.dataset.cat; renderPicker(); } });
  $('#p-grid').addEventListener('click', e => { const c = e.target.closest('.pcard'); if (c && !c.disabled) addToCart(c.dataset.sku); });
  $('#cart').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); const row = e.target.closest('.cline');
    if (!b || !row) return;
    const line = state.cart.find(l => l.sku === row.dataset.sku); if (!line) return;
    const act = b.dataset.act;
    if (act === 'inc') return addToCart(line.sku);
    if (act === 'dec') { line.qty--; if (line.qty < 1) state.cart = state.cart.filter(l => l !== line); }
    if (act === 'del') state.cart = state.cart.filter(l => l !== line);
    renderCart(); renderPreview();
  });
  $('#cart').addEventListener('input', e => {
    if (e.target.dataset.act !== 'price') return;
    const line = state.cart.find(l => l.sku === e.target.closest('.cline').dataset.sku);
    if (line) { line.price = num(e.target.value); renderPreview(); const sub = $('.csum span:last-child'); if (sub) sub.textContent = money(state.cart.reduce((s, l) => s + l.qty * num(l.price), 0)); const lt = e.target.closest('.cline').querySelector('.lt'); lt.textContent = money(line.qty * line.price); }
  });
  ['#c-name', '#c-phone', '#c-address', '#delivery', '#discount', '#payment', '#note'].forEach(s => $(s).addEventListener('input', renderPreview));
  $('#delivery-presets').innerHTML = (CFG.DELIVERY_PRESETS || []).map(n => `<button type="button" data-v="${n}">${n ? CFG.CURRENCY + n : 'Free'}</button>`).join('');
  $('#delivery-presets').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { $('#delivery').value = b.dataset.v; renderPreview(); } });
  $('#btn-create').addEventListener('click', createInvoice);
  $('#btn-clear').addEventListener('click', () => { if (!state.cart.length && !$('#c-name').value || confirm('সব মুছে নতুন করে শুরু করবেন?')) clearForm(); });

  // stock tab
  $('#s-search').addEventListener('input', renderStock);
  $('#s-chips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) { state.sCat = c.dataset.cat; renderStock(); } });
  $('#btn-add-sku').addEventListener('click', () => productModal(null));
  $('#btn-add-combo').addEventListener('click', () => comboModal(null));
  $('#btn-cats').addEventListener('click', () => catModal());
  $('#btn-settings').addEventListener('click', settingsModal);
  $('#stock-stats').addEventListener('click', e => {
    const b = e.target.closest('[data-fin]'); if (!b) return;
    state.fin = b.dataset.fin; store.set('ggg_fin', state.fin); $('#stock-stats').innerHTML = finHTML();
  });
  $('#s-table').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const sku = b.dataset.sku;
    if (b.dataset.act === 'stock') stockModal(sku);
    if (b.dataset.act === 'edit') productModal(sku);
    if (b.dataset.act === 'edit-combo') comboModal(sku);
  });

  // orders tab
  $('#o-search').addEventListener('input', renderOrders);
  $('#o-table').addEventListener('click', e => {
    const r = e.target.closest('tr[data-no]'); if (!r) return;
    if (e.target.closest('.c-sel')) return;                  // checkbox এ ট্যাপ করলে order খোলে না
    const o = state.orders.find(x => x.invoiceNo === r.dataset.no); if (o) invoiceModal(o);
  });
  $('#o-table').addEventListener('change', e => {
    const cb = e.target.closest('input[data-sel]'); if (!cb) return;
    state.sel[cb.checked ? 'add' : 'delete'](cb.dataset.sel); updateBulk();
  });
  $('#o-chips').addEventListener('click', e => {
    const b = e.target.closest('[data-ofilter]'); if (!b) return;
    state.oFilter = b.dataset.ofilter; renderOrders();
  });
  $('#o-bulk').addEventListener('click', e => {
    if (e.target.closest('#o-selclear')) { state.sel.clear(); $$('#o-table input[data-sel]').forEach(c => c.checked = false); updateBulk(); }
    const d = e.target.closest('#o-del'); if (d) deleteSelectedOrders(d);
  });
  $('#o-bulk').addEventListener('change', e => {
    if (e.target.id !== 'o-selall') return;
    visibleOrders().forEach(o => state.sel[e.target.checked ? 'add' : 'delete'](o.invoiceNo));
    $$('#o-table input[data-sel]').forEach(c => c.checked = e.target.checked); updateBulk();
  });

  // top bar
  $('#btn-refresh').addEventListener('click', e => withBusy(e.currentTarget, () => load().then(() => toast('Refresh হয়েছে', 'ok')).catch(() => {})));
  $('#btn-lock').addEventListener('click', () => { store.del('ggg_pin'); state.pin = ''; showLock(); });

  // lock
  $('#lock-form').addEventListener('submit', async e => {
    e.preventDefault();
    state.pin = $('#pin-input').value.trim();
    const btn = $('#lock-form button');
    await withBusy(btn, async () => {
      try { await load(true); store.set('ggg_pin', state.pin); $('#lock').hidden = true; $('#pin-input').value = ''; }
      catch (err) { $('#lock-err').textContent = err.message === 'Wrong PIN' ? 'PIN ভুল হয়েছে' : err.message; }
    });
  });
}

function init() {
  $('#setup-banner').hidden = !!CFG.API_URL;
  document.title = `${CFG.SHOP_NAME} · Invoice & Stock`;
  wire();
  renderAll();
  if (!CFG.API_URL) { setSync('err', 'API_URL সেট করা নেই'); return; }
  if (state.pin) load(true).catch(err => showLock(err.message === 'Wrong PIN' ? 'PIN বদলে গেছে, আবার দিন' : err.message));
  else showLock();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

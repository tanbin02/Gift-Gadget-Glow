(() => {
'use strict';
const CFG = Object.assign({ CURRENCY: '৳', SHOP_NAME: 'Gift-Gadget-Glow', TAGLINE: '', FOOTER_NOTE: '' }, window.APP_CONFIG || {});

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => CFG.CURRENCY + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const photoSrc = (id, alt) => String(id).startsWith('data:') ? id : alt ? `https://drive.google.com/thumbnail?id=${id}&sz=w800` : `https://lh3.googleusercontent.com/d/${id}=w800`;
const img = id => id ? `<img src="${photoSrc(id)}" data-pid="${esc(id)}" alt="" loading="lazy">` : '';

function fmtDate(s) {
  const d = new Date(String(s || '').replace(' ', 'T'));
  return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function viewHTML(d) {
  const cards = d.items.map(i => `
    <article class="gv-card">
      <div class="gv-photo">${i.photo ? img(i.photo) : (i.isCombo ? '✨' : '🎁')}</div>
      <div class="gv-body">
        <h2 class="gv-name">${esc(i.name)}${i.isCombo ? '<span class="gv-tag-combo">COMBO</span>' : ''}</h2>
        <div class="gv-row"><span class="gv-price">${money(i.price)}</span><span class="gv-qty">পরিমাণ: ${i.qty} · মোট ${money(i.price * i.qty)}</span></div>
        ${i.parts && i.parts.length ? `<div class="gv-parts"><h4>এই combo তে আছে</h4>${i.parts.map(p => `
          <div class="gv-part"><div class="pi">${p.photo ? img(p.photo) : '📦'}</div><b>${esc(p.name)}</b><span class="q">× ${p.qty}</span></div>`).join('')}</div>` : ''}
      </div>
    </article>`).join('');
  return `
    <div class="gv-head">
      <div class="gv-brand"><div class="gv-logo">${esc(CFG.SHOP_NAME.charAt(0))}</div>
        <div><div class="gv-shop">${esc(CFG.SHOP_NAME)}</div><div class="gv-tag">${esc(CFG.TAGLINE || '')}</div></div></div>
      <div class="gv-meta"><div><h1>আপনার order এর product</h1><small>${esc(fmtDate(d.date))}</small></div><span class="gv-no">${esc(d.invoiceNo)}</span></div>
    </div>
    <div class="gv-list">${cards}</div>
    ${d.status === 'Cancelled' ? '<div class="gv-cancel">এই order টি cancel করা হয়েছে</div>' : ''}
    <div class="gv-sum">
      <div><span>Subtotal</span><span>${money(d.subtotal)}</span></div>
      ${d.delivery ? `<div><span>Delivery</span><span>${money(d.delivery)}</span></div>` : ''}
      ${d.discount ? `<div><span>Discount</span><span>− ${money(d.discount)}</span></div>` : ''}
      <div class="grand"><span>Total</span><span>${money(d.total)}</span></div>
    </div>
    <div class="gv-foot"><b>${esc(CFG.FOOTER_NOTE || 'Thank you!')}</b>${esc(CFG.SHOP_NAME)}</div>`;
}

// ছবি লোড না হলে আরেকটা Google link চেষ্টা করে
document.addEventListener('error', e => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.dataset && t.dataset.pid) {
    if (!t.dataset.alt) { t.dataset.alt = '1'; t.src = photoSrc(t.dataset.pid, true); } else t.style.visibility = 'hidden';
  }
}, true);

// ছবিতে ট্যাপ করলে বড় করে দেখায়
document.addEventListener('click', e => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.closest('.gv-photo, .gv-part .pi')) {
    const lb = document.createElement('div');
    lb.className = 'gv-lb';
    lb.innerHTML = `<img src="${esc(t.src)}" alt="">`;
    lb.addEventListener('click', () => lb.remove());
    document.body.appendChild(lb);
  }
});

async function boot() {
  const root = document.getElementById('view-root');
  if (!root) return;
  document.title = `আপনার Order · ${CFG.SHOP_NAME}`;
  const q = new URLSearchParams(location.search);
  const o = q.get('o'), t = q.get('t');
  const fail = msg => { root.innerHTML = `<div class="gv-state err">${esc(msg)}</div>`; };
  if (!o || !t) return fail('এই link টি ঠিক নয়। Invoice এর QR আবার scan করুন।');
  if (!CFG.API_URL) return fail('Site এর setup সম্পূর্ণ হয়নি।');
  try {
    const res = await fetch(`${CFG.API_URL}${CFG.API_URL.includes('?') ? '&' : '?'}action=order&o=${encodeURIComponent(o)}&t=${encodeURIComponent(t)}`);
    const json = await res.json();
    if (!json.ok) return fail(json.error || 'Order পাওয়া যায়নি');
    const sh = json.data.shop || {};
    if (sh.shopName) CFG.SHOP_NAME = sh.shopName;
    if (sh.tagline !== undefined) CFG.TAGLINE = sh.tagline;
    if (sh.footer !== undefined) CFG.FOOTER_NOTE = sh.footer;
    document.title = `আপনার Order · ${CFG.SHOP_NAME}`;
    root.innerHTML = viewHTML(json.data);
  } catch (e) {
    fail('লোড করা যায়নি। Internet চেক করে আবার চেষ্টা করুন।');
  }
}

window.GGG_VIEW = { viewHTML };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

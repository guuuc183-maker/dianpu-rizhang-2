// 店铺日账 —— 主逻辑
import * as DB from './db.js';

const $ = id => document.getElementById(id);
const views = ['v-loading', 'v-config', 'v-login', 'v-setup', 'v-main'];
function show(name) {
  views.forEach(v => $(v).hidden = v !== name);
}
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, 2200);
}
function errBox(id, msg) {
  const e = $(id);
  if (!msg) { e.hidden = true; return; }
  e.textContent = msg; e.hidden = false;
}
const fmtD = d => d.toISOString().slice(0, 10); // 注意：UTC 日期
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function monthStr() { return todayStr().slice(0, 7); }
const money = n => (Math.round(n * 100) / 100).toString();
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function prettyDate(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  return `${y}年${m}月${d}日 ${WEEK[new Date(y, m - 1, d).getDay()]}`;
}
function lastYear(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  return `${y - 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function prevMonth(ms) {
  let [y, m] = ms.split('-').map(Number); m--;
  if (m < 1) { m = 12; y--; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
function monthName(ms) { const [y, m] = ms.split('-').map(Number); return `${y}年${m}月`; }

let user = null;          // firebase user
let myName = '';
let shopId = null;
let shop = null;
let records = {};         // date -> rec
let unsubShop = null, unsubRec = null;

function resetSubs() {
  if (unsubShop) { unsubShop(); unsubShop = null; }
  if (unsubRec) { unsubRec(); unsubRec = null; }
}

// ---------- 启动 ----------
DB.init();
if (!DB.configured()) { show('v-config'); }
else {
  DB.onUser(async u => {
    resetSubs();
    user = u;
    if (!u) { show('v-login'); return; }
    const { shopIds, current } = await DB.getMyShops(u.uid);
    if (!current) { show('v-setup'); return; }
    enterShop(current);
  });
}

function enterShop(sid) {
  resetSubs();
  shopId = sid;
  unsubShop = DB.watchShop(sid, s => {
    shop = s;
    const me = s.members && s.members[user.uid];
    myName = (me && me.name) || (user.email || '').split('@')[0];
    $('shop-name').textContent = s.name;
    $('user-name').textContent = myName + (s.owner === user.uid ? '（店主）' : '');
    renderShopPane();
    show('v-main');
  }, e => {
    if (e && e.code === 'not-found') { show('v-setup'); toast('这家店铺不存在或你已被移出'); }
    else toast('店铺数据加载失败，请检查网络');
  });
  unsubRec = DB.watchRecords(sid, (map) => {
    records = map;
    renderRecordPane();
    renderSummary();
  }, () => toast('记账数据加载失败，请检查网络'));
}

// ---------- 登录 ----------
$('btn-login').onclick = async () => {
  errBox('login-err');
  try { await DB.loginEmail($('login-email').value, $('login-pw').value); }
  catch (e) { errBox('login-err', loginErrMsg(e)); }
};
$('btn-register').onclick = async () => {
  errBox('login-err');
  const em = $('login-email').value.trim(), pw = $('login-pw').value;
  if (!em || pw.length < 6) { errBox('login-err', '邮箱和至少6位密码都要填'); return; }
  try { await DB.registerEmail(em, pw); toast('注册成功'); }
  catch (e) { errBox('login-err', loginErrMsg(e)); }
};
$('btn-google').onclick = async () => {
  errBox('login-err');
  try { await DB.loginGoogle(); }
  catch (e) { errBox('login-err', loginErrMsg(e)); }
};
function loginErrMsg(e) {
  const c = e.code || '';
  if (c.includes('user-not-found') || c.includes('wrong-password') || c.includes('invalid-credential')) return '邮箱或密码不对';
  if (c.includes('email-already-in-use')) return '这个邮箱已经注册过，直接登录就行';
  if (c.includes('invalid-email')) return '邮箱格式不对';
  if (c.includes('unauthorized-domain')) return '这个网址还没加到 Firebase 的授权域名里（见 README）';
  if (c.includes('network')) return '网络有问题，重试一下';
  return '登录失败：' + (e.message || e.code);
}

// ---------- 建店 / 加入 ----------
$('tab-create').onclick = () => { $('tab-create').classList.add('active'); $('tab-join').classList.remove('active'); $('pane-create').hidden = false; $('pane-join').hidden = true; };
$('tab-join').onclick = () => { $('tab-join').classList.add('active'); $('tab-create').classList.remove('active'); $('pane-join').hidden = false; $('pane-create').hidden = true; };
$('btn-create').onclick = async () => {
  errBox('setup-err');
  const sn = $('setup-shopname').value.trim(), mn = $('setup-myname').value.trim();
  if (!sn || !mn) { errBox('setup-err', '店铺名称和你的名字都要填'); return; }
  try { const sid = await DB.createShop(user.uid, sn, mn); enterShop(sid); }
  catch (e) { errBox('setup-err', '创建失败：' + (e.message || e.code)); }
};
$('btn-join').onclick = async () => {
  errBox('setup-err');
  const code = $('setup-code').value.trim(), mn = $('setup-myname2').value.trim();
  if (!code || !mn) { errBox('setup-err', '邀请码和你的名字都要填'); return; }
  try { const sid = await DB.joinShop(user.uid, code, mn); enterShop(sid); }
  catch (e) { errBox('setup-err', e.message || '加入失败'); }
};
$('btn-logout1').onclick = () => DB.logout();
$('btn-logout2').onclick = () => { if (confirm('退出登录？')) DB.logout(); };

// ---------- 主界面 tabs ----------
function mainTab(name) {
  ['record', 'summary', 'shop'].forEach(t => {
    $('mtab-' + t).classList.toggle('active', t === name);
    $('pane-' + t).hidden = t !== name;
  });
}
$('mtab-record').onclick = () => mainTab('record');
$('mtab-summary').onclick = () => mainTab('summary');
$('mtab-shop').onclick = () => mainTab('shop');

// ---------- 记账 ----------
$('rec-date').value = todayStr();
$('rec-date').onchange = renderRecordPane;
$('btn-save').onclick = async () => {
  errBox('rec-err');
  const date = $('rec-date').value;
  const cash = parseFloat($('rec-cash').value) || 0;
  const card = parseFloat($('rec-card').value) || 0;
  if (!date) { errBox('rec-err', '先选日期'); return; }
  try {
    await DB.saveRecord(shopId, date, { cash, card, note: $('rec-note').value.trim() }, { uid: user.uid, name: myName });
    toast('已保存 ' + prettyDate(date));
  } catch (e) { errBox('rec-err', '保存失败：' + (e.message || e.code)); }
};
$('btn-del').onclick = async () => {
  const date = $('rec-date').value;
  if (!confirm('确定删除 ' + prettyDate(date) + ' 的记录吗？')) return;
  try {
    await DB.deleteRecord(shopId, date, records[date], { uid: user.uid, name: myName });
    toast('已删除');
  } catch (e) { toast('删除失败'); }
};

function renderRecordPane() {
  const date = $('rec-date').value || todayStr();
  const r = records[date];
  if (r) {
    $('rec-cash').value = r.cash || '';
    $('rec-card').value = r.card || '';
    $('rec-note').value = r.note || '';
    $('btn-del').hidden = false;
    $('rec-savedby').textContent = r.by ? `最后由 ${r.by} 保存` : '';
  } else {
    if (document.activeElement !== $('rec-cash') && document.activeElement !== $('rec-card')) {
      $('rec-cash').value = ''; $('rec-card').value = '';
    }
    $('rec-note').value = '';
    $('btn-del').hidden = true;
    $('rec-savedby').textContent = '';
  }
  // 去年今日
  const ly = lastYear(date), lr = records[ly];
  const box = $('yoy-body');
  if (lr) {
    const cur = r ? r.total : 0;
    const diff = cur - lr.total;
    const pct = lr.total ? Math.round(diff / lr.total * 100) : 0;
    const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
    const txt = diff === 0 ? '持平' : `${diff > 0 ? '多' : '少'} ${money(Math.abs(diff))}（${diff > 0 ? '+' : ''}${pct}%）`;
    box.innerHTML = `<div class="muted small">${prettyDate(ly)}</div>
      <div class="yoy-big">${money(lr.total)}</div>
      <div class="small ${cls}">今天${r ? '比去年' + txt : '还没记，去年今日 ' + money(lr.total)}</div>`;
  } else {
    // 去年同月合计
    const ym = ly.slice(0, 7);
    let sum = 0, n = 0;
    Object.keys(records).forEach(k => { if (k.startsWith(ym)) { sum += records[k].total; n++; } });
    box.innerHTML = `<div class="muted small">${prettyDate(ly)}</div>
      <p class="muted">去年今日没有记录${n ? `，但${monthName(ym)}共记了 ${n} 天，合计 ${money(sum)}` : '，同月也没有记录'}。</p>`;
  }
  // 最近记录
  const keys = Object.keys(records).sort().reverse().slice(0, 10);
  $('recent-list').innerHTML = keys.length
    ? keys.map(k => {
        const x = records[k];
        return `<div class="dayrow" data-d="${k}"><div>${prettyDate(k)}${x.note ? `<div class="note">${escapeHtml(x.note)}</div>` : ''}</div><div class="amt">${money(x.total)}</div></div>`;
      }).join('')
    : '<p class="muted">还没有记录，从上面开始记第一笔吧。</p>';
  $('recent-list').querySelectorAll('.dayrow').forEach(el => {
    el.style.cursor = 'pointer';
    el.onclick = () => { $('rec-date').value = el.dataset.d; renderRecordPane(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  });
}

// ---------- 每月总结 ----------
$('sum-month').value = monthStr();
$('sum-month').onchange = renderSummary;

function monthStats(ms) {
  let total = 0, days = 0, best = 0, bestDay = '';
  const list = [];
  Object.keys(records).forEach(k => {
    if (k.startsWith(ms)) {
      const t = records[k].total;
      total += t; days++;
      if (t > best) { best = t; bestDay = k; }
      list.push({ date: k, rec: records[k] });
    }
  });
  list.sort((a, b) => b.date.localeCompare(a.date));
  return { total, days, avg: days ? total / days : 0, best, bestDay, list };
}

function renderSummary() {
  const ms = $('sum-month').value || monthStr();
  const s = monthStats(ms);
  $('sum-total').textContent = money(s.total);
  $('sum-days').textContent = s.days + ' 天';
  $('sum-avg').textContent = s.days ? money(s.avg) : '–';
  $('sum-best').textContent = s.days ? money(s.best) : '–';

  // 对比：环比上月 / 同比去年同月
  const pm = prevMonth(ms), py = (parseInt(ms.slice(0, 4)) - 1) + ms.slice(4);
  const ps = monthStats(pm), ys = monthStats(py);
  let cmp = '';
  if (ps.days) cmp += `<div>较上月（${monthName(pm)}）：${diffText(s.total, ps.total)}</div>`;
  if (ys.days) cmp += `<div>较去年同月（${monthName(py)}）：${diffText(s.total, ys.total)}</div>`;
  const curMs = monthStr();
  $('sum-compare').innerHTML = cmp || '<span class="muted">暂无可对比的月份</span>' +
    (ms === curMs ? ' <span class="muted small">（本月进行中）</span>' : '');

  // 柱状图
  const asc = s.list.slice().sort((a, b) => a.date.localeCompare(b.date));
  const max = Math.max(...asc.map(x => x.rec.total), 1);
  $('chart').innerHTML = asc.map(x =>
    `<div class="bar" style="height:${Math.max(3, x.rec.total / max * 100)}%" title="${x.date} ${money(x.rec.total)}"></div>`
  ).join('') || '<p class="muted">本月还没有记录</p>';

  // 每日明细
  $('sum-list').innerHTML = s.list.length
    ? s.list.map(x => `<div class="dayrow"><div>${prettyDate(x.date)}${x.rec.by ? `<div class="note">记账：${escapeHtml(x.rec.by)}</div>` : ''}${x.rec.note ? `<div class="note">${escapeHtml(x.rec.note)}</div>` : ''}</div><div class="amt">${money(x.rec.total)}</div></div>`).join('')
    : '<p class="muted">本月还没有记录</p>';
}

function diffText(cur, base) {
  if (!base) return '<span class="muted">基数无记录</span>';
  const d = cur - base, pct = Math.round(d / base * 100);
  if (d === 0) return '持平';
  return `<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '多' : '少'} ${money(Math.abs(d))}（${d > 0 ? '+' : ''}${pct}%）</span>`;
}

// ---------- 店铺 ----------
$('btn-copycode').onclick = async () => {
  const c = $('shop-code').textContent;
  try { await navigator.clipboard.writeText(c); toast('邀请码已复制'); }
  catch (e) { toast('复制失败，长按手动复制'); }
};
$('btn-newcode').onclick = async () => {
  if (!confirm('换新的邀请码后，旧的就失效了，确定吗？')) return;
  try { await DB.resetCode(shop); toast('已换新邀请码'); }
  catch (e) { toast('操作失败'); }
};
$('btn-leave').onclick = async () => {
  if (shop.owner === user.uid) { toast('你是店主，不能直接离开（可先转让或让成员解散）'); return; }
  if (!confirm('确定离开这家店铺吗？')) return;
  try { await DB.leave(shopId, user.uid); show('v-setup'); }
  catch (e) { toast('操作失败'); }
};

async function renderShopPane() {
  if (!shop) return;
  $('shop-code').textContent = shop.code || '------';
  $('btn-newcode').hidden = shop.owner !== user.uid;
  const members = shop.members || {};
  const ids = Object.keys(members).sort((a, b) => (members[a].joinedAt || 0) - (members[b].joinedAt || 0));
  $('member-count').textContent = `共 ${ids.length} 人`;
  $('member-list').innerHTML = ids.map(uid => {
    const m = members[uid];
    const role = uid === shop.owner ? '店主' : (m.role === 'manager' ? '家人' : '店员');
    const kickBtn = (shop.owner === user.uid && uid !== user.uid)
      ? `<button class="ghost small" data-kick="${uid}">移出</button>` : '';
    return `<div class="member"><div>${escapeHtml(m.name || '未命名')}<span class="badge">${role}</span></div><div>${kickBtn}</div></div>`;
  }).join('');
  $('member-list').querySelectorAll('[data-kick]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('确定把这个人移出店铺吗？')) return;
      try { await DB.kick(shopId, b.dataset.kick); toast('已移出'); }
      catch (e) { toast('操作失败'); }
    };
  });
  // 多店铺切换
  const { shopIds } = await DB.getMyShops(user.uid);
  if (shopIds.length > 1) {
    $('card-shops').hidden = false;
    const names = {};
    await Promise.all(shopIds.map(async sid => {
      try {
        const s = await DB.getShop(sid);
        names[sid] = s ? s.name : sid;
      } catch (e) { names[sid] = sid; }
    }));
    $('shop-list').innerHTML = shopIds.map(sid =>
      `<div class="dayrow"><div>${escapeHtml(names[sid])}${sid === shopId ? ' <span class="badge">当前</span>' : ''}</div>
       ${sid === shopId ? '' : `<button class="ghost small" data-sw="${sid}">切换</button>`}</div>`
    ).join('');
    $('shop-list').querySelectorAll('[data-sw]').forEach(b => {
      b.onclick = async () => { await DB.setCurrent(user.uid, b.dataset.sw); enterShop(b.dataset.sw); };
    });
  } else {
    $('card-shops').hidden = true;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

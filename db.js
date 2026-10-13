// Firebase 数据层：登录、店铺、营业额记录（实时同步 + 离线缓存）、操作记录
// 数据模型与 dianpu-rizhang 完全一致，可直接复用同一套 Firestore 安全规则。
import { firebaseConfig } from './config.js?v=20261013b';
import {
  initializeApp,
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, getDoc, getDocFromServer, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch,
  arrayUnion, arrayRemove, deleteField, serverTimestamp,
  query, where, orderBy, limit,
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from './firebase.js?v=20261013b';

let db, auth;

export function configured() {
  return firebaseConfig && firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith('在这里');
}

export function init() {
  const app = initializeApp(firebaseConfig);
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (e) {
    db = initializeFirestore(app, {});
  }
  auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver
  });
  getRedirectResult(auth).catch(() => {});
}

// ---------- 登录 ----------
export function onUser(cb) { return onAuthStateChanged(auth, cb); }
export async function loginGoogle() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  try { await signInWithPopup(auth, p); }
  catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, p);
    else throw e;
  }
}
export const loginEmail = (email, pw) => signInWithEmailAndPassword(auth, email.trim(), pw);
export const registerEmail = (email, pw) => createUserWithEmailAndPassword(auth, email.trim(), pw);
export const logout = () => signOut(auth);

// ---------- 我的店铺 ----------
// users/{uid} = { shopIds: [...], current: '店铺ID' }
export async function getMyShops(uid) {
  const s = await getDoc(doc(db, 'users', uid));
  if (!s.exists()) return { shopIds: [], current: null };
  const d = s.data();
  const ids = d.shopIds || (d.shopId ? [d.shopId] : []);
  const current = ids.includes(d.current) ? d.current : ids[0] || null;
  return { shopIds: ids, current };
}
export function setCurrent(uid, sid) {
  return setDoc(doc(db, 'users', uid), { shopIds: arrayUnion(sid), current: sid }, { merge: true });
}

// ---------- 店铺 ----------
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode() {
  let s = '';
  const r = crypto.getRandomValues(new Uint32Array(6));
  for (let i = 0; i < 6; i++) s += CODE_CHARS[r[i] % CODE_CHARS.length];
  return s;
}
async function freeCode() {
  for (let i = 0; i < 10; i++) {
    const c = genCode();
    if (!(await getDocFromServer(doc(db, 'codes', c))).exists()) return c;
  }
  throw new Error('生成邀请码失败，请重试');
}

export async function createShop(uid, shopName, myName) {
  const shopRef = doc(collection(db, 'shops'));
  const code = await freeCode();
  const b = writeBatch(db);
  b.set(shopRef, {
    name: shopName, code, owner: uid, memberIds: [uid],
    members: { [uid]: { name: myName, joinedAt: Date.now(), role: 'owner' } },
    createdAt: serverTimestamp()
  });
  b.set(doc(db, 'codes', code), { shopId: shopRef.id });
  b.set(doc(db, 'users', uid), { shopIds: arrayUnion(shopRef.id), current: shopRef.id }, { merge: true });
  await b.commit();
  return shopRef.id;
}

export async function joinShop(uid, code, myName) {
  code = code.trim().toUpperCase();
  const c = await getDocFromServer(doc(db, 'codes', code));
  if (!c.exists()) throw new Error('邀请码不对');
  const shopId = c.data().shopId;
  await updateDoc(doc(db, 'shops', shopId), {
    memberIds: arrayUnion(uid),
    ['members.' + uid]: { name: myName, joinedAt: Date.now(), role: 'staff' },
    joinedWith: code
  });
  await setCurrent(uid, shopId);
  return shopId;
}

export function watchShop(shopId, cb, onErr) {
  return onSnapshot(doc(db, 'shops', shopId), s => {
    if (!s.exists()) {
      if (s.metadata.fromCache) return;
      onErr({ code: 'not-found' }); return;
    }
    cb(Object.assign({ id: s.id }, s.data()));
  }, onErr);
}

export function getShop(shopId) {
  return getDoc(doc(db, 'shops', shopId)).then(s => s.exists() ? Object.assign({ id: s.id }, s.data()) : null);
}

export async function resetCode(shop) {
  const code = await freeCode();
  const b = writeBatch(db);
  b.delete(doc(db, 'codes', shop.code));
  b.set(doc(db, 'codes', code), { shopId: shop.id });
  b.update(doc(db, 'shops', shop.id), { code });
  await b.commit();
}
export const renameShop = (shopId, name) => updateDoc(doc(db, 'shops', shopId), { name });
export const kick = (shopId, uid) =>
  updateDoc(doc(db, 'shops', shopId), { memberIds: arrayRemove(uid), ['members.' + uid]: deleteField() });
export async function leave(shopId, uid) {
  await updateDoc(doc(db, 'shops', shopId), { memberIds: arrayRemove(uid), ['members.' + uid]: deleteField() });
  await setDoc(doc(db, 'users', uid), { shopIds: arrayRemove(shopId) }, { merge: true }).catch(() => {});
}

// ---------- 营业额记录 ----------
// shops/{shopId}/records/{yyyy-mm-dd} = { cash, card, note, by, updatedAt }
function toRec(x) {
  const total = (x.cash || 0) + (x.card || 0);
  return {
    cash: x.cash || 0, card: x.card || 0, total,
    note: x.note || '', by: x.by || '',
    at: x.updatedAt && x.updatedAt.toMillis ? x.updatedAt.toMillis() : Date.now()
  };
}

export function watchRecords(shopId, cb, onErr) {
  return onSnapshot(collection(db, 'shops', shopId, 'records'), { includeMetadataChanges: true }, snap => {
    const map = {};
    snap.forEach(d => { map[d.id] = toRec(d.data()); });
    cb(map, { pending: snap.metadata.hasPendingWrites, fromCache: snap.metadata.fromCache });
  }, onErr);
}

function logEntry(b, shopId, date, action, rec, me) {
  b.set(doc(collection(db, 'shops', shopId, 'logs')), {
    date, action, cash: rec.cash || 0, card: rec.card || 0, note: rec.note || '',
    by: me.name || '', uid: me.uid, at: serverTimestamp()
  });
}
export function saveRecord(shopId, date, rec, me) {
  const b = writeBatch(db);
  b.set(doc(db, 'shops', shopId, 'records', date), {
    cash: rec.cash, card: rec.card, note: rec.note || '', by: me.name || '', updatedAt: serverTimestamp()
  });
  logEntry(b, shopId, date, 'save', rec, me);
  return b.commit();
}
export function deleteRecord(shopId, date, old, me) {
  const b = writeBatch(db);
  b.delete(doc(db, 'shops', shopId, 'records', date));
  logEntry(b, shopId, date, 'delete', old || {}, me);
  return b.commit();
}

function toLog(d) {
  const x = d.data();
  return Object.assign({ id: d.id }, x, { at: x.at && x.at.toMillis ? x.at.toMillis() : Date.now() });
}
export function watchRecentLogs(shopId, n, cb) {
  return onSnapshot(query(collection(db, 'shops', shopId, 'logs'), orderBy('at', 'desc'), limit(n)),
    s => cb(s.docs.map(toLog)), () => cb([]));
}

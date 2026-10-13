// Firebase SDK（CDN 模块化引入，无需打包）
const V = '10.12.2';
const APP = `https://www.gstatic.com/firebasejs/${V}/firebase-app.js`;
const FS = `https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`;
const AU = `https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`;

export { initializeApp } from APP;
export {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, getDoc, getDocFromServer, setDoc, updateDoc, deleteDoc,
  onSnapshot, writeBatch, arrayUnion, arrayRemove, deleteField, serverTimestamp,
  query, where, orderBy, limit
} from FS;
export {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence,
  browserPopupRedirectResolver, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut, onAuthStateChanged
} from AU;

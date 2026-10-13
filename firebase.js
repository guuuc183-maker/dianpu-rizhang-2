// Firebase SDK（CDN 模块化引入，无需打包）
export { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
export {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, getDoc, getDocFromServer, setDoc, updateDoc, deleteDoc,
  onSnapshot, writeBatch, arrayUnion, arrayRemove, deleteField, serverTimestamp,
  query, where, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
export {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence,
  browserPopupRedirectResolver, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

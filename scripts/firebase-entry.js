// Bundled into www/vendor/firebase.js (global `FB`) by `npm run build:firebase`.
export { initializeApp } from "firebase/app";
export {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
} from "firebase/auth";
export {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  doc, collection, onSnapshot, setDoc, getDoc, getDocs, getDocsFromServer, waitForPendingWrites,
} from "firebase/firestore";

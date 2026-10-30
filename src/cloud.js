// Cuenta + sincronización con Firebase (Auth + Firestore). Un documento por usuario: users/{uid}.
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut as fbSignOut, sendPasswordResetEmail
} from 'firebase/auth';
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, setDoc, onSnapshot
} from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.js';

export const cloudConfigured = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);

let auth = null;
let db = null;
let unsub = null;
let currentUid = null;

export function initCloud({ onUser, onRemote, onError }) {
  if (!cloudConfigured) return false;
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (e) {
    db = getFirestore(app);
  }

  onAuthStateChanged(auth, (user) => {
    if (unsub) { unsub(); unsub = null; }
    currentUid = user ? user.uid : null;
    onUser(user ? { uid: user.uid, email: user.email } : null);
    if (user) {
      unsub = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => onRemote(snap.exists() ? snap.data() : null, snap.metadata.hasPendingWrites),
        (err) => onError && onError(err)
      );
    }
  });
  return true;
}

export const signIn = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
export const signUp = (email, pass) => createUserWithEmailAndPassword(auth, email, pass);
export const signOut = () => fbSignOut(auth);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

export function pushState(payload) {
  if (!db || !currentUid) return Promise.resolve();
  return setDoc(doc(db, 'users', currentUid), payload);
}

export function friendlyError(e) {
  const code = (e && e.code) || '';
  const map = {
    'auth/invalid-email': 'Ese correo no parece válido.',
    'auth/missing-password': 'Escribe tu contraseña.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.',
    'auth/email-already-in-use': 'Ese correo ya tiene cuenta. Prueba "Entrar".',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/network-request-failed': 'Sin internet. Inténtalo de nuevo cuando tengas conexión.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'auth/operation-not-allowed': 'Falta activar "Correo/contraseña" en Firebase (ver LEEME.md).'
  };
  return map[code] || 'No se pudo completar la acción. ' + (code ? `(${code})` : '');
}

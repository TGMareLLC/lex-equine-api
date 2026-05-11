import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  browserLocalPersistence
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB-lGzMVpAusPHk7HCVX1Zb2RHQhsrVRU4",
  authDomain: "equine-app-w0tjlp.firebaseapp.com",
  projectId: "equine-app-w0tjlp",
  storageBucket: "equine-app-w0tjlp.firebasestorage.app",
  messagingSenderId: "10341379913",
  appId: "1:10341379913:web:662eb40c27af9bef9d3498",
};

const app = initializeApp(firebaseConfig);

// 🔥 FIX FOR CAPACITOR / iOS LOGIN HANG
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
});

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager(),
  }),
});
export const storage = getStorage(app);
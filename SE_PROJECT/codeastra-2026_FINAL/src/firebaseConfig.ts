// src/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBnCZHeEvoduVLzQbbzFgkH4OqLOD9CgRI", // Paste your config here
  authDomain: "codeastra2026-web.firebaseapp.com",
  projectId: "codeastra2026-web",
  storageBucket: "codeastra2026-web.firebasestorage.app",
  messagingSenderId: "260944711740",
  appId: "1:260944711740:web:2821f459423c5cc6fef339"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Development helper: expose `auth` to window for quick Console sign-out / inspection
if (process.env.NODE_ENV === 'development') {
  try {
    // @ts-ignore
    (window as any).__firebaseAuth = auth;
  } catch (e) {
    // ignore in non-browser environments
  }
}

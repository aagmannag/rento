"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const fallbackFirebaseConfig = {
  apiKey: "AIzaSyCMWfOg9lqpKgWheF7unkqPEZLO7-N--7c",
  authDomain: "rento-aaa34.firebaseapp.com",
  projectId: "rento-aaa34",
  storageBucket: "rento-aaa34.firebasestorage.app",
  messagingSenderId: "423547088829",
  appId: "1:423547088829:web:c08bb5f18cf931544b2cd4",
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? fallbackFirebaseConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? fallbackFirebaseConfig.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? fallbackFirebaseConfig.projectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? fallbackFirebaseConfig.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? fallbackFirebaseConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? fallbackFirebaseConfig.appId,
};

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.appId) {
  throw new Error(
    "Firebase client config is missing. Set NEXT_PUBLIC_FIREBASE_API_KEY, " +
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, and " +
      "NEXT_PUBLIC_FIREBASE_APP_ID in .env.local (see .env.local.example)."
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

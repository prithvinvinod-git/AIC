"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

function publicEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing Firebase configuration: ${name}`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: publicEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: publicEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: publicEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  messagingSenderId: publicEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: publicEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

export function getApp(): FirebaseApp {
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return app;
}

export function getClientAuth(): Auth {
  if (!auth) {
    auth = getAuth(getApp());
    // localStorage-backed sessions survive PWA restarts and Android killing
    // the process from Recents. Different tabs still share the same user.
    void setPersistence(auth, browserLocalPersistence);
  }
  return auth;
}

export function getClientDb(): Firestore {
  if (!db) {
    db = getFirestore(getApp());
  }
  return db;
}

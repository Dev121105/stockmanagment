// app/lib/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

// Define a default, generic Firebase configuration.
// IMPORTANT: These values are now taken from your previous successful Firebase initialization.
// If you are setting up a new project or these values change, you MUST update them here.
const defaultFirebaseConfig = {
  apiKey: "AIzaSyCW0fO8LTXDrAYx1BYWq_mD9mDCZAenwzQ",
  authDomain: "stockflow-a9daa.firebaseapp.com",
  projectId: "stockflow-a9daa",
  storageBucket: "stockflow-a9daa.firebasestorage.app",
  messagingSenderId: "582314743782",
  appId: "1:582314743782:web:abfab8acd18484858c2827",
  measurementId: "G-QF2TE0D6QL"
};

// Firebase configuration is provided by the Canvas environment as a global variable.
// We parse it from a JSON string. If not defined (e.g., outside Canvas), use the default fallback.
const firebaseConfig = (() => {
  let config = {};
  // Safely check if __firebase_config is defined before logging or using it
  const canvasConfigExists = typeof __firebase_config !== 'undefined';
  console.log("Firebase: Checking __firebase_config:", canvasConfigExists ? typeof __firebase_config : 'undefined', canvasConfigExists ? __firebase_config : 'not defined'); 

  if (canvasConfigExists && typeof __firebase_config === 'string' && __firebase_config.trim() !== '') {
    try {
      config = JSON.parse(__firebase_config);
      console.log("Firebase: Successfully parsed __firebase_config.");
    } catch (e) {
      console.error("Firebase config: Failed to parse __firebase_config JSON. Using default config.", e);
      config = defaultFirebaseConfig; // Fallback to default if parsing fails
    }
  } else {
    console.warn("Firebase config: __firebase_config is not defined or is empty. Using default config. This might cause issues if running outside Canvas.");
    config = defaultFirebaseConfig; // Fallback to default if __firebase_config is not present
  }

  // Ensure projectId and apiKey are present in the final config.
  // If they are still missing (e.g., default config was also incomplete), log errors.
  if (!config.projectId || config.projectId === "YOUR_PROJECT_ID") {
    console.error("Firebase config: 'projectId' is missing or is a placeholder. Please update firebase.js with your actual Firebase project ID.");
  }
  if (!config.apiKey || config.apiKey === "YOUR_FIREBASE_API_KEY") {
    console.error("Firebase config: 'apiKey' is missing or is a placeholder. Please update firebase.js with your actual Firebase API Key.");
  }
  
  return config;
})();


// Initialize Firebase
let app;
// Check if a Firebase app instance already exists to prevent re-initialization
if (!getApps().length) {
  // Always attempt to initialize with the determined firebaseConfig.
  // Firebase will throw errors if the config is truly invalid (e.g., placeholder API key).
  app = initializeApp(firebaseConfig);
  console.log("Firebase: App initialized.");
} else {
  app = getApp(); // If already initialized, use the existing app instance
  console.log("Firebase: Using existing app instance.");
}

// Get Firebase services
// These will be null if app initialization failed due to invalid config (e.g., placeholder keys)
const db = getFirestore(app);
const auth = getAuth(app);

// MANDATORY: Sign in with custom token if provided by the Canvas environment.
// Otherwise, do not sign in automatically.
async function initializeFirebaseAndAuth() {
  // Check if auth is available (i.e., app initialized successfully with a valid API key)
  if (!auth) {
    console.warn("Firebase Auth: Cannot initialize auth because Firebase Auth service is not available (likely due to invalid Firebase config).");
    return;
  }
  try {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      console.log("Firebase: Signing in with custom token...");
      await signInWithCustomToken(auth, __initial_auth_token);
      console.log("Firebase: Signed in with custom token successfully.");
    } else {
      console.log("Firebase: No custom token found. Waiting for explicit user authentication.");
      // Removed signInAnonymously to ensure login page appears first.
    }
  } catch (error) {
    console.error("Firebase Auth Error during initialization:", error);
    // Handle specific auth errors if necessary, e.g., invalid token
  }
}

export { db, auth, initializeFirebaseAndAuth };

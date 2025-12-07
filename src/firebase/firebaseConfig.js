

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

import { getFunctions, connectFunctionsEmulator } from "firebase/functions";



const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app);


// Specify region explicitly so callable functions resolve to the correct endpoint
const functions = getFunctions(app, 'us-central1');

// Connect to Functions emulator only when explicitly enabled
const useFunctionsEmulator = process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true';
if (useFunctionsEmulator) {
  console.log('Connecting to Firebase Functions Emulator...');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export { auth, googleProvider, db, storage, functions };
export default app;


  
  

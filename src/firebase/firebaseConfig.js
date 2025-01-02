import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Log environment check before config
console.log('Environment check:', {
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  currentUrl: window.location.origin
});
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Log environment check before config creation
console.log('Environment Check:', {
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  currentDomain: window.location.hostname,
  fullUrl: window.location.href
});

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Log config (without sensitive data)
console.log('Firebase Config:', {
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId
});

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize and configure Google provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
  auth_domain: firebaseConfig.authDomain // Explicitly set auth domain
});

const db = getFirestore(app);
const storage = getStorage(app);

// Log post-initialization details
console.log('Firebase Initialization Check:', {
  authDomain: auth.config.authDomain,
  currentDomain: window.location.hostname,
  isConfigured: !!app && !!auth && !!db
});

export { auth, googleProvider, db, storage };
export default app;

  
  
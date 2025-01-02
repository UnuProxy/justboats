// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider, db } from '../firebase/firebaseConfig';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';

const AuthContext = createContext({});

/**
 * Fetch admin emails from environment variables.
 * Ensure that these emails correspond to users who should have admin privileges.
 * Since role assignments are now handled via the 'approvedUsers' collection in 'userManagement.js',
 * 'adminEmails' is no longer required here and can be removed.
 */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        try {
          // Check if user already exists in 'users' collection
          const usersRef = collection(db, 'users');
          const userQuery = query(usersRef, where('email', '==', authUser.email));
          const userSnapshot = await getDocs(userQuery);

          if (!userSnapshot.empty) {
            // User exists in 'users' collection
            const userDoc = userSnapshot.docs[0];
            setUser(authUser);
            setUserRole(userDoc.data().role);
            setAuthError(null);
          } else {
            // Check if user is in 'approvedUsers' collection
            const approvedUsersRef = collection(db, 'approvedUsers');
            const approvedQuery = query(approvedUsersRef, where('email', '==', authUser.email));
            const approvedSnapshot = await getDocs(approvedQuery);

            if (approvedSnapshot.empty) {
              // No approved user, unauthorized
              await signOut(auth);
              setAuthError("Unauthorized user. Please contact the administrator for access.");
              setUser(null);
              setUserRole(null);
              setLoading(false);
              return;
            }

            // Get the approved user's data
            const approvedUser = approvedSnapshot.docs[0].data();
            const role = approvedUser.role;

            // Create 'users' document
            const userDocRef = doc(db, 'users', authUser.uid);
            await setDoc(userDocRef, {
              email: authUser.email,
              name: authUser.displayName,
              role: role,
              createdAt: new Date()
            });

            // Optionally, remove from 'approvedUsers' to prevent duplicate approvals
            const approvedUserDocRef = doc(db, 'approvedUsers', authUser.email);
            await deleteDoc(approvedUserDocRef);

            setUser(authUser);
            setUserRole(role);
            setAuthError(null);
          }
        } catch (error) {
          console.error('Error assigning role:', error);
          await signOut(auth);
          setAuthError("Failed to assign role. Please contact the administrator.");
          setUser(null);
          setUserRole(null);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    try {
      console.log('Attempting Google sign-in...');
      setAuthError(null);
      
      // Configure Google Auth Provider settings
      googleProvider.setCustomParameters({
        prompt: 'select_account',
        domain_hint: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN
      });
      
      // Log authentication attempt details
      console.log('Auth attempt details:', {
        authDomain: auth.config.authDomain,
        currentUrl: window.location.origin,
        provider: 'Google'
      });
  
      // Attempt sign in with extended error handling
      const result = await signInWithPopup(auth, googleProvider)
        .catch((popupError) => {
          console.error('Popup Error Details:', {
            code: popupError.code,
            message: popupError.message,
            email: popupError.email,
            credential: popupError.credential,
            domain: window.location.hostname
          });
          throw popupError;
        });
        
      console.log('Sign-in successful:', result.user.email);
      return { success: true };
    } catch (error) {
      console.error('Google sign-in error:', {
        code: error.code,
        message: error.message,
        domain: window.location.hostname,
        authDomain: auth.config.authDomain
      });
      
      // Set a more user-friendly error message
      let errorMessage = "Failed to sign in with Google. Please try again.";
      if (error.code === 'auth/unauthorized-domain') {
        errorMessage = "This domain is not authorized for sign-in. Please contact the administrator.";
      }
      
      setAuthError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };
}

export const useAuth = () => useContext(AuthContext);

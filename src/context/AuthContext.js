// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider, db } from '../firebase/firebaseConfig';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, increment } from 'firebase/firestore';

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
          const userDocRef = doc(db, 'users', authUser.uid);
          const userSnapshot = await getDoc(userDocRef);
          const deviceInfo = typeof navigator !== 'undefined'
            ? {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language
              }
            : {};

          if (userSnapshot.exists()) {
            const existingUser = userSnapshot.data();

            await setDoc(
              userDocRef,
              {
                lastLogin: serverTimestamp(),
                lastActive: serverTimestamp(),
                loginCount: increment(1),
                updatedAt: serverTimestamp(),
                deviceInfo
              },
              { merge: true }
            );

            setUser(authUser);
            setUserRole(existingUser.role);
            setAuthError(null);
          } else {
            const approvedUserRef = doc(db, 'approvedUsers', authUser.email);
            const approvedSnapshot = await getDoc(approvedUserRef);

            if (!approvedSnapshot.exists()) {
              await signOut(auth);
              setAuthError("Unauthorized user. Please contact the administrator for access.");
              setUser(null);
              setUserRole(null);
              setLoading(false);
              return;
            }

            const approvedUser = approvedSnapshot.data();
            const role = approvedUser.role;

            await setDoc(userDocRef, {
              email: authUser.email,
              name: authUser.displayName,
              role,
              createdAt: serverTimestamp(),
              firstLogin: serverTimestamp(),
              lastLogin: serverTimestamp(),
              lastActive: serverTimestamp(),
              loginCount: 1,
              deviceInfo
            });

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
      setAuthError(null);
      const credential = await signInWithPopup(auth, googleProvider);
      return { success: true, credential };
    } catch (error) {
      console.error('Google sign-in error:', error);
      setAuthError(error.message);
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setAuthError(null);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  const isAdmin = () => userRole === 'admin';
  const isStaff = () => userRole === 'staff';
  const isEmployee = () => userRole === 'employee';
  const isDriver = () => userRole === 'driver';

  return (
    <AuthContext.Provider value={{
      user,
      userRole,
      loginWithGoogle,
      logout,
      isAdmin,
      isStaff,
      isEmployee,
      isDriver,
      loading,
      authError,
      setAuthError
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

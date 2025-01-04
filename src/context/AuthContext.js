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
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
      return { success: true };
    } catch (error) {
      console.error('Google sign-in error:', error);
      setAuthError(error.message);
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  const isAdmin = () => userRole === 'admin';
  const isStaff = () => userRole === 'staff';

  return (
    <AuthContext.Provider value={{
      user,
      userRole,
      loginWithGoogle,
      logout,
      isAdmin,
      isStaff,
      loading,
      authError
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

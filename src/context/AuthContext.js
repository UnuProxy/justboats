import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider, db } from '../firebase/firebaseConfig';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      console.log('Auth State Changed:', authUser?.email); // Debug log
      
      if (authUser) {
        try {
          // Check if user already exists in 'users' collection
          const usersRef = collection(db, 'users');
          const userQuery = query(usersRef, where('email', '==', authUser.email));
          const userSnapshot = await getDocs(userQuery);

          console.log('User query completed:', !userSnapshot.empty); // Debug log

          if (!userSnapshot.empty) {
            // User exists in 'users' collection
            const userDoc = userSnapshot.docs[0];
            setUser(authUser);
            setUserRole(userDoc.data().role);
            setAuthError(null);
            console.log('Existing user role:', userDoc.data().role); // Debug log
          } else {
            // Check if user is in 'approvedUsers' collection
            const approvedUsersRef = collection(db, 'approvedUsers');
            const approvedQuery = query(approvedUsersRef, where('email', '==', authUser.email));
            const approvedSnapshot = await getDocs(approvedQuery);

            console.log('Approved users query completed:', !approvedSnapshot.empty); // Debug log

            if (approvedSnapshot.empty) {
              // No approved user, unauthorized
              console.log('User not approved:', authUser.email); // Debug log
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

            console.log('Creating new user with role:', role); // Debug log

            // Create 'users' document
            const userDocRef = doc(db, 'users', authUser.uid);
            await setDoc(userDocRef, {
              email: authUser.email,
              name: authUser.displayName,
              role: role,
              createdAt: new Date()
            });

            // Remove from 'approvedUsers' to prevent duplicate approvals
            const approvedUserDocRef = doc(db, 'approvedUsers', authUser.email);
            await deleteDoc(approvedUserDocRef);

            setUser(authUser);
            setUserRole(role);
            setAuthError(null);
          }
        } catch (error) {
          console.error('Error in auth state change:', error); // Debug log
          await signOut(auth);
          setAuthError("Failed to assign role. Please contact the administrator.");
          setUser(null);
          setUserRole(null);
        }
      } else {
        console.log('No authenticated user'); // Debug log
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    try {
      console.log('Attempting Google sign-in...'); // Debug log
      setAuthError(null);
      
      // Log current environment
      console.log('Current environment:', {
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        currentUrl: window.location.origin
      });

      const result = await signInWithPopup(auth, googleProvider);
      console.log('Sign-in successful:', result.user.email); // Debug log
      return { success: true };
    } catch (error) {
      console.error('Google sign-in error:', {
        code: error.code,
        message: error.message,
        credential: error.credential
      });
      setAuthError(error.message);
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      console.log('Attempting logout...'); // Debug log
      await signOut(auth);
      console.log('Logout successful'); // Debug log
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  const isAdmin = () => userRole === 'admin';
  const isStaff = () => userRole === 'staff';

  // Debug values
  console.log('Auth Context State:', {
    userEmail: user?.email,
    userRole,
    loading,
    authError
  });

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

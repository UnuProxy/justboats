// Login.js
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const Login = () => {
  const { loginWithGoogle, authError, user, userRole, loading, setAuthError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && userRole) {
      if (userRole === 'admin') {
        navigate('/user-management');
      } else {
        navigate('/');
      }
    }
  }, [user, userRole, loading, navigate]);

  const updateUserActivity = async (userId, userData) => {
    try {
      const userRef = doc(db, 'users', userId);
      
      await setDoc(userRef, {
        ...userData,
        lastLogin: serverTimestamp(),
        lastActive: serverTimestamp(),
        loginCount: (userData.loginCount || 0) + 1,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        },
        updatedAt: serverTimestamp()
      }, { merge: true });

      console.log('User activity updated successfully');
    } catch (error) {
      console.error('Error updating user activity:', error);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await loginWithGoogle();
      
      if (result.user) {
        // Check if user exists in approvedUsers collection
        const approvedUserDoc = await getDoc(doc(db, 'approvedUsers', result.user.email));
        
        if (approvedUserDoc.exists()) {
          const approvedData = approvedUserDoc.data();
          
          // Prepare user data
          const userData = {
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
            role: approvedData.role,
            createdAt: new Date(),
            // Track first login separately
            firstLogin: serverTimestamp()
          };

          // Update user data and activity
          await updateUserActivity(result.user.uid, userData);
        } else {
          // If user is not approved, delete their auth account
          await result.user.delete();
          throw new Error('Your account is not approved. Please contact an administrator.');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setAuthError(error.message);
    }
  };

  const isLoginLoading = loading && !user;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to JustBoats
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please sign in to continue
          </p>
        </div>

        {authError && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {authError}
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          className={`w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white hover:bg-gray-50 transition-colors ${
            isLoginLoading ? 'cursor-not-allowed opacity-50' : ''
          }`}
          disabled={isLoginLoading}
        >
          {isLoginLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Login;

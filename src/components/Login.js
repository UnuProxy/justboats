// Login.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { loginWithGoogle, authError, user, userRole, loading, setAuthError } = useAuth();
  const navigate = useNavigate();
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    if (!loading && user && userRole) {
      if (userRole === 'admin') {
        navigate('/user-management');
      } else {
        navigate('/');
      }
    }
  }, [user, userRole, loading, navigate]);

  const handleGoogleLogin = async () => {
    try {
      setAuthError(null);
      setAuthenticating(true);
      const result = await loginWithGoogle();

      if (!result.success && result.error) {
        console.error('Login error:', result.error);
      }
    } catch (error) {
      console.error('Login error:', error);
      setAuthError(error.message);
    } finally {
      setAuthenticating(false);
    }
  };

  const isLoginLoading = (loading && !user) || authenticating;

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
      <div className="max-w-md w-full space-y-6 p-8 app-card">
        <div className="text-center">
          <img
            src="/Nautiq.Logo03.png"
            alt="Nautiq Ibiza"
            className="w-32 h-auto mx-auto mb-6"
          />
          <h2 className="text-2xl font-semibold text-system-gray-900">
            Welcome to Nautiq Ibiza
          </h2>
          <p className="mt-2 text-[15px] text-system-gray-600">
            Please sign in to continue
          </p>
        </div>

        {authError && (
          <div className="app-badge--danger p-4 rounded-lg" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
            <div className="flex gap-3">
              <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium">
                {authError}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          className="app-button--secondary w-full"
          disabled={isLoginLoading}
        >
          {isLoginLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
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

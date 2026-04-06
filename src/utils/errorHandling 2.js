/**
 * Error Handling Utilities
 *
 * Centralized error handling with consistent user feedback
 * and optional error logging to Firestore
 */

import React from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import toast from 'react-hot-toast';

/**
 * Error types for categorization
 */
export const ErrorType = {
  NETWORK: 'network',
  FIREBASE: 'firebase',
  VALIDATION: 'validation',
  AUTH: 'auth',
  PERMISSION: 'permission',
  NOT_FOUND: 'not_found',
  UNKNOWN: 'unknown'
};

/**
 * Get user-friendly error message
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 * @returns {string} User-friendly message
 */
export const getUserFriendlyMessage = (error, context = '') => {
  const errorCode = error?.code || '';
  const errorMessage = error?.message || '';

  // Firebase errors
  if (errorCode.startsWith('auth/')) {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'User not found. Please check your email address.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in cancelled. Please try again.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized for authentication.';
      default:
        return 'Authentication error. Please try again.';
    }
  }

  if (errorCode.startsWith('permission-denied')) {
    return 'You do not have permission to perform this action.';
  }

  if (errorCode === 'unavailable') {
    return 'Network error. Please check your internet connection.';
  }

  if (errorCode === 'not-found') {
    return context ? `${context} not found.` : 'The requested resource was not found.';
  }

  // Network errors
  if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
    return 'Network error. Please check your internet connection.';
  }

  // Validation errors
  if (errorMessage.includes('required') || errorMessage.includes('invalid')) {
    return errorMessage;
  }

  // Default messages by context
  const contextMessages = {
    save: 'Failed to save. Please try again.',
    load: 'Failed to load data. Please refresh the page.',
    delete: 'Failed to delete. Please try again.',
    update: 'Failed to update. Please try again.',
    upload: 'Failed to upload file. Please try again.',
    download: 'Failed to download. Please try again.'
  };

  return contextMessages[context] || 'An error occurred. Please try again.';
};

/**
 * Determine error type from error object
 * @param {Error} error - Error object
 * @returns {string} Error type
 */
export const getErrorType = (error) => {
  const code = error?.code || '';
  const message = error?.message || '';

  if (code.startsWith('auth/')) return ErrorType.AUTH;
  if (code === 'permission-denied') return ErrorType.PERMISSION;
  if (code === 'not-found') return ErrorType.NOT_FOUND;
  if (code === 'unavailable' || message.includes('network')) return ErrorType.NETWORK;
  if (code.startsWith('firestore/') || code.startsWith('storage/')) return ErrorType.FIREBASE;
  if (message.includes('validation') || message.includes('required')) return ErrorType.VALIDATION;

  return ErrorType.UNKNOWN;
};

/**
 * Log error to Firestore (optional, for critical errors)
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 * @returns {Promise<void>}
 */
export const logErrorToFirestore = async (error, context = {}) => {
  try {
    await addDoc(collection(db, 'errorLogs'), {
      message: error.message,
      code: error.code || 'unknown',
      type: getErrorType(error),
      stack: error.stack,
      context: {
        ...context,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      },
      createdAt: serverTimestamp()
    });
  } catch (logError) {
    // Silently fail if logging fails
    console.error('Failed to log error:', logError);
  }
};

/**
 * Handle error with toast notification
 * @param {Error} error - Error object
 * @param {Object} options - Options
 * @param {string} options.context - Context where error occurred
 * @param {boolean} options.logToFirestore - Whether to log to Firestore
 * @param {Function} options.onRetry - Retry callback
 * @param {string} options.customMessage - Override default message
 */
export const handleError = (error, options = {}) => {
  const {
    context = '',
    logToFirestore = false,
    onRetry = null,
    customMessage = null
  } = options;

  console.error(`Error in ${context}:`, error);

  const message = customMessage || getUserFriendlyMessage(error, context);
  const errorType = getErrorType(error);

  // Show toast with retry option if available
  if (onRetry) {
    toast.error(
      (t) => (
        <div className="flex items-center gap-3">
          <span>{message}</span>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              onRetry();
            }}
            className="px-3 py-1 bg-white text-red-600 rounded font-medium hover:bg-gray-100"
          >
            Retry
          </button>
        </div>
      ),
      {
        duration: 6000,
        position: 'top-center'
      }
    );
  } else {
    toast.error(message, {
      duration: 5000,
      position: 'top-center'
    });
  }

  // Log to Firestore for critical errors
  if (logToFirestore && errorType !== ErrorType.VALIDATION) {
    logErrorToFirestore(error, { context, errorType });
  }
};

/**
 * Async function wrapper with error handling
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Error handling options
 * @returns {Function} Wrapped function
 */
export const withErrorHandling = (fn, options = {}) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, options);
      throw error; // Re-throw for caller to handle if needed
    }
  };
};

/**
 * Retry async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of function
 */
export const retryWithBackoff = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    onRetry = null
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (i < maxRetries - 1) {
        if (onRetry) {
          onRetry(i + 1, maxRetries);
        }

        // eslint-disable-next-line no-undef
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, maxDelay);
      }
    }
  }

  throw lastError;
};

/**
 * Validate required fields
 * @param {Object} data - Data to validate
 * @param {Array<string>} requiredFields - Field names
 * @returns {Object} Validation result
 */
export const validateRequiredFields = (data, requiredFields) => {
  const missingFields = [];

  requiredFields.forEach(field => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], data);
    if (value === undefined || value === null || value === '') {
      missingFields.push(field);
    }
  });

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missingFields.join(', ')}`
    };
  }

  return { valid: true };
};

/**
 * Safe JSON parse with error handling
 * @param {string} json - JSON string
 * @param {*} defaultValue - Default value if parse fails
 * @returns {*} Parsed value or default
 */
export const safeJSONParse = (json, defaultValue = null) => {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return defaultValue;
  }
};

/**
 * Safe async operation with loading state
 * @param {Function} operation - Async operation
 * @param {Function} setLoading - Loading state setter
 * @param {Function} setError - Error state setter
 * @param {Object} options - Error handling options
 * @returns {Promise} Operation result
 */
export const safeAsync = async (operation, setLoading, setError, options = {}) => {
  setLoading(true);
  setError(null);

  try {
    const result = await operation();
    return result;
  } catch (error) {
    setError(error);
    handleError(error, options);
    return null;
  } finally {
    setLoading(false);
  }
};

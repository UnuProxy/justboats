import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logErrorToFirestore } from '../utils/errorHandling';

/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);

    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Log to Firestore for critical errors
    if (this.props.logToFirestore !== false) {
      logErrorToFirestore(error, {
        componentStack: errorInfo.componentStack,
        context: this.props.context || 'ErrorBoundary'
      });
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            {/* Error Icon */}
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-red-100 p-3">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </div>

            {/* Error Title */}
            <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
              Something went wrong
            </h2>

            {/* Error Message */}
            <p className="text-gray-600 text-center mb-6">
              {this.props.message ||
                "We're sorry, but something unexpected happened. Please try again."}
            </p>

            {/* Error Details (only in development) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 bg-gray-50 rounded p-4 text-sm">
                <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="font-medium text-gray-700">Error:</span>
                    <pre className="mt-1 text-xs text-red-600 overflow-auto">
                      {this.state.error.toString()}
                    </pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <span className="font-medium text-gray-700">Component Stack:</span>
                      <pre className="mt-1 text-xs text-gray-600 overflow-auto max-h-40">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>

              <div className="flex gap-2">
                <button
                  onClick={this.handleGoHome}
                  className="flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>

                <button
                  onClick={this.handleReload}
                  className="flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload Page
                </button>
              </div>
            </div>

            {/* Error Count Warning */}
            {this.state.errorCount > 1 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                This error has occurred {this.state.errorCount} times.
                Consider reloading the page or returning to the home screen.
              </div>
            )}

            {/* Support Info */}
            {this.props.showSupport !== false && (
              <div className="mt-6 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
                If this problem persists, please contact support or check the
                <a
                  href="https://github.com/anthropics/claude-code/issues"
                  className="text-blue-600 hover:text-blue-700 ml-1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  issue tracker
                </a>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.defaultProps = {
  logToFirestore: true,
  showSupport: true
};

export default ErrorBoundary;

/**
 * HOC to wrap components with ErrorBoundary
 * @param {Component} Component - Component to wrap
 * @param {Object} errorBoundaryProps - ErrorBoundary props
 * @returns {Component} Wrapped component
 */
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  return function WithErrorBoundary(props) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
};

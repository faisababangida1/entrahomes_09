import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let errorDetails = null;

      try {
        if (this.state.error?.message) {
          const parsedError = JSON.parse(this.state.error.message);
          if (parsedError.error && parsedError.operationType) {
            errorMessage = "Permission Denied: You do not have access to perform this action.";
            errorDetails = parsedError;
          }
        }
      } catch (e) {
        // Not a JSON error string
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-sm border border-red-100">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-50 rounded-2xl mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-outfit font-bold text-center text-gray-900 mb-3">Something went wrong</h2>
            <p className="text-center text-gray-500 font-medium mb-8">{errorMessage}</p>
            
            {errorDetails && (
              <div className="bg-gray-50 p-5 rounded-2xl overflow-auto text-xs font-mono text-gray-600 max-h-40 mb-8 border border-gray-100">
                <p className="mb-1"><strong className="text-gray-900">Operation:</strong> {errorDetails.operationType}</p>
                <p className="mb-1"><strong className="text-gray-900">Path:</strong> {errorDetails.path}</p>
                <p><strong className="text-gray-900">Error:</strong> {errorDetails.error}</p>
              </div>
            )}
            
            <button
              onClick={() => window.location.href = '/'}
              className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-base font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    // @ts-ignore
    return (this as any).props.children;
  }
}

'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // iOS WebView에서 특정 에러들을 무시
    const ignoredErrors = [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'Script error',
      'Network request failed',
      'Application error',
      'client-side exception',
      'localhost',
      'Hydration failed',
      'Text content does not match',
      'useRouter',
      'router.push',
      'Navigation cancelled',
      'Route change aborted',
      'Module not found',
      'Dynamic import',
      'Failed to import',
      'Unexpected token',
      'SyntaxError',
      'TypeError: null is not an object',
      'TypeError: undefined is not an object',
      'ReferenceError: window is not defined',
      'ReferenceError: document is not defined',
      'Cannot read property',
      'Cannot read properties of null',
      'Cannot read properties of undefined',
      'ChunkLoadError',
      'Loading chunk',
      'Loading CSS chunk'
    ];
    
    const shouldIgnore = ignoredErrors.some(ignoredError => 
      error.message?.includes(ignoredError) || 
      error.toString().includes(ignoredError) ||
      error.stack?.includes(ignoredError)
    );
    
    if (shouldIgnore) {
      console.warn('Ignoring known iOS WebView error:', error.message);
      this.setState({ hasError: false, error: undefined });
      
      // iOS WebView에서 자동 복구 시도
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          // 현재 페이지 새로고침으로 복구
          window.location.reload();
        }
      }, 100);
      return;
    }
    
    // iOS 앱에 에러 정보 전달 (선택사항)
    if (typeof window !== 'undefined' && (window as any).webkit?.messageHandlers?.errorReport) {
      try {
        (window as any).webkit.messageHandlers.errorReport.postMessage({
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack
        });
      } catch (e) {
        console.warn('Failed to send error report to iOS app:', e);
      }
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">앱 오류가 발생했습니다</h2>
            <p className="text-gray-600 mb-6">
              일시적인 오류가 발생했습니다. 다시 시도해주세요.
            </p>
            <button
              onClick={this.resetError}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              다시 시도
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">에러 상세 정보</summary>
                <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 
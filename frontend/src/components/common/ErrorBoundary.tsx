import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // 다음 렌더링에서 폴백 UI가 보이도록 상태를 업데이트합니다.
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // 백그라운드 전환 관련 에러는 무시 (hooks 순서 변경 에러)
    if (error.message.includes('Rendered fewer hooks than expected') && 
        (document.visibilityState === 'hidden' || !document.hasFocus())) {
      console.warn('[ErrorBoundary] 백그라운드 전환 관련 hooks 에러 무시:', error.message);
      return; // 에러를 무시하고 정상 렌더링 계속
    }
    
    // 에러 보고 서비스에 에러를 기록할 수 있습니다
    console.error('[ErrorBoundary] 에러 발생:', error);
    console.error('[ErrorBoundary] 에러 정보:', errorInfo);
    
    // 햅틱 피드백 (iOS 네이티브 앱에서 동작)
    if (window.webkit?.messageHandlers?.smapIos) {
      try {
        window.webkit.messageHandlers.smapIos.postMessage({
          type: 'haptic',
          param: JSON.stringify({
            type: 'error',
            component: 'ErrorBoundary',
            context: {
              error: error.message,
              componentStack: errorInfo.componentStack
            }
          })
        });
      } catch (e) {
        console.warn('[ErrorBoundary] 햅틱 피드백 실패:', e);
      }
    }
    
    this.setState({
      error,
      errorInfo
    });
    
    // 부모로 에러 전달
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // 커스텀 폴백 UI가 있으면 사용, 없으면 기본 UI 사용
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return <DefaultErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error | null;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({ error }) => {
  const handleRetry = () => {
    // 페이지 새로고침
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-red-50 rounded-lg border border-red-200">
      <div className="text-4xl mb-4">😵</div>
      <h3 className="text-lg font-semibold text-red-800 mb-2">
        앗! 문제가 발생했습니다
      </h3>
      <p className="text-sm text-red-600 text-center mb-4 max-w-md">
        {error?.message || '예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'}
      </p>
      <button
        onClick={handleRetry}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        🔄 다시 시도
      </button>
    </div>
  );
};

// 위치 데이터 로딩 전용 에러 폴백
export const LocationDataErrorFallback: React.FC<{
  error: string;
  onRetry: () => void;
  isRetrying?: boolean;
}> = ({ error, onRetry, isRetrying = false }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6 bg-yellow-50 rounded-lg border border-yellow-200">
      <div className="text-4xl mb-4">📍</div>
      <h3 className="text-lg font-semibold text-yellow-800 mb-2">
        위치 데이터를 불러올 수 없습니다
      </h3>
      <p className="text-sm text-yellow-600 text-center mb-4 max-w-md">
        {error}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isRetrying ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              재시도 중...
            </>
          ) : (
            <>
              🔄 다시 시도
            </>
          )}
        </button>
      </div>
    </div>
  );
}; 
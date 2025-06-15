'use client';

import React, { useEffect, useRef } from 'react';

interface IOSLoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'indigo' | 'purple';
}

const IOSLoadingSpinner: React.FC<IOSLoadingSpinnerProps> = ({
  message = "로딩 중...",
  fullScreen = true,
  size = 'md',
  color = 'blue'
}) => {
  const spinnerRef = useRef<HTMLDivElement>(null);

  // iOS WebView에서 강제로 애니메이션 적용
  useEffect(() => {
    if (spinnerRef.current) {
      const element = spinnerRef.current;
      
      // 인라인 스타일로 강제 애니메이션 적용
      element.style.webkitAnimation = 'spin 1s linear infinite';
      element.style.animation = 'spin 1s linear infinite';
      element.style.webkitTransformOrigin = 'center';
      element.style.transformOrigin = 'center';
      element.style.willChange = 'transform';
      
      // iOS WebView 감지 시 추가 설정
      if ((window as any).webkit && (window as any).webkit.messageHandlers) {
        element.style.webkitTransform = 'translateZ(0)';
        element.style.transform = 'translateZ(0)';
        element.style.webkitBackfaceVisibility = 'hidden';
        element.style.backfaceVisibility = 'hidden';
      }
    }
  }, []);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return { spinner: 'w-5 h-5', text: 'text-sm' };
      case 'md': return { spinner: 'w-8 h-8', text: 'text-base' };
      case 'lg': return { spinner: 'w-12 h-12', text: 'text-lg' };
      default: return { spinner: 'w-8 h-8', text: 'text-base' };
    }
  };

  const getColorClasses = () => {
    switch (color) {
      case 'blue': return 'border-blue-600';
      case 'green': return 'border-green-600';
      case 'indigo': return 'border-indigo-600';
      case 'purple': return 'border-purple-600';
      default: return 'border-blue-600';
    }
  };

  const sizeClasses = getSizeClasses();
  const colorClasses = getColorClasses();

  const SpinnerElement = () => (
    <div className="flex flex-col items-center space-y-3">
      <div
        ref={spinnerRef}
        className={`${sizeClasses.spinner} border-4 border-gray-200 ${colorClasses} border-t-transparent rounded-full ios-animate-spin`}
        style={{
          // 인라인 스타일로 확실한 애니메이션 보장
          WebkitAnimation: 'spin 1s linear infinite',
          animation: 'spin 1s linear infinite',
          WebkitTransformOrigin: 'center',
          transformOrigin: 'center',
          willChange: 'transform'
        }}
      />
      {message && (
        <p className={`${sizeClasses.text} font-medium text-gray-700 text-center`}>
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999]">
        <div className="bg-white rounded-2xl px-8 py-6 shadow-xl border border-gray-200 max-w-xs mx-4">
          <SpinnerElement />
        </div>
      </div>
    );
  }

  return <SpinnerElement />;
};

export default IOSLoadingSpinner; 
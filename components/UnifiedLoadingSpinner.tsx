import React, { useRef, useEffect } from 'react';

interface UnifiedLoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'gray';
  message?: string;
  className?: string;
  inline?: boolean;
}

const UnifiedLoadingSpinner: React.FC<UnifiedLoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  message,
  className = '',
  inline = false
}) => {
  const spinnerRef = useRef<HTMLDivElement>(null);

  // iOS WebView 호환성을 위한 애니메이션 강제 적용
  useEffect(() => {
    if (spinnerRef.current) {
      const element = spinnerRef.current;
      
      // CSS 애니메이션 강제 적용
      element.style.animation = 'unified-spin 1s linear infinite';
      element.style.webkitAnimation = 'unified-spin 1s linear infinite';
      element.style.transformOrigin = 'center center';
      element.style.webkitTransformOrigin = 'center center';
      element.style.willChange = 'transform';
      element.style.backfaceVisibility = 'hidden';
      element.style.webkitBackfaceVisibility = 'hidden';
    }
  }, []);

  // 크기별 클래스
  const getSizeClasses = () => {
    switch (size) {
      case 'xs': return { spinner: 'w-3 h-3', border: 'border-2', text: 'text-xs' };
      case 'sm': return { spinner: 'w-4 h-4', border: 'border-2', text: 'text-sm' };
      case 'md': return { spinner: 'w-6 h-6', border: 'border-2', text: 'text-base' };
      case 'lg': return { spinner: 'w-8 h-8', border: 'border-4', text: 'text-lg' };
      case 'xl': return { spinner: 'w-12 h-12', border: 'border-4', text: 'text-xl' };
      default: return { spinner: 'w-6 h-6', border: 'border-2', text: 'text-base' };
    }
  };

  // 색상별 클래스 (브랜드 컬러 통일)
  const getColorClasses = () => {
    switch (color) {
      case 'primary': return 'border-gray-200 border-t-blue-600'; // 브랜드 블루 색상
      case 'white': return 'border-gray-300 border-t-white';
      case 'gray': return 'border-gray-300 border-t-gray-600';
      default: return 'border-gray-200 border-t-blue-600';
    }
  };

  const sizeClasses = getSizeClasses();
  const colorClasses = getColorClasses();

  const SpinnerElement = () => (
    <div
      ref={spinnerRef}
      className={`${sizeClasses.spinner} ${sizeClasses.border} ${colorClasses} rounded-full unified-animate-spin ${className}`}
      style={{
        animation: 'unified-spin 1s linear infinite',
        WebkitAnimation: 'unified-spin 1s linear infinite'
      }}
    />
  );

  if (inline) {
    return (
      <div className="inline-flex items-center gap-2">
        <SpinnerElement />
        {message && (
          <span className={`${sizeClasses.text} text-gray-600`}>
            {message}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <SpinnerElement />
      {message && (
        <p className={`${sizeClasses.text} text-gray-600 text-center`}>
          {message}
        </p>
      )}
    </div>
  );
};

export default UnifiedLoadingSpinner; 
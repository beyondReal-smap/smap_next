'use client';

import React from 'react';

interface IOSCompatibleSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  inline?: boolean;
}

// iOS WebView 호환 스피너 컴포넌트 (강화된 회전 스피너)
export default function IOSCompatibleSpinner({ 
  message = '로딩 중...', 
  size = 'md',
  fullScreen = false,
  inline = false
}: IOSCompatibleSpinnerProps) {
  const spinnerRef = React.useRef<HTMLDivElement>(null);
  const animationIdRef = React.useRef<number>();

  React.useEffect(() => {
    const spinner = spinnerRef.current;
    if (!spinner) return;
    
    let rotation = 0;
    let lastTime = 0;
    const targetFPS = 60;
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime: number) => {
      if (currentTime - lastTime >= frameInterval) {
        rotation = (rotation + 6) % 360; // 6도씩 회전으로 부드러운 애니메이션
        
        // 다중 브라우저 호환성을 위한 transform 적용
        const transformValue = `rotate(${rotation}deg)`;
        spinner.style.transform = transformValue;
        spinner.style.webkitTransform = transformValue;
        (spinner.style as any).msTransform = transformValue; // IE 호환성
        
        lastTime = currentTime;
      }
      
      animationIdRef.current = requestAnimationFrame(animate);
    };

    // CSS 애니메이션도 동시에 적용 (백업용)
    spinner.style.animation = 'continuous-spin 1s linear infinite';
    spinner.style.webkitAnimation = 'continuous-spin 1s linear infinite';
    spinner.style.transformOrigin = 'center center';
    spinner.style.webkitTransformOrigin = 'center center';
    spinner.style.willChange = 'transform';
    spinner.style.backfaceVisibility = 'hidden';
    spinner.style.webkitBackfaceVisibility = 'hidden';

    // JavaScript 애니메이션 시작
    animationIdRef.current = requestAnimationFrame(animate);

    // CSS 애니메이션 작동 여부 확인 후 JavaScript 애니메이션 조정
    setTimeout(() => {
      const computedStyle = window.getComputedStyle(spinner);
      const animationName = computedStyle.animationName;
      
      if (animationName === 'none' || !animationName) {
        console.log('[IOSCompatibleSpinner] CSS animation not working, using JavaScript fallback');
        // CSS 애니메이션이 작동하지 않으면 JavaScript 애니메이션 계속 사용
      } else {
        console.log('[IOSCompatibleSpinner] CSS animation working');
        // CSS 애니메이션이 작동해도 JavaScript 애니메이션을 백업으로 유지
      }
    }, 200);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, []);

  // 크기별 클래스
  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return { spinner: 'w-6 h-6 border-2', text: 'text-sm' };
      case 'md': return { spinner: 'w-8 h-8 border-4', text: 'text-base' };
      case 'lg': return { spinner: 'w-10 h-10 border-4', text: 'text-lg' };
      default: return { spinner: 'w-8 h-8 border-4', text: 'text-base' };
    }
  };

  const sizeClasses = getSizeClasses();

  const SpinnerElement = () => (
    <div 
      ref={spinnerRef}
      className={`${sizeClasses.spinner} border-gray-200 border-t-blue-600 rounded-full unified-animate-spin`}
      style={{
        display: 'inline-block',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        perspective: '1000px',
        WebkitPerspective: '1000px'
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

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-center mb-4">
            <SpinnerElement />
          </div>
          <p className="text-gray-600 text-sm font-medium animate-pulse">{message}</p>
        </div>
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
} 
import React, { useState, useEffect } from 'react';

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean; // 전체 화면을 덮는 로딩인지 여부
  type?: 'spinner' | 'dots' | 'pulse' | 'bounce' | 'ripple' | 'wave' | 'random-ripple'; // random-ripple 타입 추가
  size?: 'sm' | 'md' | 'lg'; // 크기 옵션 추가
  color?: 'indigo' | 'blue' | 'green' | 'purple' | 'pink' | 'yellow'; // 색상 옵션 추가
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = "Loading...", 
  fullScreen = true, 
  type = 'spinner',
  size = 'md',
  color = 'indigo'
}) => {
  // 랜덤 색상을 위한 상태
  const [randomColors, setRandomColors] = useState<string[]>(['green']); // 기본값 설정

  // 랜덤 색상 생성
  useEffect(() => {
    if (type === 'random-ripple') {
      const colors = ['green', 'purple', 'pink', 'yellow'];
      
      // 처음에만 랜덤 색상 선택하고 그대로 유지
      const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];
      const selectedColor = getRandomColor();
      console.log('Selected ripple color (fixed):', selectedColor);
      setRandomColors([selectedColor]);
    }
  }, [type]);

  // 크기 설정
  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return { container: 'h-6 w-6', text: 'text-sm' };
      case 'md': return { container: 'h-10 w-10', text: 'text-base' };
      case 'lg': return { container: 'h-16 w-16', text: 'text-xl' };
      default: return { container: 'h-10 w-10', text: 'text-base' };
    }
  };

  // 색상 설정
  const getColorClasses = () => {
    switch (color) {
      case 'indigo': return 'text-indigo-600';
      case 'blue': return 'text-blue-600';
      case 'green': return 'text-green-600';
      case 'purple': return 'text-purple-600';
      case 'pink': return 'text-pink-600';
      case 'yellow': return 'text-yellow-600';
      default: return 'text-indigo-600';
    }
  };

  // 랜덤 색상에 따른 클래스 생성
  const getRandomColorClass = (colorName: string) => {
    switch (colorName) {
      case 'green': return 'border-green-700';
      case 'purple': return 'border-purple-700';
      case 'pink': return 'border-pink-700';
      case 'yellow': return 'border-orange-600';
      default: return 'border-green-700';
    }
  };

  // 랜덤 색상에 따른 그라디언트 클래스 생성
  const getRandomGradientClass = (colorName: string) => {
    switch (colorName) {
      case 'green': return 'bg-gradient-to-r from-green-300 via-green-400 to-green-500';
      case 'purple': return 'bg-gradient-to-r from-purple-300 via-purple-400 to-purple-500';
      case 'pink': return 'bg-gradient-to-r from-pink-300 via-pink-400 to-pink-500';
      case 'yellow': return 'bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500';
      default: return 'bg-gradient-to-r from-green-300 via-green-400 to-green-500';
    }
  };

  const sizeClasses = getSizeClasses();
  const colorClasses = getColorClasses();

  // 스피너 컴포넌트들
  const SpinnerComponents = {
    // 기본 회전 스피너
    spinner: (
      <svg className={`animate-spin ${sizeClasses.container} ${colorClasses}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    ),
    
    // 점 3개 애니메이션
    dots: (
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`${size === 'sm' ? 'w-2 h-2' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} bg-current rounded-full animate-pulse ${colorClasses}`}
            style={{
              animationDelay: `${i * 0.3}s`,
              animationDuration: '1.4s'
            }}
          ></div>
        ))}
      </div>
    ),

    // 펄스 애니메이션
    pulse: (
      <div className={`${sizeClasses.container} ${colorClasses} relative`}>
        <div className="absolute inset-0 bg-current rounded-full animate-ping opacity-75"></div>
        <div className="absolute inset-2 bg-current rounded-full animate-pulse"></div>
      </div>
    ),

    // 바운스 애니메이션
    bounce: (
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`${size === 'sm' ? 'w-2 h-2' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} bg-current rounded-full animate-bounce ${colorClasses}`}
            style={{
              animationDelay: `${i * 0.1}s`
            }}
          ></div>
        ))}
      </div>
    ),

    // 리플 애니메이션
    ripple: (
      <div className={`${sizeClasses.container} relative`}>
        <div className={`absolute inset-0 border-4 border-current rounded-full animate-ping ${colorClasses} opacity-75`}></div>
        <div className={`absolute inset-1 border-4 border-current rounded-full animate-ping ${colorClasses} opacity-50`} style={{ animationDelay: '0.5s' }}></div>
      </div>
    ),

    // 웨이브 애니메이션
    wave: (
      <div className="flex items-end space-x-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`${size === 'sm' ? 'w-1' : size === 'lg' ? 'w-2' : 'w-1.5'} bg-current ${colorClasses} animate-pulse`}
            style={{
              height: `${size === 'sm' ? 16 : size === 'lg' ? 32 : 24}px`,
              animationDelay: `${i * 0.1}s`,
              animationDuration: '1s'
            }}
          ></div>
        ))}
      </div>
    ),

    // 랜덤 색상 리플 애니메이션
    'random-ripple': (
      <div className="w-20 h-20 relative overflow-hidden">
        {(() => {
          const currentColor = randomColors.length > 0 ? randomColors[0] : 'green';
          return (
            <>
              {/* 실제 ripple 효과: 중심에서 시작해서 커지면서 투명해지는 원 */}
              {[0, 1, 2].map((index) => (
                <div
                  key={`ripple-${index}-${currentColor}`}
                  className={`absolute top-1/2 left-1/2 rounded-full ${getRandomColorClass(currentColor).replace('border-', 'bg-')}`}
                  style={{
                    width: '30%',
                    height: '30%',
                    marginTop: '-15%',
                    marginLeft: '-15%',
                    animation: `rippleEffect 2s infinite ${index * 0.5}s cubic-bezier(0, 0, 0.2, 1)`,
                    transform: 'scale(0)',
                    opacity: 1,
                  }}
                ></div>
              ))}
              
              {/* 중앙 고정 점 */}
              <div 
                className={`absolute top-1/2 left-1/2 ${getRandomColorClass(currentColor).replace('border-', 'bg-')} rounded-full`}
                style={{
                  width: '20%',
                  height: '20%',
                  marginTop: '-10%',
                  marginLeft: '-10%',
                  opacity: 0.9,
                }}
              ></div>
            </>
          );
        })()}
        
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes rippleEffect {
              0% {
                transform: scale(0);
                opacity: 0.8;
              }
              100% {
                transform: scale(6);
                opacity: 0;
              }
            }
          `
        }} />
      </div>
    )
  };

  if (fullScreen) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center fixed inset-0 z-[9999]" style={{backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(1px)'}}>
        <div className="bg-white bg-opacity-90 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-xl flex flex-col items-center space-y-4 max-w-xs mx-4 border border-gray-200">
          <div className="mb-4">
            {SpinnerComponents[type]}
          </div>        
          <p className={`mt-2 ${sizeClasses.text} font-medium text-gray-900`}>{message}</p>
        </div>
      </div>
    );
  }

  // 부분 로딩 (예: 버튼 내부 또는 특정 섹션)
  return (
    <div className="flex items-center justify-center py-2">
      <div className="mr-2">
        {SpinnerComponents[type]}
      </div>
      <span className="text-sm font-medium text-gray-700">{message}</span>
    </div>
  );
};

export default LoadingSpinner; 
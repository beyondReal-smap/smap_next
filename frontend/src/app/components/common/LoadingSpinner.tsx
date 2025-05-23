import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean; // 전체 화면을 덮는 로딩인지 여부
  type?: 'spinner' | 'dots' | 'pulse' | 'bounce' | 'ripple' | 'wave'; // 스피너 타입 추가
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
    )
  };

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center fixed inset-0 z-50">
        <div className="mb-4">
          {SpinnerComponents[type]}
        </div>        
        <p className={`mt-2 ${sizeClasses.text} font-medium text-gray-700`}>{message}</p>
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
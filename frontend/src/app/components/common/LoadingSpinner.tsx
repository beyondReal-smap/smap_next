import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean; // 전체 화면을 덮는 로딩인지 여부
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = "Loading...", fullScreen = true }) => {
  if (fullScreen) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center fixed inset-0 z-50">
        <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>        
        <p className="mt-2 text-lg font-medium text-gray-700">{message}</p>
      </div>
    );
  }

  // 부분 로딩 (예: 버튼 내부 또는 특정 섹션)
  // 필요에 따라 스타일을 조정할 수 있습니다.
  return (
    <div className="flex items-center justify-center py-2"> {/* 버튼 내부 등에 적합하도록 패딩 조정 */}
      <svg className="animate-spin h-5 w-5 text-indigo-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">  {/* 아이콘 크기 및 마진 조정 */}
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span className="text-sm font-medium text-gray-700">{message}</span> {/* 텍스트 크기 조정 */}
    </div>
  );
};

export default LoadingSpinner; 
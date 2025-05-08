import React from 'react';

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}

export default function PageHeader({ title, onBack, right }: PageHeaderProps) {
  return (
    <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-12 justify-between">
          <div className="flex items-center">
            <button
              onClick={onBack}
              aria-label="뒤로 가기"
              className="p-2 mr-2 -ml-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <h1 className="text-lg font-medium text-gray-900 truncate">{title}</h1>
          </div>
          {right ? right : <div style={{ width: 60 }} />} {/* 오른쪽이 없으면 높이 맞춤용 빈 div */}
        </div>
      </div>
    </header>
  );
} 
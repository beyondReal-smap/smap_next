'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface PageContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  showBackButton?: boolean;
  showTitle?: boolean;
  showHeader?: boolean;
  onBackClick?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export default function PageContainer({
  title,
  description,
  children,
  showBackButton = true,
  showTitle = true,
  showHeader = true,
  onBackClick,
  actions,
  className = '',
}: PageContainerProps) {
  const router = useRouter();
  
  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      router.back();
    }
  };

  return (
    <div className={`animate-fadeIn ${className}`}>
      {showBackButton && (
        <button 
          onClick={handleBackClick}
          className="mb-2 inline-flex items-center text-indigo-600 hover:text-indigo-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {showHeader && (
        <div className="mb-2 flex items-start justify-between">
          <div>
            {showTitle && <h1 className="text-2xl font-bold text-gray-900">{title}</h1>}
            {description && <p className="mt-2 text-gray-600">{description}</p>}
          </div>
          {actions && (
            <div className="flex space-x-2">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
} 
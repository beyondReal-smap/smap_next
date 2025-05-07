'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: string;
  footer?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function Card({
  children,
  title,
  footer,
  className = '',
  noPadding = false,
}: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-md overflow-hidden ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b border-gray-200 sm:px-6">
          {typeof title === 'string' ? (
            <h3 className="text-lg leading-6 font-medium text-gray-900">{title}</h3>
          ) : (
            title
          )}
        </div>
      )}
      <div className={noPadding ? '' : 'p-2'}>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          {footer}
        </div>
      )}
    </div>
  );
} 
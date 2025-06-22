'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FiRefreshCw, FiAlertCircle } from 'react-icons/fi';

interface RetryButtonProps {
  onRetry: () => void;
  isRetrying?: boolean;
  error?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'card';
}

export default function RetryButton({
  onRetry,
  isRetrying = false,
  error,
  className = '',
  size = 'md',
  variant = 'button'
}: RetryButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  if (variant === 'card') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-white rounded-lg border border-red-200 p-6 text-center ${className}`}
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full">
            <FiAlertCircle className="w-6 h-6 text-red-600" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              데이터 로딩 실패
            </h3>
            {error && (
              <p className="text-sm text-gray-600 mb-4">
                {error}
              </p>
            )}
            <p className="text-sm text-gray-500">
              네트워크 상태를 확인하고 다시 시도해주세요.
            </p>
          </div>

          <motion.button
            onClick={onRetry}
            disabled={isRetrying}
            whileHover={{ scale: isRetrying ? 1 : 1.05 }}
            whileTap={{ scale: isRetrying ? 1 : 0.95 }}
            className={`
              inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg
              font-medium transition-all duration-200
              ${isRetrying 
                ? 'opacity-75 cursor-not-allowed' 
                : 'hover:bg-blue-700 active:bg-blue-800'
              }
            `}
          >
            <FiRefreshCw 
              className={`w-5 h-5 ${isRetrying ? 'animate-spin' : ''}`} 
            />
            <span>{isRetrying ? '재시도 중...' : '다시 시도'}</span>
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.button
      onClick={onRetry}
      disabled={isRetrying}
      whileHover={{ scale: isRetrying ? 1 : 1.05 }}
      whileTap={{ scale: isRetrying ? 1 : 0.95 }}
      className={`
        inline-flex items-center space-x-2 bg-blue-600 text-white rounded-lg
        font-medium transition-all duration-200
        ${sizeClasses[size]}
        ${isRetrying 
          ? 'opacity-75 cursor-not-allowed' 
          : 'hover:bg-blue-700 active:bg-blue-800'
        }
        ${className}
      `}
    >
      <FiRefreshCw 
        className={`${iconSizes[size]} ${isRetrying ? 'animate-spin' : ''}`} 
      />
      <span>{isRetrying ? '재시도 중...' : '다시 시도'}</span>
    </motion.button>
  );
} 
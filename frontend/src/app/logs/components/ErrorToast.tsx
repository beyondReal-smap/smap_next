'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiWifi, FiDatabase, FiAlertCircle, FiRefreshCw, FiX } from 'react-icons/fi';

interface ErrorToastProps {
  error: {
    type: 'network' | 'no_data' | 'unknown';
    message: string;
    retryable: boolean;
  } | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryCount?: number;
  maxRetries?: number;
  isLoading?: boolean;
  autoHide?: boolean;
  duration?: number;
}

const ErrorToast: React.FC<ErrorToastProps> = ({
  error,
  onRetry,
  onDismiss,
  retryCount = 0,
  maxRetries = 3,
  isLoading = false,
  autoHide = false,
  duration = 5000
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (error) {
      setIsVisible(true);
      
      if (autoHide && !error.retryable) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => onDismiss?.(), 300);
        }, duration);
        
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [error, autoHide, duration, onDismiss]);

  const getErrorIcon = () => {
    switch (error?.type) {
      case 'network':
        return <FiWifi className="w-5 h-5 text-red-500" />;
      case 'no_data':
        return <FiDatabase className="w-5 h-5 text-gray-500" />;
      default:
        return <FiAlertCircle className="w-5 h-5 text-orange-500" />;
    }
  };

  const getToastColor = () => {
    switch (error?.type) {
      case 'network':
        return 'border-red-200 bg-red-50 shadow-red-100';
      case 'no_data':
        return 'border-gray-200 bg-gray-50 shadow-gray-100';
      default:
        return 'border-orange-200 bg-orange-50 shadow-orange-100';
    }
  };

  const getRetryButtonColor = () => {
    switch (error?.type) {
      case 'network':
        return 'bg-red-500 hover:bg-red-600 text-white';
      case 'no_data':
        return 'bg-gray-500 hover:bg-gray-600 text-white';
      default:
        return 'bg-orange-500 hover:bg-orange-600 text-white';
    }
  };

  if (!error) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.95 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 30,
            duration: 0.4
          }}
          className="fixed top-4 left-4 right-4 z-50 mx-auto max-w-sm"
        >
          <div className={`
            p-4 rounded-xl border-2 shadow-lg backdrop-blur-sm
            ${getToastColor()}
          `}>
            <div className="flex items-start space-x-3">
              {/* 에러 아이콘 */}
              <div className="flex-shrink-0 mt-0.5">
                {getErrorIcon()}
              </div>

              {/* 에러 내용 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">
                      {error.type === 'network' && '연결 문제'}
                      {error.type === 'no_data' && '데이터 없음'}
                      {error.type === 'unknown' && '오류 발생'}
                    </h4>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {error.message}
                    </p>
                  </div>

                  {/* 닫기 버튼 */}
                  {onDismiss && (
                    <button
                      onClick={() => {
                        setIsVisible(false);
                        setTimeout(() => onDismiss(), 300);
                      }}
                      className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-gray-200/50 transition-colors"
                    >
                      <FiX className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>

                {/* 재시도 버튼 */}
                {error.retryable && onRetry && retryCount < maxRetries && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    onClick={onRetry}
                    disabled={isLoading}
                    className={`
                      mt-3 flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium
                      transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${getRetryButtonColor()}
                    `}
                  >
                    <FiRefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>
                      {isLoading ? '재시도 중...' : `다시 시도 (${retryCount}/${maxRetries})`}
                    </span>
                  </motion.button>
                )}

                {/* 최대 재시도 횟수 초과 시 */}
                {error.retryable && retryCount >= maxRetries && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mt-2"
                  >
                    <p className="text-xs text-gray-500">
                      최대 재시도 횟수를 초과했습니다.
                    </p>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ErrorToast; 
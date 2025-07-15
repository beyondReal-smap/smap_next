'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiWifi, FiDatabase, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

interface ErrorDisplayProps {
  error: {
    type: 'network' | 'no_data' | 'unknown';
    message: string;
    retryable: boolean;
  } | null;
  onRetry?: () => void;
  retryCount?: number;
  maxRetries?: number;
  isLoading?: boolean;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  retryCount = 0,
  maxRetries = 3,
  isLoading = false
}) => {
  if (!error) return null;

  const getErrorIcon = () => {
    switch (error.type) {
      case 'network':
        return <FiWifi className="w-8 h-8 text-red-500" />;
      case 'no_data':
        return <FiDatabase className="w-8 h-8 text-gray-500" />;
      default:
        return <FiAlertCircle className="w-8 h-8 text-orange-500" />;
    }
  };

  const getErrorColor = () => {
    switch (error.type) {
      case 'network':
        return 'border-red-200 bg-red-50';
      case 'no_data':
        return 'border-gray-200 bg-gray-50';
      default:
        return 'border-orange-200 bg-orange-50';
    }
  };

  const getRetryButtonColor = () => {
    switch (error.type) {
      case 'network':
        return 'bg-red-500 hover:bg-red-600 focus:ring-red-500';
      case 'no_data':
        return 'bg-gray-500 hover:bg-gray-600 focus:ring-gray-500';
      default:
        return 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-500';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`mx-4 my-4 p-6 rounded-xl border-2 ${getErrorColor()}`}
      >
        <div className="flex flex-col items-center text-center space-y-4">
          {/* 에러 아이콘 */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          >
            {getErrorIcon()}
          </motion.div>

          {/* 에러 메시지 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {error.type === 'network' && '연결 문제'}
              {error.type === 'no_data' && '데이터 없음'}
              {error.type === 'unknown' && '오류 발생'}
            </h3>
            <p className="text-sm text-gray-600 max-w-sm">
              {error.message}
            </p>
          </div>

          {/* 재시도 버튼 */}
          {error.retryable && onRetry && retryCount < maxRetries && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              onClick={onRetry}
              disabled={isLoading}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-lg text-white font-medium
                transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                ${getRetryButtonColor()}
              `}
            >
              <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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
              className="text-center space-y-2"
            >
              <p className="text-sm text-gray-500">
                최대 재시도 횟수를 초과했습니다.
              </p>
              <p className="text-xs text-gray-400">
                페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
              </p>
            </motion.div>
          )}

          {/* 재시도 불가능한 경우 */}
          {!error.retryable && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <p className="text-xs text-gray-400">
                다른 날짜를 선택하거나 다른 멤버를 확인해보세요.
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ErrorDisplay; 
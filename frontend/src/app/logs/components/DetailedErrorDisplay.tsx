'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiAlertTriangle, FiWifi, FiServer, FiClock, FiRefreshCw, FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface DetailedErrorDisplayProps {
  error: {
    type: 'network' | 'server' | 'timeout' | 'data' | 'unknown';
    message: string;
    details?: any;
    retryCount?: number;
    timestamp?: string;
  };
  onRetry?: () => void;
  onDismiss?: () => void;
}

const errorTypeConfig = {
  network: {
    icon: FiWifi,
    title: '네트워크 연결 오류',
    color: 'orange',
    bgColor: 'bg-orange-50',
    iconColor: 'text-orange-500',
    suggestions: [
      'Wi-Fi 또는 모바일 데이터 연결을 확인해주세요',
      '네트워크 신호가 약한 경우 잠시 후 다시 시도해주세요',
      '방화벽이나 프록시 설정을 확인해주세요'
    ]
  },
  server: {
    icon: FiServer,
    title: '서버 오류',
    color: 'red',
    bgColor: 'bg-red-50',
    iconColor: 'text-red-500',
    suggestions: [
      '서버에 일시적인 문제가 발생했습니다',
      '잠시 후 다시 시도해주세요',
      '문제가 계속되면 고객센터에 문의해주세요'
    ]
  },
  timeout: {
    icon: FiClock,
    title: '응답 시간 초과',
    color: 'yellow',
    bgColor: 'bg-yellow-50',
    iconColor: 'text-yellow-500',
    suggestions: [
      '서버 응답이 지연되고 있습니다',
      '네트워크 연결을 확인해주세요',
      '잠시 후 다시 시도해주세요'
    ]
  },
  data: {
    icon: FiAlertTriangle,
    title: '데이터 오류',
    color: 'blue',
    bgColor: 'bg-blue-50',
    iconColor: 'text-blue-500',
    suggestions: [
      '요청한 데이터를 찾을 수 없습니다',
      '다른 날짜나 멤버를 선택해보세요',
      '데이터가 아직 동기화되지 않았을 수 있습니다'
    ]
  },
  unknown: {
    icon: FiAlertTriangle,
    title: '알 수 없는 오류',
    color: 'gray',
    bgColor: 'bg-gray-50',
    iconColor: 'text-gray-500',
    suggestions: [
      '예상치 못한 오류가 발생했습니다',
      '페이지를 새로고침해보세요',
      '문제가 계속되면 고객센터에 문의해주세요'
    ]
  }
};

export default function DetailedErrorDisplay({ error, onRetry, onDismiss }: DetailedErrorDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = errorTypeConfig[error.type];
  const IconComponent = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`${config.bgColor} border border-${config.color}-200 rounded-xl p-6 shadow-lg max-w-md mx-auto`}
    >
      {/* 헤더 */}
      <div className="flex items-start space-x-4 mb-4">
        <div className={`p-3 ${config.bgColor} rounded-full border border-${config.color}-200`}>
          <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {config.title}
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {error.message}
          </p>
          
          {error.retryCount && error.retryCount > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              재시도 횟수: {error.retryCount}회
            </p>
          )}
        </div>
      </div>

      {/* 해결 방법 제안 */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-800 mb-2">💡 해결 방법</h4>
        <ul className="space-y-1">
          {config.suggestions.map((suggestion, index) => (
            <li key={index} className="text-xs text-gray-600 flex items-start">
              <span className="text-gray-400 mr-2">•</span>
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 기술적 세부사항 (토글) */}
      {error.details && (
        <div className="mb-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <span>기술적 세부사항</span>
            {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
          </button>
          
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 p-3 bg-white bg-opacity-60 rounded-lg border border-gray-200"
              >
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                  {typeof error.details === 'string' 
                    ? error.details 
                    : JSON.stringify(error.details, null, 2)
                  }
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 액션 버튼들 */}
      <div className="flex space-x-3">
        {onRetry && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRetry}
            className={`flex-1 bg-${config.color}-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-${config.color}-600 transition-colors flex items-center justify-center space-x-2`}
          >
            <FiRefreshCw className="w-4 h-4" />
            <span>다시 시도</span>
          </motion.button>
        )}
        
        {onDismiss && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onDismiss}
            className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            닫기
          </motion.button>
        )}
      </div>

      {/* 타임스탬프 */}
      {error.timestamp && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            발생 시간: {new Date(error.timestamp).toLocaleString('ko-KR')}
          </p>
        </div>
      )}
    </motion.div>
  );
} 
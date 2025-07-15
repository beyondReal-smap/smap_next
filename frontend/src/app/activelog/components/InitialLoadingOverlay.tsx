'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FiLoader, FiWifi, FiUsers, FiMap, FiDatabase, FiRefreshCw, FiX } from 'react-icons/fi';

interface InitialLoadingOverlayProps {
  isVisible: boolean;
  loadingStep: 'maps' | 'groups' | 'members' | 'data' | 'complete';
  progress: number;
  hasFailed: boolean;
  onRetry?: () => void;
  onSkip?: () => void;
}

const loadingSteps = {
  maps: { icon: FiMap, title: '지도 로딩', description: '네이버 지도 API를 불러오고 있어요' },
  groups: { icon: FiWifi, title: '그룹 연결', description: '그룹 정보를 가져오고 있어요' },
  members: { icon: FiUsers, title: '멤버 조회', description: '그룹 멤버 정보를 불러오고 있어요' },
  data: { icon: FiDatabase, title: '데이터 준비', description: '활동 데이터를 준비하고 있어요' },
  complete: { icon: FiUsers, title: '완료', description: '모든 준비가 완료되었어요' }
};

export default function InitialLoadingOverlay({
  isVisible,
  loadingStep,
  progress,
  hasFailed,
  onRetry,
  onSkip
}: InitialLoadingOverlayProps) {
  if (!isVisible) return null;

  const currentStep = loadingSteps[loadingStep];
  const StepIcon = currentStep.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 z-50 flex items-center justify-center"
    >
      {/* 백그라운드 패턴 */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#0113A3" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative z-10 text-center max-w-md mx-auto px-6">
        {/* 앱 로고/아이콘 */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
          className="w-20 h-20 mx-auto mb-8 rounded-2xl shadow-lg flex items-center justify-center"
          style={{ backgroundColor: '#0113A3' }}
        >
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75-6.75a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" />
            <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
          </svg>
        </motion.div>

        {/* 앱 제목 */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-gray-900 mb-2"
        >
          활동 로그
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-gray-500 mb-12"
        >
          그룹 멤버들의 활동 기록을 확인해보세요
        </motion.p>

        {hasFailed ? (
          /* 실패 상태 */
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-8 shadow-lg border border-red-100"
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <FiX className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">로딩에 실패했어요</h3>
            <p className="text-gray-500 mb-6">네트워크 연결을 확인하고 다시 시도해주세요</p>
            
            <div className="flex space-x-3">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <FiRefreshCw className="w-4 h-4" />
                  <span>다시 시도</span>
                </button>
              )}
              {onSkip && (
                <button
                  onClick={onSkip}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                >
                  건너뛰기
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          /* 정상 로딩 상태 */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100"
          >
            {/* 현재 단계 아이콘 */}
            <motion.div
              key={loadingStep}
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center"
            >
              {loadingStep === 'complete' ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              ) : (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <StepIcon className="w-8 h-8 text-blue-600" />
                </motion.div>
              )}
            </motion.div>

            {/* 단계 제목 및 설명 */}
            <motion.h3
              key={`title-${loadingStep}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-semibold text-gray-900 mb-2"
            >
              {currentStep.title}
            </motion.h3>

            <motion.p
              key={`desc-${loadingStep}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-gray-500 mb-6"
            >
              {currentStep.description}
            </motion.p>

            {/* 진행률 바 */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <motion.div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>

            <div className="text-sm text-gray-500">
              {progress}% 완료
            </div>

            {/* 로딩 도트 애니메이션 */}
            <div className="flex justify-center space-x-1 mt-6">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-blue-400 rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.7, 1, 0.7]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
} 
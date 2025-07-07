'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { RegisterStep, REGISTER_STEPS } from './types';

interface RegisterHeaderProps {
  currentStep: RegisterStep;
  onBack: () => void;
  progress: number;
}

export default function RegisterHeader({ currentStep, onBack, progress }: RegisterHeaderProps) {
  const getStepTitle = () => {
    switch (currentStep) {
      case REGISTER_STEPS.TERMS:
        return '약관 동의';
      case REGISTER_STEPS.PHONE:
        return '전화번호 인증';
      case REGISTER_STEPS.VERIFICATION:
        return '인증번호 확인';
      case REGISTER_STEPS.BASIC_INFO:
        return '기본 정보';
      case REGISTER_STEPS.PROFILE:
        return '프로필 설정';
      case REGISTER_STEPS.LOCATION:
        return '위치 설정';
      case REGISTER_STEPS.COMPLETE:
        return '가입 완료';
      default:
        return '회원가입';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case REGISTER_STEPS.TERMS:
        return '서비스 이용을 위한 약관에 동의해주세요';
      case REGISTER_STEPS.PHONE:
        return '본인 확인을 위해 전화번호를 입력해주세요';
      case REGISTER_STEPS.VERIFICATION:
        return '발송된 인증번호를 입력해주세요';
      case REGISTER_STEPS.BASIC_INFO:
        return '기본 정보를 입력해주세요';
      case REGISTER_STEPS.PROFILE:
        return '프로필 정보를 설정해주세요';
      case REGISTER_STEPS.LOCATION:
        return '위치 정보를 설정해주세요';
      case REGISTER_STEPS.COMPLETE:
        return '회원가입이 완료되었습니다';
      default:
        return '';
    }
  };

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-[99999] bg-white/95 backdrop-blur-lg shadow-xl border-b border-gray-200 register-header" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 999999,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
        minHeight: '56px',
        height: '56px',
        maxHeight: '56px',
        margin: 0,
        marginTop: 0,
        padding: 0,
        paddingTop: 0
      }}
    >
      {/* 헤더 컨텐츠 */}
      <div className="flex items-center justify-between px-4 w-full" style={{ height: '56px' }}>
        <div className="flex items-center space-x-3 h-full">
          <motion.button 
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="w-5 h-5 text-gray-700" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>
          
          <div className="min-w-0 flex flex-col justify-center">
            <h1 className="text-lg font-bold text-gray-900 truncate leading-tight">
              {getStepTitle()}
            </h1>
            {currentStep !== REGISTER_STEPS.COMPLETE && (
              <p className="text-xs text-gray-500 truncate leading-tight">
                {getStepDescription()}
              </p>
            )}
          </div>
        </div>
        
        {/* 단계 표시 */}
        {currentStep !== REGISTER_STEPS.COMPLETE && (
          <div className="flex items-center space-x-2">
            <div className="text-right">
              <span className="text-sm font-medium text-gray-900">
                {Object.values(REGISTER_STEPS).indexOf(currentStep) + 1}
              </span>
              <span className="text-sm text-gray-500">/</span>
              <span className="text-sm text-gray-500">
                6
              </span>
            </div>
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* 진행률 바 */}
      {currentStep !== REGISTER_STEPS.COMPLETE && (
        <div className="h-1 bg-gray-100">
          <motion.div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      )}
    </header>
  );
} 
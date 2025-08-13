'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// 회원가입 단계 정의
export const REGISTER_STEPS = {
  TERMS: 'terms',
  PHONE: 'phone', 
  VERIFICATION: 'verification',
  BASIC_INFO: 'basic_info',
  PROFILE: 'profile',
  COMPLETE: 'complete'
};

// 단계별 한글명 매핑
export const STEP_NAMES = {
  [REGISTER_STEPS.TERMS]: '약관 동의',
  [REGISTER_STEPS.PHONE]: '전화번호 인증',
  [REGISTER_STEPS.VERIFICATION]: '인증번호 확인',
  [REGISTER_STEPS.BASIC_INFO]: '기본 정보',
  [REGISTER_STEPS.PROFILE]: '프로필 정보',
  [REGISTER_STEPS.COMPLETE]: '가입 완료'
};

interface RegisterContextType {
  currentStep: string;
  setCurrentStep: (step: string) => void;
  getCurrentStepNumber: () => number;
  getTotalSteps: () => number;
  getStepName: (step: string) => string;
  isComplete: boolean;
  REGISTER_STEPS: typeof REGISTER_STEPS;
  // 모달 상태 관리
  birthModalOpen: boolean;
  setBirthModalOpen: (open: boolean) => void;
  hasOpenModal: () => boolean;
}

const RegisterContext = createContext<RegisterContextType | undefined>(undefined);

export function RegisterProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(REGISTER_STEPS.TERMS);
  const [birthModalOpen, setBirthModalOpen] = useState(false);

  const getCurrentStepNumber = () => {
    const steps = Object.values(REGISTER_STEPS);
    const currentIndex = steps.indexOf(currentStep);
    return currentIndex + 1;
  };

  const getTotalSteps = () => {
    // COMPLETE 단계는 제외하고 실제 진행 단계만 카운트
    return Object.values(REGISTER_STEPS).length - 1; 
  };

  const getStepName = (step: string) => {
    return STEP_NAMES[step as keyof typeof STEP_NAMES] || '';
  };

  const hasOpenModal = () => {
    return birthModalOpen;
  };

  const isComplete = currentStep === REGISTER_STEPS.COMPLETE;

  return (
    <RegisterContext.Provider value={{
      currentStep,
      setCurrentStep,
      getCurrentStepNumber,
      getTotalSteps,
      getStepName,
      isComplete,
      REGISTER_STEPS,
      birthModalOpen,
      setBirthModalOpen,
      hasOpenModal
    }}>
      {children}
    </RegisterContext.Provider>
  );
}

export function useRegisterContext() {
  const context = useContext(RegisterContext);
  if (context === undefined) {
    throw new Error('useRegisterContext must be used within a RegisterProvider');
  }
  return context;
} 
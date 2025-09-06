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
  // 소셜 로그인 관련
  isAppleLogin: boolean;
  isGoogleLogin: boolean;
  // 모달 상태 관리
  birthModalOpen: boolean;
  setBirthModalOpen: (open: boolean) => void;
  hasOpenModal: () => boolean;
}

const RegisterContext = createContext<RegisterContextType | undefined>(undefined);

export function RegisterProvider({ children }: { children: ReactNode }) {
  // URL에서 단계 정보를 읽어와서 초기 단계 설정
  const [currentStep, setCurrentStep] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const step = params.get('step');
      if (step && Object.values(REGISTER_STEPS).includes(step as any)) {
        return step;
      }
    } catch {
      // 에러 발생 시 기본값 사용
    }
    return REGISTER_STEPS.TERMS;
  });
  const [birthModalOpen, setBirthModalOpen] = useState(false);

  // 소셜 로그인 상태 감지
  const isAppleLogin = React.useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const social = params.get('social');
      return social === 'apple';
    } catch {
      return false;
    }
  }, []);

  const isGoogleLogin = React.useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const social = params.get('social');
      return social === 'google';
    } catch {
      return false;
    }
  }, []);

  const getCurrentStepNumber = () => {
    if (isAppleLogin || isGoogleLogin) {
      // 애플/구글 로그인: 약관동의 → 완료 (1단계)
      const steps = [REGISTER_STEPS.TERMS, REGISTER_STEPS.COMPLETE];
      const currentIndex = steps.indexOf(currentStep);
      return currentIndex >= 0 ? currentIndex + 1 : 1;
    } else {
      // 일반 회원가입: 모든 단계
      const steps = Object.values(REGISTER_STEPS);
      const currentIndex = steps.indexOf(currentStep);
      return currentIndex + 1;
    }
  };

  const getTotalSteps = () => {
    if (isAppleLogin || isGoogleLogin) {
      // 애플/구글 로그인: 1단계 (약관 동의만)
      return 1;
    } else {
      // 일반 회원가입: COMPLETE 단계는 제외하고 실제 진행 단계만 카운트
      return Object.values(REGISTER_STEPS).length - 1;
    }
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
      isAppleLogin,
      isGoogleLogin,
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
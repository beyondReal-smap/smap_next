'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { hapticFeedback, triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';
import { RegisterProvider, useRegisterContext } from './RegisterContext';
import { HiOutlineChevronLeft } from 'react-icons/hi2';

// Dynamic import for AnimatedHeader
const AnimatedHeader = dynamic(() => import('../../components/common/AnimatedHeader'), {
  loading: () => (
    <div className="h-14 bg-gradient-to-r from-[#0113A3] to-[#001a8a] animate-pulse" />
  ),
  ssr: false
});

// 통일된 페이지 스타일
const pageStyles = `
/* 앱 고정 레이아웃 - 전체 스크롤 비활성화 */
html, body {
  overflow: hidden !important;
  position: fixed !important;
  width: 100% !important;
  height: 100% !important;
  -webkit-overflow-scrolling: touch !important;
  touch-action: manipulation !important;
}

/* 모바일 사파리 bounce 효과 비활성화 */
body {
  overscroll-behavior: none !important;
  -webkit-overflow-scrolling: touch !important;
}

/* 스크롤바 완전히 숨기기 - 모든 브라우저 대응 */
* {
  scrollbar-width: none !important; /* Firefox */
  -ms-overflow-style: none !important; /* Internet Explorer 10+ */
}

*::-webkit-scrollbar {
  display: none !important; /* Safari and Chrome */
  width: 0 !important;
  height: 0 !important;
  background: transparent !important;
}

*::-webkit-scrollbar-track {
  display: none !important;
}

*::-webkit-scrollbar-thumb {
  display: none !important;
}

/* 모바일 앱 최적화 */
* {
  -webkit-tap-highlight-color: transparent !important;
  -webkit-touch-callout: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}

.glass-effect {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* 모바일 입력 필드 최적화 */
@media (max-width: 480px) {
  .register-input {
    font-size: 16px !important; /* iOS 줌 방지 */
  }
  .register-button {
    min-height: 44px !important; /* 터치 친화적 크기 */
  }
}

/* 키보드 올라올 때 스크롤 보장 */
.register-scroll {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* 캘린더 모달이 열릴 때 하단 버튼만 숨기기 (헤더는 유지) */
.calendar-modal-open [data-bottom-button] {
  opacity: 0 !important;
  visibility: hidden !important;
  transform: translateY(100px) !important;
  transition: all 0.3s ease-in-out !important;
}

/* 부드러운 전환을 위한 기본 스타일 */
[data-bottom-button] {
  transition: all 0.3s ease-in-out !important;
}

header {
  transition: all 0.3s ease-in-out !important;
}

/* 캘린더 모달 전체 화면 보장 */
.calendar-modal {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 99999 !important;
}

/* 캘린더 모달 배경 */
.calendar-modal-backdrop {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 99998 !important;
}
`;

function RegisterLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { getCurrentStepNumber, getTotalSteps, getStepName, currentStep, isComplete, setCurrentStep, REGISTER_STEPS, hasOpenModal, setBirthModalOpen } = useRegisterContext();
  
  // 소셜 로그인 상태 확인을 위해 registerData가 필요하지만 
  // layout에서는 직접 접근할 수 없으므로 sessionStorage에서 확인
  const isSocialLogin = React.useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('social') !== null;
  }, []);

  const handleBack = () => {
    // 뒤로가기 햅틱 피드백
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '회원가입 페이지 뒤로가기', { 
      component: 'register', 
      action: 'back-navigation' 
    });

    // 모달이 열려있으면 모달을 닫기
    if (hasOpenModal()) {
      setBirthModalOpen(false);
    }

    // 회원가입 단계별 뒤로가기 로직
    const steps = Object.values(REGISTER_STEPS);
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex > 0) {
      // 소셜 로그인 시 전화번호 인증 단계 건너뛰기
      if (isSocialLogin && currentStep === REGISTER_STEPS.BASIC_INFO) {
        setCurrentStep(REGISTER_STEPS.TERMS);
        return;
      }
      
      // 이전 단계로 이동
      const previousStep = steps[currentIndex - 1] as string;
      setCurrentStep(previousStep);
    } else {
      // 첫 번째 단계(약관 동의)에서 뒤로가기 시 로그인 페이지로
      router.push('/signin');
    }
  };

  return (
    <>
      <style jsx global>{pageStyles}</style>
      <div 
        className="fixed inset-0 overflow-hidden"
        id="register-page-container"
        style={{ 
          background: 'linear-gradient(to bottom right, #f0f9ff, #fdf4ff)',
          paddingTop: '0px',
          marginTop: '0px',
          top: '0px'
        }}
      >
        {/* 통일된 헤더 애니메이션 */}
        <AnimatedHeader 
          variant="simple"
          className="fixed top-0 left-0 right-0 z-50 glass-effect header-fixed register-header-fixed"
          style={{ 
            paddingTop: '0px',
            marginTop: '0px',
            top: '0px',
            position: 'fixed'
          }}
        >
          <div className="flex items-center justify-between h-14 px-4">
            <div className="flex items-center space-x-3">
              <motion.button 
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <HiOutlineChevronLeft className="w-5 h-5 text-gray-700" />
              </motion.button>
              <div className="flex items-center space-x-3">
                <div>
                  <h1 className="text-lg font-bold text-gray-900">회원가입</h1>
                  {!isComplete && (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-semibold" style={{color: '#0113A3'}}>
                          {getCurrentStepNumber()}
                        </span>
                        <span className="text-xs text-gray-400">/</span>
                        <span className="text-xs text-gray-500">
                          {getTotalSteps()}
                        </span>
                        <span className="text-xs text-gray-500">
                          • {getStepName(currentStep)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* 필요시 추가 버튼들을 여기에 배치 */}
            </div>
          </div>
        </AnimatedHeader>

        {/* 메인 컨텐츠 - 고정 위치 */}
        <div 
          className="absolute inset-0 overflow-hidden"
          style={{ 
            top: '56px', // 헤더 높이만큼 아래로
            left: '0',
            right: '0',
            bottom: '0'
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RegisterProvider>
      <RegisterLayoutContent>
        {children}
      </RegisterLayoutContent>
    </RegisterProvider>
  );
} 
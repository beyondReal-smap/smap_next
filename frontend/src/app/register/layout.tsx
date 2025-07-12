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
/* 전체 화면 고정 - 네이티브 앱 스타일 */
html, body {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
  -webkit-overflow-scrolling: touch !important;
  overscroll-behavior: none !important;
  touch-action: manipulation !important;
}

/* 모든 요소의 스크롤 완전 차단 */
* {
  box-sizing: border-box !important;
  -webkit-overflow-scrolling: touch !important;
  overscroll-behavior: none !important;
  -webkit-user-select: none !important;
  -webkit-touch-callout: none !important;
  -webkit-tap-highlight-color: transparent !important;
  
  /* 스크롤바 완전 제거 */
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

*::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}

/* 페이지 컨테이너 고정 */
#register-page-container {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
  z-index: 1 !important;
}

/* 헤더 고정 */
.register-header-fixed,
header.register-header-fixed {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: 100vw !important;
  height: 64px !important;
  z-index: 50 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

/* 메인 컨텐츠 고정 */
#register-main-content {
  position: fixed !important;
  top: 64px !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: calc(100vh - 64px) !important;
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
  z-index: 10 !important;
}

/* 페이지 내부 컨텐츠 영역 고정 */
.register-content-area {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  height: 100% !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
}

/* 스크롤 가능한 영역 제한 */
.register-scroll-area {
  flex: 1 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  -webkit-overflow-scrolling: touch !important;
  overscroll-behavior: contain !important;
  padding: 0 16px !important;
  max-height: 100% !important;
}

/* 하단 고정 버튼 영역 */
.register-bottom-fixed {
  position: absolute !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  z-index: 20 !important;
  flex-shrink: 0 !important;
}

/* 모바일 최적화 */
@media (max-width: 480px) {
  .register-input {
    font-size: 16px !important;
  }
  .register-button {
    min-height: 44px !important;
  }
}

/* 모바일 사파리 bounce 효과 완전 비활성화 */
body {
  position: fixed !important;
  overflow: hidden !important;
  -webkit-overflow-scrolling: touch !important;
  overscroll-behavior: none !important;
}

/* 캘린더 모달이 열릴 때 하단 버튼만 숨기기 */
.calendar-modal-open [data-bottom-button] {
  opacity: 0 !important;
  visibility: hidden !important;
  transform: translateY(100px) !important;
  transition: all 0.3s ease-in-out !important;
}

[data-bottom-button] {
  transition: all 0.3s ease-in-out !important;
}

header {
  transition: all 0.3s ease-in-out !important;
}

/* 캘린더 모달 전체 화면 */
.calendar-modal {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 99999 !important;
  overflow: hidden !important;
}

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

/* 입력 필드 포커스 시 화면 이동 방지 */
input, textarea, select {
  transform: translateZ(0) !important;
  -webkit-backface-visibility: hidden !important;
  backface-visibility: hidden !important;
}

/* 키보드 올라올 때 레이아웃 보호 */
.keyboard-open {
  height: 100vh !important;
  overflow: hidden !important;
}

/* iOS 관련 추가 최적화 */
@supports (-webkit-touch-callout: none) {
  html, body {
    position: fixed !important;
    overflow: hidden !important;
    height: 100vh !important;
    -webkit-overflow-scrolling: touch !important;
  }
  
  #register-page-container {
    height: 100vh !important;
    overflow: hidden !important;
  }
}

/* Glass Effect 스타일 */
.glass-effect {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* 약관동의 체크박스 레이아웃 보호 */
.terms-checkbox-container {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  flex-direction: row !important;
  margin: 0 !important;
  padding: 0 !important;
  top: auto !important;
  left: auto !important;
  right: auto !important;
  bottom: auto !important;
  transform: none !important;
  -webkit-transform: none !important;
}

.terms-checkbox-wrapper {
  margin-right: 16px !important;
  margin-left: 0 !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  padding: 0 !important;
  position: relative !important;
  flex-shrink: 0 !important;
  width: 20px !important;
  height: 20px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.terms-content-wrapper {
  flex: 1 !important;
  margin: 0 !important;
  padding: 0 !important;
  position: relative !important;
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

  // iOS WebView 전용 강제 스타일 적용
  React.useEffect(() => {
    // 모든 환경에서 강제 적용 (iOS 문제 해결)
    const forceRemoveTopSpacing = () => {
      // HTML, Body 강제 설정
      document.documentElement.style.setProperty('padding', '0', 'important');
      document.documentElement.style.setProperty('margin', '0', 'important');
      document.documentElement.style.setProperty('padding-top', '0', 'important');
      document.documentElement.style.setProperty('margin-top', '0', 'important');
      document.documentElement.style.setProperty('height', '100vh', 'important');
      document.documentElement.style.setProperty('overflow', 'hidden', 'important');
      document.documentElement.style.setProperty('position', 'fixed', 'important');
      document.documentElement.style.setProperty('top', '0', 'important');
      document.documentElement.style.setProperty('left', '0', 'important');
      document.documentElement.style.setProperty('width', '100vw', 'important');
      
      document.body.style.setProperty('padding', '0', 'important');
      document.body.style.setProperty('margin', '0', 'important');
      document.body.style.setProperty('padding-top', '0', 'important');
      document.body.style.setProperty('margin-top', '0', 'important');
      document.body.style.setProperty('height', '100vh', 'important');
      document.body.style.setProperty('overflow', 'hidden', 'important');
      document.body.style.setProperty('position', 'fixed', 'important');
      document.body.style.setProperty('top', '0', 'important');
      document.body.style.setProperty('left', '0', 'important');
      document.body.style.setProperty('right', '0', 'important');
      document.body.style.setProperty('bottom', '0', 'important');
      document.body.style.setProperty('width', '100vw', 'important');
      
      // 페이지 컨테이너 강제 설정
      const pageContainer = document.getElementById('register-page-container');
      if (pageContainer) {
        pageContainer.style.setProperty('padding', '0', 'important');
        pageContainer.style.setProperty('margin', '0', 'important');
        pageContainer.style.setProperty('padding-top', '0', 'important');
        pageContainer.style.setProperty('margin-top', '0', 'important');
        pageContainer.style.setProperty('top', '0', 'important');
        pageContainer.style.setProperty('position', 'fixed', 'important');
        pageContainer.style.setProperty('width', '100vw', 'important');
        pageContainer.style.setProperty('height', '100vh', 'important');
        pageContainer.style.setProperty('overflow', 'hidden', 'important');
      }
      
      // 헤더 강제 설정
      const headers = document.querySelectorAll('header, .register-header-fixed');
      headers.forEach(header => {
        (header as HTMLElement).style.setProperty('padding', '0', 'important');
        (header as HTMLElement).style.setProperty('margin', '0', 'important');
        (header as HTMLElement).style.setProperty('padding-top', '0', 'important');
        (header as HTMLElement).style.setProperty('margin-top', '0', 'important');
        (header as HTMLElement).style.setProperty('top', '0', 'important');
        (header as HTMLElement).style.setProperty('position', 'fixed', 'important');
        (header as HTMLElement).style.setProperty('z-index', '9999', 'important');
        (header as HTMLElement).style.setProperty('width', '100vw', 'important');
        (header as HTMLElement).style.setProperty('height', '64px', 'important');
      });
      
      // 메인 컨텐츠 강제 설정
      const mainContent = document.getElementById('register-main-content');
      if (mainContent) {
        mainContent.style.setProperty('top', '64px', 'important');
        mainContent.style.setProperty('position', 'fixed', 'important');
        mainContent.style.setProperty('width', '100vw', 'important');
        mainContent.style.setProperty('height', 'calc(100vh - 64px)', 'important');
        mainContent.style.setProperty('overflow', 'hidden', 'important');
      }
      
      // 스크롤 방지 강화
      document.addEventListener('touchmove', (e) => {
        // 특정 스크롤 영역이 아닌 경우 스크롤 방지
        const target = e.target as HTMLElement;
        if (!target.closest('.register-scroll-area')) {
          e.preventDefault();
        }
      }, { passive: false });
      
      // 키보드 이벤트 최적화
      const handleKeyboardShow = () => {
        document.body.classList.add('keyboard-open');
      };
      
      const handleKeyboardHide = () => {
        document.body.classList.remove('keyboard-open');
      };
      
      // iOS 키보드 감지
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        window.addEventListener('focusin', handleKeyboardShow);
        window.addEventListener('focusout', handleKeyboardHide);
      }
      
      console.log('🔧 [FORCE] Register 페이지 스크롤 방지 및 고정 레이아웃 적용 완료');
    };
    
    // 즉시 실행
    forceRemoveTopSpacing();
    
    // 100ms 후 다시 실행 (DOM 로딩 완료 후)
    setTimeout(forceRemoveTopSpacing, 100);
    
    // 500ms 후 다시 실행 (모든 스타일 로딩 완료 후)
    setTimeout(forceRemoveTopSpacing, 500);
    
    // viewport 설정
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }
    
    viewportMeta.setAttribute('content', 
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
    );
    
    // 페이지 가시성 변경 시에도 재적용
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(forceRemoveTopSpacing, 100);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // 키보드 이벤트 리스너 제거
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        window.removeEventListener('focusin', () => {});
        window.removeEventListener('focusout', () => {});
      }
    };
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
          padding: '0',
          margin: '0',
          top: '0'
        }}
      >
        {/* 통일된 헤더 애니메이션 */}
        <AnimatedHeader 
          variant="simple"
          className="fixed top-0 left-0 right-0 z-50 glass-effect header-fixed register-header-fixed"
          style={{ 
            padding: '0',
            margin: '0',
            paddingTop: '0',
            marginTop: '0',
            top: '0',
            position: 'fixed'
          }}
        >
          <div className="flex items-center justify-between w-full" style={{
            height: '64px',
            minHeight: '64px',
            padding: '0'
          }}>
            <div className="flex items-center space-x-3">
              <motion.button 
                onClick={handleBack}
                className="hover:bg-gray-100 rounded-full transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{ padding: '8px', marginLeft: '8px' }}
              >
                <HiOutlineChevronLeft className="w-5 h-5 text-gray-700" />
              </motion.button>
              <div className="flex items-center">
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
          className="register-content-area"
          style={{ 
            top: '64px', // 헤더 높이만큼 아래로
            left: '0',
            right: '0',
            bottom: '0'
          }}
          id="register-main-content"
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
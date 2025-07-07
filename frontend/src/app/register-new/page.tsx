'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import RegisterHeader from './RegisterHeader';
import RegisterForm from './RegisterForm';
import { RegisterData, RegisterStep, REGISTER_STEPS, TERMS_DATA } from './types';

export default function RegisterNewPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<RegisterStep>(REGISTER_STEPS.TERMS);
  const [registerData, setRegisterData] = useState<RegisterData>({
    mt_agree1: false,
    mt_agree2: false,
    mt_agree3: false,
    mt_agree4: false,
    mt_agree5: false,
    mt_id: '',
    mt_pwd: '',
    mt_name: '',
    mt_nickname: '',
    mt_email: '',
    mt_birth: '',
    mt_gender: null,
    mt_lat: null,
    mt_long: null,
    mt_push1: true,
    verification_code: '',
    isSocialLogin: false,
    socialProvider: '',
    socialId: ''
  });

  // 진행률 계산
  const getProgress = () => {
    const steps = Object.values(REGISTER_STEPS);
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / 6) * 100;
  };

  // 뒤로가기
  const handleBack = () => {
    const steps = Object.values(REGISTER_STEPS);
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    } else {
      router.push('/');
    }
  };

  // 모바일 대응 스타일 주입
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    const style = document.createElement('style');
    style.textContent = `
      /* 전역 여백 제거 */
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        padding-top: 0 !important;
        margin-top: 0 !important;
      }
      
      /* 헤더 강제 고정 스타일 */
      .register-header-fixed {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 99999 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        transform: none !important;
        animation: none !important;
        transition: none !important;
        min-height: 56px !important;
        height: auto !important;
        width: 100% !important;
        margin: 0 !important;
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
      
      /* 메인 콘텐츠 스크롤 보장 */
      .register-main {
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        scroll-behavior: smooth;
      }
      
      /* iOS 전용 대응 */
      ${isIOS ? `
        html, body {
          position: fixed !important;
          overflow: hidden !important;
          width: 100% !important;
          height: 100% !important;
          -webkit-overflow-scrolling: touch !important;
        }
        
        #__next {
          height: 100% !important;
          overflow: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }
        
        .register-container {
          height: 100vh !important;
          height: -webkit-fill-available !important;
          overflow: hidden !important;
        }
        
        .register-main {
          height: calc(100vh - 56px) !important;
          height: calc(-webkit-fill-available - 56px) !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          position: relative !important;
          margin-top: 72px !important;
        }
        
        /* iOS 헤더 강제 표시 - 더 강력하게 */
        header, header.register-header, [class*="register-header"] {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 999999 !important;
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          transform: translateZ(0) translateY(0) !important;
          will-change: transform !important;
          background: rgba(255, 255, 255, 0.98) !important;
          backdrop-filter: blur(10px) !important;
          height: 56px !important;
          min-height: 56px !important;
          max-height: 56px !important;
          width: 100% !important;
          margin: 0 !important;
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        
        /* iOS 헤더 내부 요소 */
        header * {
          pointer-events: auto !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
      ` : ''}
      
      /* 키보드 올라올 때 대응 */
      @media (max-height: 600px) {
        .register-content {
          padding-top: 0.5rem !important;
          padding-bottom: 0.5rem !important;
        }
      }
      
      /* 모바일 입력 필드 최적화 */
      @media (max-width: 480px) {
        .register-input {
          font-size: 16px !important; /* iOS 줌 방지 */
        }
      }
    `;
    document.head.appendChild(style);
    
    // iOS에서 헤더 강제 표시 함수
    const forceHeaderVisible = () => {
      if (isIOS) {
        // 모든 헤더 요소 찾기
        const headers = document.querySelectorAll('header, [class*="register-header"], [class*="fixed"]');
        headers.forEach(header => {
          if (header) {
            const headerEl = header as HTMLElement;
            headerEl.style.position = 'fixed';
            headerEl.style.top = '0';
            headerEl.style.left = '0';
            headerEl.style.right = '0';
            headerEl.style.zIndex = '999999';
            headerEl.style.display = 'flex';
            headerEl.style.visibility = 'visible';
            headerEl.style.opacity = '1';
            headerEl.style.transform = 'translateZ(0) translateY(0)';
            headerEl.style.willChange = 'transform';
            headerEl.style.background = 'rgba(255, 255, 255, 0.98)';
            headerEl.style.backdropFilter = 'blur(10px)';
            headerEl.style.height = '56px';
            headerEl.style.minHeight = '56px';
            headerEl.style.maxHeight = '56px';
            headerEl.style.width = '100%';
            headerEl.style.margin = '0';
            headerEl.style.marginTop = '0';
            headerEl.style.padding = '0';
            headerEl.style.paddingTop = '0';
            
            // 헤더 내부 요소들도 강제 표시
            const children = header.querySelectorAll('*');
            children.forEach(child => {
              const childEl = child as HTMLElement;
              childEl.style.visibility = 'visible';
              childEl.style.opacity = '1';
              childEl.style.pointerEvents = 'auto';
            });
          }
        });
        
        // 메인 콘텐츠 위치 조정
        const mains = document.querySelectorAll('.register-main');
        mains.forEach(main => {
          if (main) {
            const mainEl = main as HTMLElement;
            mainEl.style.marginTop = '72px';
            mainEl.style.paddingTop = '1rem';
          }
        });
      }
    };

    // iOS에서 주기적으로 헤더 상태 확인
    const intervalId = isIOS ? setInterval(forceHeaderVisible, 100) : null;
    
    // 즉시 실행
    forceHeaderVisible();
    
    // iOS 전용 이벤트 리스너
    if (isIOS) {
      const handleFocus = () => {
        setTimeout(forceHeaderVisible, 100);
      };
      
      const handleBlur = () => {
        setTimeout(forceHeaderVisible, 100);
      };
      
      const handleScroll = () => {
        forceHeaderVisible();
      };
      
      const handleResize = () => {
        setTimeout(forceHeaderVisible, 100);
      };
      
      document.addEventListener('focusin', handleFocus);
      document.addEventListener('focusout', handleBlur);
      window.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', handleResize);
      
      return () => {
        document.head.removeChild(style);
        if (intervalId) clearInterval(intervalId);
        document.removeEventListener('focusin', handleFocus);
        document.removeEventListener('focusout', handleBlur);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleResize);
      };
    }
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col relative register-container">
      {/* 헤더를 RegisterForm 바깥에서 고정 */}
      <RegisterHeader 
        currentStep={currentStep}
        onBack={handleBack}
        progress={getProgress()}
      />
      
      {/* RegisterForm */}
      <RegisterForm 
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        registerData={registerData}
        setRegisterData={setRegisterData}
      />
    </div>
  );
} 
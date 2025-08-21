"use client";

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import AnimatedHeader from '../../../../components/common/AnimatedHeader';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';
import useTermsPageState from '@/hooks/useTermsPageState';
import TermsPageLoading from '@/components/common/TermsPageLoading';

// 모바일 최적화된 CSS 애니메이션 (setting 페이지와 동일한 구조)
const pageAnimations = `
html, body {
  width: 100%;
  overflow-x: hidden;
  position: relative;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn { animation: fadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }

.glass-effect {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.setting-header {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 9999 !important;
  height: 62px !important;
  min-height: 62px !important;
  max-height: 62px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  border-bottom: 1px solid rgba(229, 231, 235, 0.8) !important;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08) !important;
  display: flex !important;
  align-items: center !important;
  transform: translateZ(0) !important;
  -webkit-transform: translateZ(0) !important;
}

.setting-header-content {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
}

.setting-back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(229, 231, 235, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
}

.setting-header-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.content-area {
  padding-top: 80px !important;
  margin-top: 0 !important;
}

.hide-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
`;

export default function MarketingTermsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbed = (searchParams?.get('embed') === '1');
  
  // 약관 페이지 상태 관리 훅 사용
  const { isVisible, isLoading, isInitialized, applyStyles } = useTermsPageState({
    pageName: 'MARKETING',
    isEmbed
  });
  
  // 페이지 로드 시 body, html 스타일 초기화 (헤더 고정을 위해 필요)
  useEffect(() => {
    document.body.setAttribute('data-page', '/setting/terms/marketing');
    document.body.classList.add('marketing-terms-page-active');
    
    // body, html 스타일 강제 초기화 (헤더 고정을 위해 필요)
    document.body.style.position = 'static';
    document.body.style.overflow = 'visible';
    document.body.style.transform = 'none';
    document.body.style.willChange = 'auto';
    document.body.style.perspective = 'none';
    document.body.style.backfaceVisibility = 'visible';
    document.documentElement.style.position = 'static';
    document.documentElement.style.overflow = 'visible';
    document.documentElement.style.transform = 'none';
    document.documentElement.style.willChange = 'auto';
    document.documentElement.style.perspective = 'none';
    document.documentElement.style.backfaceVisibility = 'visible';
    
    return () => {
      document.body.removeAttribute('data-page');
      document.body.classList.remove('marketing-terms-page-active');
    };
  }, []);
  
  // 페이지 가시성 변경 감지 및 복원
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[MARKETING] 페이지 가시성 복원 - 스타일 재적용');
        // 약간의 지연 후 스타일 재적용
        setTimeout(() => {
          applyStyles();
        }, 200);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [applyStyles]);

  const handleBack = () => {
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '마케팅 정보 수집 및 이용 동의 뒤로가기', { component: 'setting-terms', action: 'back-navigation' });
    router.push('/setting');
  };

  // 로딩 상태일 때만 로딩 화면 표시 (가시성과 초기화 상태는 무시)
  if (isLoading) {
    return (
      <TermsPageLoading 
        message="마케팅 정보 수집 및 이용 동의 로딩 중..."
        subMessage="잠시만 기다려주세요"
      />
    );
  }

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div
        className={`fixed inset-0 overflow-hidden ${isEmbed ? 'bg-white' : 'bg-gradient-to-br from-indigo-50 via-white to-purple-50 main-container'}`}
        data-page="/setting/terms/marketing"
        data-content-type="marketing-page"
        style={{
          paddingTop: '0px',
          marginTop: '0px',
          top: '0px'
        }}
      >
        {!isEmbed && (
          <AnimatedHeader variant="enhanced" className="setting-header">
            <motion.div 
              initial={{ opacity: 0, x: -40 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }} 
              className="setting-header-content motion-div"
            >
              <motion.button 
                onClick={handleBack} 
                className="setting-back-button" 
                whileHover={{ scale: 1.05 }} 
                whileTap={{ scale: 0.95 }} 
                aria-label="뒤로가기"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              <div className="setting-header-text">
                <h1 className="text-lg font-bold text-gray-900 leading-tight">마케팅 정보 수집 및 이용 동의</h1>
                <p className="text-xs text-gray-500 leading-tight">이벤트/혜택 안내를 위한 정보 수집 동의</p>
              </div>
            </motion.div>
          </AnimatedHeader>
        )}

        {/* 컨텐츠 영역 - 고정 위치 (setting 페이지와 동일한 구조) */}
        <motion.div
          initial="initial"
          animate="in"
          exit="out"
          className={`absolute inset-0 px-4 space-y-6 content-area hide-scrollbar ${isEmbed ? 'pt-6' : 'pt-20'}`}
          data-testid="marketing-terms-page-content"
          data-content-type="marketing-terms-page-content"
          style={{ 
            top: '0px',
            bottom: '0px',
            left: '0',
            right: '0',
            overflow: 'hidden',
            overflowY: 'auto',
            scrollbarWidth: 'none', /* Firefox */
            msOverflowStyle: 'none', /* IE and Edge */
          }}
        >
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn marketing-content">
            <div className="p-6 text-sm leading-relaxed max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-center">마케팅 정보 수집 및 이용 동의</h2>
              <p className="text-sm text-gray-500 mb-8 text-center">시행일: 2024-05-30</p>
              
              <div className="space-y-6 text-gray-800 leading-7">
                <p className="mb-4">
                  비욘드리얼(이하 "회사")는 고객에게 더 나은 서비스와 혜택을 제공하기 위해 마케팅 정보 수집 및 이용에 대한 동의를 요청합니다.
                </p>
                
                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">수집하는 마케팅 정보</h2>
                <p className="mb-4">
                  회사는 다음과 같은 마케팅 정보를 수집할 수 있습니다:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>이름, 연락처(전화번호, 이메일)</li>
                  <li>서비스 이용 내역 및 선호도</li>
                  <li>마케팅 캠페인 참여 이력</li>
                  <li>고객 만족도 조사 결과</li>
                </ul>
                
                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">마케팅 정보 이용 목적</h2>
                <p className="mb-4">
                  수집된 마케팅 정보는 다음 목적으로만 이용됩니다:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>신규 서비스 및 이벤트 안내</li>
                  <li>맞춤형 혜택 및 프로모션 제공</li>
                  <li>고객 만족도 향상을 위한 서비스 개선</li>
                  <li>마케팅 성과 분석 및 통계</li>
                </ul>
                
                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">동의 철회 및 거부</h2>
                <p className="mb-4">
                  고객은 언제든지 마케팅 정보 수집 및 이용에 대한 동의를 철회하거나 거부할 수 있습니다.
                </p>
                
                <div className="bg-gray-50 p-4 rounded-lg border-t-4 border-blue-500 mt-6">
                  <h4 className="font-semibold mb-2 text-sm">동의 철회 방법</h4>
                  <p className="text-xs text-gray-700">설정 {'>'}{' '}개인정보 처리방침에서 동의 철회 가능</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}



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

export default function ThirdPartyTermsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbed = (searchParams?.get('embed') === '1');
  
  // 약관 페이지 상태 관리 훅 사용
  const { isVisible, isLoading, isInitialized, applyStyles } = useTermsPageState({
    pageName: 'THIRD_PARTY',
    isEmbed
  });
  
  // 페이지 로드 시 body, html 스타일 초기화 (헤더 고정을 위해 필요)
  useEffect(() => {
    document.body.setAttribute('data-page', '/setting/terms/third-party');
    document.body.classList.add('third-party-terms-page-active');
    
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
      document.body.classList.remove('third-party-terms-page-active');
    };
  }, []);
  
  // 페이지 가시성 변경 감지 및 복원
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[THIRD_PARTY] 페이지 가시성 복원 - 스타일 재적용');
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
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '개인정보 제3자 제공 동의 뒤로가기', { component: 'setting-terms', action: 'back-navigation' });
    router.push('/setting');
  };

  // 로딩 상태일 때만 로딩 화면 표시 (가시성과 초기화 상태는 무시)
  if (isLoading) {
    return (
      <TermsPageLoading 
        message="개인정보 제3자 제공 동의 로딩 중..."
        subMessage="잠시만 기다려주세요"
      />
    );
  }

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div
        className={`fixed inset-0 overflow-hidden ${isEmbed ? 'bg-white' : 'bg-gradient-to-br from-indigo-50 via-white to-purple-50 main-container'}`}
        data-page="/setting/terms/third-party"
        data-content-type="third-party-page"
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
                <h1 className="text-lg font-bold text-gray-900 leading-tight">개인정보 제3자 제공 동의</h1>
                <p className="text-xs text-gray-500 leading-tight">제3자 제공에 대한 동의</p>
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
          data-testid="third-party-terms-page-content"
          data-content-type="third-party-terms-page-content"
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn third-party-content">
            <div className="p-6 text-sm leading-relaxed max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-center">개인정보 제3자 제공 동의</h2>
              <p className="text-sm text-gray-500 mb-8 text-center">시행일: 2024-05-30</p>
              
              <div className="space-y-6 text-gray-800 leading-7">
                <p className="mb-4">
                  비욘드리얼(이하 "회사")는 원칙적으로 이용자의 개인정보를 제1조(개인정보의 처리목적)에서 명시한 범위 내에서 처리하며, 이용자의 사전 동의 없이는 본래의 범위를 초과하여 처리하거나 제3자에게 제공하지 않습니다.
                </p>
                
                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">제3자 제공이 필요한 경우</h2>
                <p className="mb-4">
                  다음의 경우에만 개인정보를 제3자에게 제공할 수 있습니다:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>이용자가 개인정보의 수집 및 이용에 대한 동의와 별도로 제3자 제공에 사전 동의한 경우</li>
                  <li>법률규정이 있거나 법령상 의무준수를 위해 불가피한 경우</li>
                  <li>수사기관이 수사목적을 위해 관계법령이 정한 절차를 거쳐 요구하는 경우</li>
                  <li>통계작성 및 학술연구 등의 목적을 위해 필요한 경우</li>
                </ul>
                
                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">제3자 제공 시 고지사항</h2>
                <p className="mb-4">
                  개인정보를 제3자에게 제공하는 경우 다음 사항을 미리 고지합니다:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>개인정보를 제공받는 자의 성명과 연락처</li>
                  <li>제공받는 자의 개인정보 이용 목적</li>
                  <li>제공하는 개인정보의 항목</li>
                  <li>제공받는 자의 개인정보 보유 및 이용 기간</li>
                  <li>동의 거부권이 존재한다는 사실 및 동의 거부에 따른 불이익의 내용</li>
                </ul>
                
                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">동의 철회 및 거부</h2>
                <p className="mb-4">
                  이용자는 언제든지 제3자 제공에 대한 동의를 철회하거나 거부할 수 있습니다.
                </p>
                
                <div className="bg-gray-50 p-4 rounded-lg border-t-4 border-blue-500 mt-6">
                  <h4 className="font-semibold mb-2 text-sm">동의 철회 방법</h4>
                  <p className="text-xs text-gray-700">설정 {'>'} 개인정보 처리방침에서 동의 철회 가능</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}



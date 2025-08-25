"use client";

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import AnimatedHeader from '../../../../components/common/AnimatedHeader';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';
import { useAuth } from '@/contexts/AuthContext';
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

export default function PrivacyPolicyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbed = (searchParams?.get('embed') === '1');
  
  // 약관 페이지 상태 관리 훅 사용
  const { isVisible, isLoading, isInitialized, applyStyles } = useTermsPageState({
    pageName: 'PRIVACY',
    isEmbed
  });
  
  // 페이지 로드 시 body, html 스타일 초기화 (헤더 고정을 위해 필요)
  useEffect(() => {
    document.body.setAttribute('data-page', '/setting/terms/privacy');
    document.body.classList.add('privacy-policy-page-active');
    
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
      document.body.classList.remove('privacy-policy-page-active');
    };
  }, []);
  
  // 페이지 가시성 변경 감지 및 복원
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[PRIVACY] 페이지 가시성 복원 - 스타일 재적용');
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
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '개인정보 처리방침 뒤로가기', { component: 'setting-terms', action: 'back-navigation' });
    
    // 이전 페이지가 register인지 확인
    const referrer = document.referrer;
    const isFromRegister = referrer.includes('/register') || referrer.includes('register');
    
    if (isFromRegister) {
      // register 페이지에서 온 경우 register로 돌아가기
      router.push('/register');
    } else {
      // setting 페이지에서 온 경우 setting으로 돌아가기
      router.push('/setting');
    }
  };

  // 로딩 상태일 때만 로딩 화면 표시 (가시성과 초기화 상태는 무시)
  if (isLoading) {
    return (
      <TermsPageLoading 
        message="개인정보 처리방침 로딩 중..."
        subMessage="잠시만 기다려주세요"
      />
    );
  }

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div
        className={`fixed inset-0 overflow-hidden ${isEmbed ? 'bg-white' : 'bg-gradient-to-br from-indigo-50 via-white to-purple-50 main-container'}`}
        data-page="/setting/terms/privacy"
        data-content-type="privacy-page"
        style={{
          paddingTop: '0px',
          marginTop: '0px',
          top: '0px'
        }}
      >
        {/* embed 모드가 아닐 때만 헤더 표시 (register에서 온 경우에도 헤더 표시) */}
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
                <h1 className="text-lg font-bold text-gray-900 leading-tight">개인정보 처리방침</h1>
                <p className="text-xs text-gray-500 leading-tight">개인정보 수집 및 처리 방침을 확인하세요</p>
              </div>
            </motion.div>
          </AnimatedHeader>

        {/* 컨텐츠 영역 - 고정 위치 (setting 페이지와 동일한 구조) */}
        <motion.div
          initial="initial"
          animate="in"
          exit="out"
          className={`absolute inset-0 px-4 space-y-6 content-area hide-scrollbar ${isEmbed ? 'pt-6' : 'pt-20'}`}
          data-testid="privacy-policy-page-content"
          data-content-type="privacy-policy-page-content"
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn privacy-content">
            <div className="p-6 text-sm leading-relaxed max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-center">개인정보 처리방침</h2>
              <p className="text-sm text-gray-500 mb-8 text-center">시행일: 2024-05-30</p>
              
              {/* 기존 컨텐츠는 유지하되 구조만 정리 */}
              <div className="space-y-6 text-gray-800 leading-7">
                <p className="mb-4">
                  비욘드리얼 ("회사"라 함)는 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 개인정보보호법, 통신비밀보호법, 전기통신사업법, 등 정보통신서비스제공자가 준수하여야 할 관련 법령상의 개인정보보호 규정을 준수하며, 관련 법령에 의거한 개인정보처리방침을 정하여 이용자 권익 보호에 최선을 다하고 있습니다.
                </p>
                
                <p className="mb-4">
                  본 개인정보처리방침은 회사가 제공하는 "홈페이지(www.smap.co.kr)" 및 "어플리케이션 (smap)" (이하에서는 홈페이지 및 어플리케이션을 이하 '서비스'라 합니다.) 이용에 적용되며 다음과 같은 내용을 담고 있습니다.
                </p>

                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">개인정보 수집 항목 및 이용목적</h2>
                <p className="mb-4">
                  "회사"는 회원가입, 원활한 고객상담, 각종 서비스의 제공을 위해 아래와 같은 최소한의 개인정보를 필수항목으로 수집하고 있습니다.
                </p>
                
                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">개인정보의 제3자에 대한 제공</h2>
                <p className="mb-4">
                  회사는 원칙적으로 이용자의 개인정보를 제1조(개인정보의 처리목적)에서 명시한 범위 내에서 처리하며, 이용자의 사전 동의 없이는 본래의 범위를 초과하여 처리하거나 제3자에게 제공하지 않습니다.
                </p>
                
                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">개인정보의 처리 및 보유기간</h2>
                <p className="mb-4">
                  회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
                </p>
                
                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">개인정보의 파기</h2>
                <p className="mb-4">
                  회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.
                </p>
                
                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">정보주체의 권리·의무 및 행사방법</h2>
                <p className="mb-4">
                  이용자는 개인정보주체로서 다음과 같은 권리를 행사할 수 있습니다.
                </p>
                
                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">개인정보 보호책임자</h2>
                <p className="mb-4">
                  회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
                </p>
                
                <div className="bg-gray-50 p-4 rounded-lg border-t-4 border-blue-500 mt-6">
                  <h4 className="font-semibold mb-2 text-sm">개인정보 보호책임자</h4>
                  <p className="text-xs text-gray-700">담당: 정진 | 전화: 070-8065-2207 | 이메일: admin@smap.site</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
} 
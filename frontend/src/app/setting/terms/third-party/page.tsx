"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import AnimatedHeader from '../../../../components/common/AnimatedHeader';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';

import useTermsPageState from '@/hooks/useTermsPageState';
import TermsPageLoading from '@/components/common/TermsPageLoading';
const pageAnimations = `
html, body { width: 100%; overflow-x: hidden; position: relative; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.animate-fadeIn { animation: fadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
.glass-effect { position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; z-index: 9999 !important; background: rgba(255, 255, 255, 0.8) !important; backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important; border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important; box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08) !important; }
`;

export default function ThirdPartyConsentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbed = (searchParams?.get('embed') === '1');

  // 약관 페이지 상태 관리 훅 사용
  const { isVisible, isLoading, isInitialized, applyStyles } = useTermsPageState({
    pageName: 'THIRD_PARTY',
    isEmbed
  });
  
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
      className={`${isEmbed ? 'min-h-screen overflow-auto bg-white' : 'min-h-screen overflow-auto bg-gradient-to-br from-indigo-50 via-white to-purple-50 main-container'}`} 
      data-page="/setting/terms/third-party"
      data-content-type="third-party-page"
    >
        {!isEmbed && (
        <AnimatedHeader variant="enhanced" className="setting-header glass-effect">
          <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }} className="setting-header-content motion-div">
            <motion.button onClick={handleBack} className="setting-back-button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} aria-label="뒤로가기">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </motion.button>
            <div className="setting-header-text">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">개인정보 제3자 제공 동의</h1>
              <p className="text-xs text-gray-500 leading-tight">제3자 제공에 관한 동의 내용을 확인하세요</p>
            </div>
          </motion.div>
        </AnimatedHeader>
        )}

        <motion.div initial="initial" animate="in" exit="out" className={`px-4 space-y-6 content-area ${isEmbed ? 'pt-6' : 'pt-20'}`}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn third-party-content">
            <div className="p-6 text-sm leading-relaxed max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-center">개인정보 제3자 제공 동의</h2>
              <p className="text-sm text-gray-500 mb-8 text-center">시행일: 2024-05-30</p>

              <div className="space-y-6 text-gray-800 leading-7">
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제공받는 자</h3>
                  <p className="text-sm">보험사(예: 한화손해보험), 마케팅 대행사, 클라우드/인증 등 서비스 제공을 위한 필수 제휴사 등</p>
                </section>
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제공 목적</h3>
                  <ul className="list-disc ml-5 space-y-1 text-sm">
                    <li>서비스 운영 및 고객 응대</li>
                    <li>혜택/이벤트 제공 및 마케팅</li>
                    <li>본인 인증 및 데이터 보관</li>
                  </ul>
                </section>
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제공 항목</h3>
                  <p className="text-sm">이메일, 성명, 생년월일, 성별, 연락처(전화번호), 서비스 이용 기록 등</p>
                </section>
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">보유·이용 기간</h3>
                  <p className="text-sm">동의 철회 또는 제공 목적 달성 시까지 보유·이용하며, 관련 법령에 따른 보존 의무가 있는 경우 해당 기간을 따릅니다.</p>
                </section>
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">동의 거부 권리 및 불이익</h3>
                  <p className="text-sm">귀하는 개인정보 제3자 제공에 대한 동의를 거부할 권리가 있으며, 동의하지 않더라도 기본 서비스 이용에는 제한이 없습니다. 다만, 관련 부가 서비스 또는 맞춤형 혜택 제공이 제한될 수 있습니다.</p>
                </section>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}



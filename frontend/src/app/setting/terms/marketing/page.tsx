"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import AnimatedHeader from '../../../../components/common/AnimatedHeader';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';
import { useAuth } from '@/contexts/AuthContext';
const pageAnimations = `
html, body { width: 100%; overflow-x: hidden; position: relative; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.animate-fadeIn { animation: fadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
.glass-effect { position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; z-index: 9999 !important; background: rgba(255, 255, 255, 0.8) !important; backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important; border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important; box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08) !important; }
`;

export default function MarketingTermsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbed = (searchParams?.get('embed') === '1');

  // 스타일 적용 함수
  const applyStyles = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isEmbed) {
      // embed 모드일 때는 내부 웹뷰처럼 작동
      document.body.style.position = 'relative';
      document.body.style.overflow = 'auto';
      document.body.style.height = 'auto';
      document.body.style.minHeight = '100vh';
      document.body.style.background = 'white';
      document.documentElement.style.position = 'relative';
      document.documentElement.style.overflow = 'auto';
      document.documentElement.style.height = 'auto';
      
      // iOS에서 추가 최적화
      if (isIOS) {
        document.body.style.setProperty('-webkit-overflow-scrolling', 'touch');
        document.body.style.setProperty('-webkit-transform', 'translateZ(0)');
        document.body.style.setProperty('-webkit-backface-visibility', 'hidden');
      }
    } else {
      document.body.style.overflowY = 'auto';
      document.documentElement.style.overflowY = 'auto';
    }
  };

  // 스타일 복원 함수
  const restoreStyles = () => {
    document.body.style.position = '';
    document.body.style.overflow = '';
    document.body.style.height = '';
    document.body.style.minHeight = '';
    document.body.style.background = '';
    document.body.style.removeProperty('-webkit-overflow-scrolling');
    document.body.style.removeProperty('-webkit-transform');
    document.body.style.removeProperty('-webkit-backface-visibility');
    document.documentElement.style.position = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.height = '';
    document.documentElement.style.overflowY = '';
  };

  useEffect(() => {
    // 초기 스타일 적용
    applyStyles();

    return () => {
      // cleanup 시 스타일 복원
      restoreStyles();
    };
  }, [isEmbed]);

  const handleBack = () => {
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '마케팅 정보 수집 동의 뒤로가기', { component: 'setting-terms', action: 'back-navigation' });
    router.push('/setting');
  };

  return (
    <>
      <style jsx global>{`
        ${pageAnimations}
        ${isEmbed ? `
          /* iPad WebView 최적화 스타일 */
          body, html {
            position: relative !important;
            overflow: auto !important;
            height: auto !important;
            min-height: 100vh !important;
            -webkit-overflow-scrolling: touch !important;
            -webkit-transform: translateZ(0) !important;
            -webkit-backface-visibility: hidden !important;
          }
          
          .main-container {
            position: relative !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            min-height: 100vh !important;
            height: auto !important;
          }
        ` : ''}
      `}</style>
    <div className={`${isEmbed ? 'min-h-screen overflow-auto bg-white' : 'fixed inset-0 overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 main-container'}`} 
         style={{ 
           paddingTop: '0px', 
           marginTop: '0px', 
           top: '0px',
           ...(isEmbed && {
             position: 'relative',
             width: '100%',
             minHeight: '100vh',
             WebkitOverflowScrolling: 'touch',
             WebkitTransform: 'translateZ(0)',
             WebkitBackfaceVisibility: 'hidden'
           })
         }}>
        {!isEmbed && (
        <AnimatedHeader variant="enhanced" className="setting-header glass-effect">
          <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }} className="setting-header-content motion-div">
            <motion.button onClick={handleBack} className="setting-back-button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} aria-label="뒤로가기">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </motion.button>
            <div className="setting-header-text">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">마케팅 정보 수집 및 이용 동의</h1>
              <p className="text-xs text-gray-500 leading-tight">혜택/이벤트 안내를 위한 정보 수집 및 이용 동의</p>
            </div>
          </motion.div>
        </AnimatedHeader>
        )}

        <motion.div initial="initial" animate="in" exit="out" className={`${isEmbed ? '' : 'absolute inset-0'} px-4 space-y-6 content-area ${isEmbed ? '' : 'hide-scrollbar'} ${isEmbed ? 'pt-6' : 'pt-20'}`} style={isEmbed ? undefined : { overflow: 'hidden', overflowY: 'auto' }}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn">
            <div className="p-6 text-sm leading-relaxed max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-center">마케팅 정보 수집 및 이용 동의</h2>
              <p className="text-sm text-gray-500 mb-8 text-center">시행일: 2024-05-30</p>
              <div className="space-y-6 text-gray-800 leading-7">
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">동의 대상</h3>
                  <p className="text-sm">회사가 제공하는 서비스와 관련하여 이벤트, 프로모션, 혜택, 서비스 안내 등을 전달하기 위한 마케팅 목적의 정보 수집 및 이용</p>
                </section>
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">수집·이용 목적</h3>
                  <ul className="list-disc ml-5 space-y-1 text-sm">
                    <li>서비스 관련 소식, 이벤트 및 프로모션 안내</li>
                    <li>맞춤형 혜택 제공 및 이용 통계 분석</li>
                  </ul>
                </section>
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">수집 항목</h3>
                  <ul className="list-disc ml-5 space-y-1 text-sm">
                    <li>연락처(이메일, 휴대폰 번호) 및 앱 푸시 토큰</li>
                    <li>광고식별자(ADID/IDFA), 서비스 이용 이력, 접속 기록, 쿠키 등</li>
                  </ul>
                </section>
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">보유·이용 기간</h3>
                  <p className="text-sm">동의 철회 또는 목적 달성 시까지로 하며, 관련 법령에 따른 보존 의무가 있는 경우 해당 기간을 따릅니다.</p>
                </section>
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">동의 거부 권리 및 불이익</h3>
                  <p className="text-sm">귀하는 동의를 거부할 권리가 있으며, 동의하지 않더라도 기본 서비스 이용에는 제한이 없습니다. 다만, 이벤트/혜택 및 맞춤형 정보 제공이 제한될 수 있습니다.</p>
                </section>
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">동의 철회 및 문의</h3>
                  <p className="text-sm">앱 설정 또는 고객센터(support@smap.site)를 통해 언제든지 수신 동의를 변경하거나 철회할 수 있습니다.</p>
                </section>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}



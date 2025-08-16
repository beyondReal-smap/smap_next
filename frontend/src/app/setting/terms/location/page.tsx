"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import AnimatedHeader from '../../../../components/common/AnimatedHeader';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';
import { useAuth } from '@/contexts/AuthContext';
import useTermsPageState from '@/hooks/useTermsPageState';
import TermsPageLoading from '@/components/common/TermsPageLoading';
const pageAnimations = `
html, body { width: 100%; overflow-x: hidden; position: relative; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.animate-fadeIn { animation: fadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
.glass-effect { position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; z-index: 9999 !important; background: rgba(255, 255, 255, 0.8) !important; backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important; border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important; box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08) !important; }
`;

export default function LocationTermsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbed = (searchParams?.get('embed') === '1');
  
  // 약관 페이지 상태 관리 훅 사용
  const { isVisible, isLoading, isInitialized } = useTermsPageState({
    pageName: 'LOCATION',
    isEmbed
  });



  const handleBack = () => {
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '위치기반서비스 약관 뒤로가기', { component: 'setting-terms', action: 'back-navigation' });
    router.push('/setting');
  };

  // 로딩 상태일 때만 로딩 화면 표시 (가시성과 초기화 상태는 무시)
  if (isLoading) {
    return (
      <TermsPageLoading 
        message="위치기반서비스 약관 로딩 중..."
        subMessage="잠시만 기다려주세요"
      />
    );
  }

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
    <div 
      className={`${isEmbed ? 'min-h-screen overflow-auto bg-white' : 'fixed inset-0 overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 main-container'}`} 
      data-page="/setting/terms/location"
      data-content-type="location-page"
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
      }}
    >
        {!isEmbed && (
        <AnimatedHeader variant="enhanced" className="setting-header glass-effect">
          <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }} className="setting-header-content motion-div">
            <motion.button onClick={handleBack} className="setting-back-button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} aria-label="뒤로가기">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </motion.button>
            <div className="setting-header-text">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">위치기반서비스 이용약관</h1>
              <p className="text-xs text-gray-500 leading-tight">위치정보 수집 및 이용 약관을 확인하세요</p>
            </div>
          </motion.div>
        </AnimatedHeader>
        )}

        <motion.div initial="initial" animate="in" exit="out" className={`${isEmbed ? '' : 'absolute inset-0'} px-4 space-y-6 content-area ${isEmbed ? '' : 'hide-scrollbar'} ${isEmbed ? 'pt-6' : 'pt-20'}`} style={isEmbed ? undefined : { overflow: 'hidden', overflowY: 'auto' }}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn location-content">
            <div className="p-6 text-sm leading-relaxed max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-center">위치기반서비스 이용약관</h2>
              <p className="text-sm text-gray-500 mb-8 text-center">시행일: 2024-05-30</p>

              <div className="space-y-6 text-gray-800 leading-7">
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제1조(목적)</h3>
                  <p>본 약관은 회원(비욘드리얼 서비스 약관에 동의한 자, 이하 “회원”)이 비욘드리얼(이하 “회사”)이 제공하는 웹/모바일 애플리케이션(“smap”)의 위치기반서비스를 이용함에 있어 회원과 회사의 권리와 의무, 기타 제반 사항을 정함을 목적으로 합니다.</p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제2조(가입자격)</h3>
                  <p>서비스에 가입할 수 있는 회원은 위치기반서비스를 이용할 수 있는 이동전화 단말기의 소유자 본인이어야 합니다.</p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제3조(서비스 가입)</h3>
                  <p>회사는 다음 각 호에 해당하는 가입신청을 승낙하지 않을 수 있습니다.</p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>실명이 아니거나 타인의 명의를 사용하는 등 허위로 신청하는 경우</li>
                    <li>고객 등록 사항을 누락하거나 오기하여 신청하는 경우</li>
                    <li>공공질서 또는 미풍양속을 저해하거나 저해할 목적을 가지고 신청하는 경우</li>
                    <li>기타 회사가 정한 이용신청 요건이 충족되지 않았을 경우</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제4조(서비스 해지)</h3>
                  <p>회원은 회사가 정한 절차를 통해 서비스 해지를 신청할 수 있습니다.</p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제5조(이용약관의 효력 및 변경)</h3>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>본 약관은 서비스를 신청한 고객 또는 개인위치정보주체가 회사가 정한 절차에 따라 회원으로 등록함으로써 효력이 발생합니다.</li>
                    <li>서비스 신청자가 온라인에서 본 약관을 모두 읽고 “동의하기”를 클릭한 경우 본 약관의 내용에 동의한 것으로 봅니다.</li>
                    <li>본 약관에 동의하지 않는 경우, 회사가 개인위치정보를 기반으로 제공하는 혜택 및 편의 제공에 일부 제한이 발생할 수 있습니다.</li>
                    <li>회사는 관계 법령의 범위 내에서 본 약관을 개정할 수 있으며, 개정 시 적용일자, 개정사유를 명시하여 적용일자 10일 전부터 서비스 내 공지합니다. 회원에게 불리하거나 권리를 제한하는 개정의 경우 30일 전부터 공지하고 전자적 수단으로 고지합니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제6조(약관 외 준칙)</h3>
                  <p>본 약관에 명시되지 않은 사항은 관계 법령 및 건전한 거래관행에 따릅니다.</p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제7조(서비스의 내용)</h3>
                  <p>회사가 제공하는 위치기반서비스는 아래와 같습니다.</p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>위치기반 콘텐츠 분류(지오태깅)</li>
                    <li>회사 및 제휴사의 상품/서비스 정보 제공</li>
                    <li>마케팅 서비스 및 프로모션 혜택 알림 제공</li>
                    <li>길 안내 등 생활편의 서비스 제공</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제8조(서비스 이용요금)</h3>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>서비스는 무료 제공을 원칙으로 합니다. 단, 유료서비스는 해당 화면에 명시된 요금을 지불하여 이용할 수 있습니다.</li>
                    <li>무선 데이터 통신료는 이동통신사 정책에 따르며 회원이 부담합니다.</li>
                    <li>MMS 등으로 게시물을 등록할 경우 발생하는 요금은 이동통신사 정책에 따릅니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제9조(서비스내용 변경 통지 등)</h3>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>회사가 서비스 내용을 변경하거나 종료하는 경우 회원이 등록한 전자우편 주소로 사전 통지합니다(원칙적으로 7일 전).</li>
                    <li>불특정 다수에 대한 통지는 웹/앱 공지로 갈음할 수 있습니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제10조(서비스이용의 제한 및 중지)</h3>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>회원이 서비스 운영을 고의 또는 과실로 방해하는 경우</li>
                    <li>설비 점검, 보수 또는 공사 등 부득이한 경우</li>
                    <li>기간통신사업자 서비스 중지, 국가비상사태, 설비 장애, 이용 폭주 등 정상 제공이 어려운 경우</li>
                    <li>기타 중대한 사유로 서비스 제공을 지속하기 곤란한 경우</li>
                  </ol>
                </section>

                <div className="bg-gray-50 p-4 rounded-lg border-t-4 border-blue-500 mt-6">
                  <h4 className="font-semibold mb-2 text-sm">부칙</h4>
                  <p className="text-xs text-gray-700">본 약관은 2024-05-30부터 시행합니다.</p>
                </div>
              </div>
      </div>
    </div>
        </motion.div>
      </div>
    </>
  );
} 

 

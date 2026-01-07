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
      // URL에서 소셜 로그인 정보와 현재 단계 정보를 유지
      const urlParams = new URLSearchParams(window.location.search);
      const social = urlParams.get('social');
      const step = urlParams.get('step') || 'terms';

      let targetUrl = '/register';
      if (social) {
        targetUrl += `?social=${social}`;
        if (step) {
          targetUrl += `&step=${step}`;
        }
      }

      router.push(targetUrl);
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
                <h1 className="text-lg font-bold text-gray-900 leading-tight">개인정보 처리방침</h1>
                <p className="text-xs text-gray-500 leading-tight">개인정보 수집 및 처리 방침을 확인하세요</p>
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
              <p className="text-sm text-gray-500 mb-8 text-center">시행일: 2026-01-08</p>

              <div className="space-y-6 text-gray-800 leading-7">
                <p className="mb-4">
                  비욘드리얼("회사"라 함)는 이용자의 개인정보를 소중하게 생각하며, 『개인정보 보호법』 및 『위치정보의 보호 및 이용 등에 관한 법률』 등 관련 법령을 준수하고 있습니다.
                </p>

                <p className="mb-4">
                  본 방침은 "smap" 서비스 이용 시 수집되는 위치 데이터를 포함한 개인정보의 처리 과정을 상세히 공개합니다.
                </p>

                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">1. 개인정보 수집 항목 및 이용목적</h2>
                <p className="mb-4">
                  회사는 서비스 제공을 위해 아래와 같은 개인정보 및 기기 액세스 권한을 수집·이용합니다.
                </p>

                {/* 수집 항목 테이블 */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">구분</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">수집 항목</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">이용 목적</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 font-medium">위치 정보 (필수)</td>
                        <td className="border border-gray-300 px-3 py-2">실시간 GPS 위치 데이터, 이동 경로, 기기 위치 정보</td>
                        <td className="border border-gray-300 px-3 py-2">그룹 내 실시간 위치 공유, 일정 장소 기반 알림, 위치 기반 서비스 제공</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 font-medium">회원 정보 (필수)</td>
                        <td className="border border-gray-300 px-3 py-2">이메일 주소, 비밀번호, 닉네임, 프로필 사진</td>
                        <td className="border border-gray-300 px-3 py-2">서비스 가입 및 본인 확인, 사용자 식별</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 font-medium">기기 정보 (필수)</td>
                        <td className="border border-gray-300 px-3 py-2">단말기 식별번호(ID), OS 버전, 방문 기록</td>
                        <td className="border border-gray-300 px-3 py-2">서비스 최적화 및 부정 이용 방지</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 중요 고지 */}
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg mb-6">
                  <h4 className="font-semibold text-amber-800 mb-2">[중요] 위치 정보 액세스 고지</h4>
                  <p className="text-amber-900 text-sm mb-2">
                    "smap"은 앱이 닫혀 있거나 사용 중이 아닐 때도 실시간 위치 공유 기능을 지원하기 위해 위치 데이터를 수집합니다.
                  </p>
                  <p className="text-amber-900 text-sm">
                    이용자가 '항상 허용'으로 설정한 경우에 한해 백그라운드에서 위치 정보를 액세스하며, 이는 그룹 멤버 간의 원활한 일정 및 위치 공유를 위한 핵심 기능입니다.
                  </p>
                </div>

                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">2. 위치정보의 보호 및 이용 (추가)</h2>
                <p className="mb-4">
                  회사는 위치기반서비스를 제공하기 위해 이용자의 위치정보를 처리하며, 다음과 같은 원칙을 준수합니다.
                </p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li><strong>수집 방법:</strong> GPS, Wi-Fi, 기기 센서 등을 통해 실시간으로 수집합니다.</li>
                  <li><strong>보유 및 이용:</strong> 이용 목적이 달성되거나 이용자가 동의를 철회할 경우 즉시 파기합니다. 단, 관련 법령에 따라 기록을 보존해야 하는 경우 해당 기간(예: 위치정보 이용·제공사실 확인자료 6개월) 동안 보관합니다.</li>
                  <li><strong>이용자 권리:</strong> 이용자는 언제든지 위치 정보 수집에 대한 동의를 거부하거나 철회할 수 있으며, 이 경우 서비스의 일부(실시간 공유 등) 이용이 제한될 수 있습니다.</li>
                </ul>

                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">3. 개인정보의 제3자에 대한 제공</h2>
                <p className="mb-4">
                  회사는 이용자의 사전 동의 없이 개인정보를 외부에 제공하지 않습니다.
                </p>
                <p className="mb-4">
                  단, 그룹 공유 기능을 선택하여 이용자가 스스로 위치 정보를 그룹 멤버에게 노출하는 경우는 예외로 합니다.
                </p>

                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">4. 개인정보의 파기</h2>
                <p className="mb-4">
                  개인정보는 수집 및 이용목적이 달성되면 지체 없이 파기합니다. 전자적 파일 형태는 복구가 불가능한 기술적 방법을 사용하여 삭제합니다.
                </p>

                <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-900">5. 개인정보 보호책임자</h2>
                <p className="mb-4">
                  회사는 개인정보 및 위치정보와 관련한 고충 처리를 위하여 아래와 같이 책임자를 지정하고 있습니다.
                </p>

                <div className="bg-gray-50 p-4 rounded-lg border-t-4 border-blue-500 mt-6">
                  <h4 className="font-semibold mb-3 text-sm">개인정보 보호책임자</h4>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p><strong>성명:</strong> 정진</p>
                    <p><strong>전화:</strong> 070-8065-2207</p>
                    <p><strong>이메일:</strong> admin@smap.site</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
} 
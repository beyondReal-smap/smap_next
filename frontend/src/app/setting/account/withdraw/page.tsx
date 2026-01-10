"use client";
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  FiEye,
  FiEyeOff,
  FiAlertTriangle,
  FiShield,
  FiTrash2,
  FiCheck,
  FiX,
  FiUser,
  FiHeart,
  FiLock,
  FiInfo,
  FiArrowRight,
  FiArrowLeft
} from 'react-icons/fi';
import { HiExclamationTriangle, HiCheckCircle, HiInformationCircle, HiSparkles } from 'react-icons/hi2';
import { ConfirmModal, AlertModal } from '@/components/ui';
import AnimatedHeader from '../../../../components/common/AnimatedHeader';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';

// 탈퇴 사유 리스트
const reasonList = [
  { id: 1, icon: '😴', text: '자주 사용하지 않아요' },
  { id: 2, icon: '🚫', text: '원하는 기능 부족' },
  { id: 3, icon: '😕', text: '서비스가 불편해요' },
  { id: 4, icon: '🔒', text: '개인정보 우려' },
  { id: 5, icon: '❓', text: '기타 이유' }
];

export default function WithdrawPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [etcReason, setEtcReason] = useState('');
  const [agreement, setAgreement] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [shakeError, setShakeError] = useState(false);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');

  // 사용자 로그인 타입 확인
  const [isGoogleLogin, setIsGoogleLogin] = useState(false);
  const [isAppleLogin, setIsAppleLogin] = useState(false);

  // 페이지 마운트 시 스크롤 설정 및 사용자 로그인 타입 확인
  useEffect(() => {
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflowY = 'auto';

    // 사용자 로그인 타입 확인
    try {
      const userData = localStorage.getItem('user-data') || localStorage.getItem('smap_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        // mt_type: 1: 일반, 2: 구글, 3: 애플, 4: 카카오 등
        setIsGoogleLogin(user.mt_type === 2);
        setIsAppleLogin(user.mt_type === 3);
      }
    } catch (error) {
      console.error('사용자 정보 파싱 오류:', error);
    }

    return () => {
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
    };
  }, []);

  // 에러 발생시 흔들기 효과
  useEffect(() => {
    if (error) {
      setShakeError(true);
      const timer = setTimeout(() => setShakeError(false), 500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // 단계 변경시 애니메이션을 위한 force reflow
  useEffect(() => {
    const forceReflow = () => {
      document.body.offsetHeight;
    };
    forceReflow();
  }, [currentStep]);

  // 뒤로가기 핸들러 - password 페이지와 동일
  const handleBack = () => {
    // 🎮 뒤로가기 햅틱 피드백
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '회원탈퇴 뒤로가기', {
      component: 'withdraw-setting',
      action: 'back-navigation'
    });
    router.push('/setting/account');
  };

  const handleBackNavigation = () => {
    if (currentStep > 1) {
      setStepDirection('backward');
      setCurrentStep(currentStep - 1);
      setError('');
    } else {
      // 🎮 뒤로가기 햅틱 피드백
      triggerHapticFeedback(HapticFeedbackType.SELECTION, '회원탈퇴 뒤로가기', {
        component: 'withdraw-setting',
        action: 'back-navigation'
      });
      router.push('/setting/account');
    }
  };

  const handlePasswordNext = async () => {
    // 구글/애플 로그인 사용자는 비밀번호 확인 생략
    if (isGoogleLogin || isAppleLogin) {
      console.log('[WITHDRAW] 소셜 로그인 사용자 - 비밀번호 확인 생략');
      setError('');
      setStepDirection('forward');
      setCurrentStep(2);
      return;
    }

    if (!password) {
      setError('비밀번호를 입력해주세요');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 여러 키에서 토큰 찾기
      const token = localStorage.getItem('auth-token') ||
        localStorage.getItem('smap_auth_token') ||
        localStorage.getItem('authToken');
      console.log('[WITHDRAW] JWT 토큰 확인:', token ? '존재함' : '없음');

      if (!token || token === 'null' || token === 'undefined') {
        setError('로그인이 필요합니다. 다시 로그인해주세요.');
        setIsLoading(false);
        return;
      }

      // 비밀번호 검증 API 호출
      const response = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setError('비밀번호가 일치하지 않습니다');
        } else if (response.status === 400) {
          setError(data.message || '잘못된 요청입니다');
        } else {
          throw new Error(data.message || '비밀번호 확인에 실패했습니다');
        }
        return;
      }

      // 비밀번호 검증 성공
      console.log('[WITHDRAW] 비밀번호 검증 성공');
      setError('');
      setStepDirection('forward');
      setCurrentStep(2);

    } catch (error) {
      console.error('비밀번호 검증 오류:', error);
      setError('비밀번호 확인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReasonChange = (reason: string) => {
    setReasons(prev =>
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
  };

  const handleReasonNext = () => {
    if (reasons.length === 0) {
      setError('탈퇴 사유를 선택해주세요');
      return;
    }
    if (reasons.includes('기타 이유') && !etcReason.trim()) {
      setError('기타 사유를 입력해주세요');
      return;
    }
    setError('');
    setStepDirection('forward');
    setCurrentStep(3);
  };

  const handleFinalWithdraw = () => {
    if (!agreement) {
      setError('안내사항을 확인하고 동의해주세요');
      return;
    }
    setShowFinalModal(true);
  };

  const handleConfirmWithdraw = async () => {
    setShowFinalModal(false);
    setIsLoading(true);

    try {
      // 여러 키에서 토큰 찾기
      const token = localStorage.getItem('auth-token') ||
        localStorage.getItem('smap_auth_token') ||
        localStorage.getItem('authToken');
      console.log('[WITHDRAW] JWT 토큰 확인:', token ? '존재함' : '없음');

      if (!token || token === 'null' || token === 'undefined') {
        setError('로그인이 필요합니다. 다시 로그인해주세요.');
        setIsLoading(false);
        return;
      }

      console.log('[WITHDRAW] 탈퇴 요청 데이터:', {
        reasons: reasons,
        etcReason: etcReason,
      });

      // 회원 탈퇴 API 호출
      const response = await fetch('/api/auth/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          reasons: reasons,
          etcReason: etcReason,
        }),
      });

      console.log('[WITHDRAW] API 응답 상태:', response.status);
      const data = await response.json();
      console.log('[WITHDRAW] API 응답 데이터:', data);

      if (!response.ok) {
        if (response.status === 401) {
          setError('인증이 만료되었습니다. 다시 로그인해주세요.');
        } else if (response.status === 400) {
          setError(data.message || '잘못된 요청입니다.');
        } else {
          throw new Error(data.message || '회원 탈퇴에 실패했습니다.');
        }
        return;
      }

      // 회원 탈퇴 성공
      console.log('[WITHDRAW] 회원 탈퇴 성공');

      // 모든 인증 관련 데이터 제거
      localStorage.removeItem('auth-token');
      localStorage.removeItem('user-data');
      localStorage.removeItem('kakao-token');
      localStorage.removeItem('google-token');

      // 세션 스토리지도 정리
      sessionStorage.clear();

      // NextAuth 세션 정리
      try {
        const { signOut } = await import('next-auth/react');
        await signOut({ redirect: false });
        console.log('[WITHDRAW] NextAuth 세션 정리 완료');
      } catch (error) {
        console.log('[WITHDRAW] NextAuth 세션 정리 오류:', error);
      }

      // 카카오 완전 로그아웃 (카카오 SDK가 있는 경우)
      if (typeof window !== 'undefined' && window.Kakao && window.Kakao.Auth) {
        try {
          // 카카오 액세스 토큰 만료
          await window.Kakao.Auth.logout();
          console.log('[WITHDRAW] 카카오 로그아웃 완료');

          // 카카오 연결 해제 (선택사항 - 앱 연결 완전 해제)
          // await window.Kakao.API.request({
          //   url: '/v1/user/unlink'
          // });
        } catch (error) {
          console.log('[WITHDRAW] 카카오 로그아웃 오류:', error);
        }
      }

      // 모든 쿠키 정리 (특히 auth-token)
      const cookies = ['auth-token', 'next-auth.session-token', 'next-auth.csrf-token', 'next-auth.callback-url'];
      cookies.forEach(cookieName => {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
      });

      // 모든 쿠키 정리 (일반적인 방법)
      document.cookie.split(";").forEach(function (c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      setShowSuccessModal(true);

    } catch (error) {
      console.error('회원 탈퇴 오류:', error);
      setError('탈퇴 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = (setModalState: (state: boolean) => void) => {
    setIsClosing(true);
    setTimeout(() => {
      setModalState(false);
      setIsClosing(false);
    }, 300);
  };

  const handleSuccessConfirm = () => {
    // 탈퇴 완료 후 로그인 페이지로 이동하고 강제 새로고침
    console.log('[WITHDRAW] 탈퇴 완료 후 로그인 페이지로 이동');

    // 브라우저 히스토리 정리
    window.history.replaceState(null, '', '/signin');

    // 강제 새로고침으로 모든 상태 초기화 (탈퇴 플래그 포함)
    window.location.href = '/signin?from=withdraw';
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-4 mb-2">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${step < currentStep
              ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg'
              : step === currentStep
                ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-500'
              }`}
          >
            {step < currentStep ? <FiCheck className="w-5 h-5" /> : step}
          </div>
          {step < 3 && (
            <div className={`w-8 h-1 mx-2 rounded-full transition-all duration-300 ${step < currentStep ? 'bg-gray-500' : 'bg-gray-500'
              }`} />
          )}
        </div>
      ))}
    </div>
  );

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return '본인 확인';
      case 2: return '탈퇴 사유';
      case 3: return '최종 확인';
      default: return '';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return '계정 보안을 위해 비밀번호를 입력해주세요';
      case 2: return '서비스 개선을 위해 탈퇴 사유를 알려주세요';
      case 3: return '탈퇴 전 마지막으로 확인해주세요';
      default: return '';
    }
  };

  return (
    <>
      <style jsx global>{`
        html, body {
          width: 100%;
          overflow-x: hidden;
          position: relative;
          /* iOS WebView 최적화 */
          -webkit-text-size-adjust: 100%;
          -webkit-overflow-scrolling: touch;
          /* iOS safe-area 완전 무시 */
          padding-top: 0px !important;
          margin-top: 0px !important;
        }

        /* iOS 전용 스타일 */
        @supports (-webkit-touch-callout: none) {
          html, body {
            position: fixed !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
          }
          
          #__next {
            height: 100% !important;
            overflow: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          
          #setting-page-container {
            height: 100vh !important;
            height: -webkit-fill-available !important;
            overflow: hidden !important;
          }
          
          .content-area, .withdraw-content-area {
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            height: calc(100vh - 62px) !important;
            padding-bottom: 120px !important;
          }
          
          /* iOS 헤더 강제 표시 */
          header, .glass-effect, .header-fixed, .setting-header {
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
            -webkit-backdrop-filter: blur(10px) !important;
            height: 56px !important;
            min-height: 56px !important;
            max-height: 56px !important;
            width: 100% !important;
            margin: 0 !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          
          /* iOS 헤더 내부 요소 */
          header *, .setting-header * {
            pointer-events: auto !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
        }

        /* 탈퇴 페이지에서 네비게이션 바 완전 제거 */
        body[data-page="/setting"] #bottom-navigation-bar,
        body[data-page*="/setting"] #bottom-navigation-bar,
        html[data-page="/setting"] #bottom-navigation-bar,
        html[data-page*="/setting"] #bottom-navigation-bar {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          position: absolute !important;
          bottom: -100px !important;
          z-index: -1 !important;
        }
        
        /* 탈퇴 페이지에서 네비게이션 바 관련 여백 제거 */
        body[data-page="/setting"] .pb-24,
        body[data-page*="/setting"] .pb-24,
        body[data-page="/setting"] .pb-20,
        body[data-page*="/setting"] .pb-20 {
          padding-bottom: 0 !important;
        }
        
        /* 스크롤바 숨기기 */
        body, html {
          overflow-x: hidden !important;
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        
        body::-webkit-scrollbar,
        html::-webkit-scrollbar {
          display: none !important;
        }
        
        /* 모든 스크롤 가능한 요소에서 스크롤바 숨기기 */
        * {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        
        *::-webkit-scrollbar {
          display: none !important;
        }
        
        /* 헤더 고정 스타일 */
        .setting-header {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 999999 !important;
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50" data-page="/setting/account/withdraw">
        {/* 통일된 헤더 애니메이션 */}
        <AnimatedHeader
          variant="simple"
          className="fixed top-0 left-0 right-0 z-50 glass-effect header-fixed setting-header"
          style={{
            paddingTop: '0px',
            marginTop: '0px',
            top: '0px',
            position: 'fixed',
            zIndex: 2147483647,
            height: '62px',
            minHeight: '62px',
            maxHeight: '62px',
            width: '100vw',
            left: '0px',
            right: '0px',
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
            boxShadow: '0 2px 16px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
            willChange: 'transform',
            visibility: 'visible',
            opacity: 1,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'manipulation',
            pointerEvents: 'auto',
            overflow: 'visible',
            clip: 'auto',
            clipPath: 'none',
            WebkitClipPath: 'none'
          }}
        >
          <div className="flex items-center justify-between h-14" style={{ paddingLeft: '0px', paddingRight: '16px' }}>
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex items-center space-x-3"
            >
              <motion.button
                onClick={handleBackNavigation}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              <div className="flex items-center space-x-3">
                <div>
                  <h1 className="text-lg font-bold text-gray-900">SMAP 회원탈퇴</h1>
                  <p className="text-xs text-gray-500">계정 및 데이터 삭제 절차</p>
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatedHeader>

        {/* 스크롤 가능한 메인 컨텐츠 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="px-4 pt-20 space-y-4 pb-32 withdraw-content-area"
          style={{
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            minHeight: '100vh'
          }}
        >
          {/* 경고 안내 카드 - password 페이지 스타일과 유사하게 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="bg-red-50 border border-red-200 rounded-xl p-3"
            style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}
          >
            <div className="flex items-start space-x-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: '#FEE2E2' }}>
                <FiAlertTriangle className="w-4 h-4" style={{ color: '#DC2626' }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: '#7F1D1D' }}>SMAP 계정 삭제 안내</h3>
                <div className="text-xs space-y-2" style={{ color: '#B91C1C' }}>
                  <p>사용자님의 계정과 관련 데이터를 삭제하기 위해 다음 단계를 진행합니다:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>본인 확인 (비밀번호 입력 또는 소셜 로그인 확인)</li>
                    <li>서비스 개선을 위한 탈퇴 사유 선택</li>
                    <li>데이터 삭제 범위 확인 및 최종 동의</li>
                  </ol>
                  <p className="font-bold underline text-red-600 mt-1">※ 30일간 재가입이 제한됩니다.</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 단계 표시기 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            {renderStepIndicator()}
          </motion.div>

          {/* 단계별 제목 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-center"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-1">{getStepTitle()}</h2>
            <p className="text-sm text-gray-600">{getStepDescription()}</p>
          </motion.div>

          {/* 단계별 컨텐츠 */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: stepDirection === 'forward' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="space-y-3"
              >
                {/* 구글/애플 로그인 사용자는 비밀번호 입력 생략 */}
                {!isGoogleLogin && !isAppleLogin ? (
                  <>
                    {/* 비밀번호 입력 - password 페이지 스타일 적용 */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            현재 비밀번호
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <FiLock className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className={`block w-full pl-9 pr-10 py-3 border ${error && !password ? 'border-red-300' : 'border-gray-300'
                                } rounded-lg focus:ring-2 transition-all duration-200`}
                              style={{
                                '--tw-ring-color': '#DC2626',
                                '--tw-border-opacity': '1'
                              } as any}
                              onFocus={(e) => {
                                e.target.style.borderColor = '#DC2626';
                                e.target.style.boxShadow = '0 0 0 2px rgba(220, 38, 38, 0.2)';
                              }}
                              onBlur={(e) => {
                                if (!(error && !password)) {
                                  e.target.style.borderColor = '#D1D5DB';
                                }
                                e.target.style.boxShadow = 'none';
                              }}
                              placeholder="현재 비밀번호를 입력하세요"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            >
                              {showPassword ?
                                <FiEyeOff className="h-4 w-4 text-gray-400" /> :
                                <FiEye className="h-4 w-4 text-gray-400" />
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 보안 안내 */}
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3"
                      style={{ backgroundColor: '#FFF7ED', borderColor: '#FDBA74' }}>
                      <div className="flex items-start space-x-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: '#FED7AA' }}>
                          <FiShield className="w-4 h-4" style={{ color: '#F97315' }} />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold mb-1" style={{ color: '#9A3412' }}>보안 확인</h4>
                          <p className="text-sm" style={{ color: '#C2410C' }}>계정 보안을 위해 본인 확인이 필요합니다.</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* 소셜 로그인 사용자 안내 */
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="text-center space-y-3">
                      {isGoogleLogin ? (
                        <>
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900">구글 로그인 확인</h3>
                          <p className="text-sm text-gray-600">
                            구글 계정으로 로그인한 사용자입니다.<br />
                            아래 다음 버튼을 눌러 계속 진행해주세요.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900">애플 로그인 확인</h3>
                          <p className="text-sm text-gray-600">
                            애플 계정으로 로그인한 사용자입니다.<br />
                            아래 다음 버튼을 눌러 계속 진행해주세요.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="space-y-3"
              >
                {/* 탈퇴 사유 선택 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center mb-3">
                    <FiInfo className="w-4 h-4 mr-2 text-orange-600" />
                    <h3 className="text-base font-semibold text-gray-900">탈퇴 사유</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {reasonList.map((reason) => (
                      <button
                        key={reason.id}
                        onClick={() => handleReasonChange(reason.text)}
                        className={`p-3 rounded-lg border-2 text-left transition-all duration-200 ${reasons.includes(reason.text)
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{reason.icon}</span>
                          <span className="text-sm font-medium text-gray-900 leading-tight">{reason.text}</span>
                          {reasons.includes(reason.text) && (
                            <FiCheck className="w-4 h-4 text-red-600 ml-auto" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* 기타 사유 입력 */}
                  {reasons.includes('기타 이유') && (
                    <div className="mt-3">
                      <textarea
                        value={etcReason}
                        onChange={e => setEtcReason(e.target.value)}
                        className="w-full bg-gray-50 rounded-lg px-3 py-3 text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 resize-none"
                        placeholder="기타 사유를 자세히 알려주세요"
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="space-y-3"
              >
                {/* 탈퇴 안내사항 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center mb-3">
                    <FiAlertTriangle className="w-4 h-4 mr-2 text-red-600" />
                    <h3 className="text-base font-semibold text-gray-900">탈퇴 안내사항</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start space-x-2">
                      <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiX className="w-2.5 h-2.5 text-red-600" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-0.5">삭제되는 데이터 유형</h4>
                        <p className="text-xs text-gray-600">
                          - 프로필 정보: 이름, 이메일, 전화번호, 닉네임, 프로필 사진<br />
                          - 위치 기록: 활동 로그 경로, GPS 좌표, 방문 장소 기록<br />
                          - 계정 정보: 로그인 ID, 연동된 소셜 계정 정보
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiX className="w-2.5 h-2.5 text-red-600" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-0.5">데이터 보관 및 삭제 기간</h4>
                        <p className="text-xs text-gray-600">
                          - 즉시 삭제: 사용자 프로필 및 모든 위치 기록 데이터<br />
                          - 30일 보관: 부정 가입 방지를 위해 회원의 닉네임 및 중복가입 확인정보(CI)는 30일간 보관 후 완전히 삭제됩니다.<br />
                          - 법령 준수: 관련 법령(소비자 보호법 등)에 의해 보존이 필요한 기록은 해당 기간 동안 별도 보관됩니다.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiX className="w-2.5 h-2.5 text-red-600" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-0.5">데이터 복구 불가</h4>
                        <p className="text-xs text-gray-600">삭제 처리된 데이터는 어떠한 경우에도 복구할 수 없습니다.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 동의 체크박스 */}
                <div className="bg-gray-50 rounded-xl p-3">
                  <label className="flex items-start space-x-2 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={agreement}
                        onChange={e => setAgreement(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${agreement ? 'bg-red-500 border-red-500' : 'border-gray-300'
                        }`}>
                        {agreement && <FiCheck className="w-2.5 h-2.5 text-white" />}
                      </div>
                    </div>
                    <span className="text-xs text-gray-700 leading-relaxed">
                      위 안내사항을 모두 확인했으며, 회원탈퇴에 동의합니다.
                    </span>
                  </label>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* 에러 메시지 */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-red-50 border border-red-200 rounded-xl p-4 ${shakeError ? 'animate-pulse' : ''}`}
            >
              <p className="text-sm text-red-700 flex items-center">
                <FiAlertTriangle className="w-4 h-4 mr-2" />
                {error}
              </p>
            </motion.div>
          )}

          {/* 액션 버튼 - password 페이지 스타일 적용 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            {currentStep < 3 ? (
              <button
                onClick={currentStep === 1 ? handlePasswordNext : handleReasonNext}
                disabled={
                  isLoading ||
                  (currentStep === 1 && !password && !isGoogleLogin && !isAppleLogin) ||
                  (currentStep === 2 && reasons.length === 0) ||
                  (currentStep === 2 && reasons.includes('기타 이유') && !etcReason.trim())
                }
                className="w-full py-4 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
                style={{
                  backgroundColor: '#DC2626',
                  background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)'
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #B91C1C 0%, #991B1B 100%)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)';
                  }
                }}
              >
                {isLoading && currentStep === 1 ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>확인 중...</span>
                  </>
                ) : (
                  <>
                    <span>다음 단계</span>
                    <FiArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleFinalWithdraw}
                disabled={!agreement || isLoading}
                className="w-full py-4 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
                style={{
                  backgroundColor: '#DC2626',
                  background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)'
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #B91C1C 0%, #991B1B 100%)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)';
                  }
                }}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>처리 중...</span>
                  </>
                ) : (
                  <>
                    <FiTrash2 className="w-4 h-4" />
                    <span>회원탈퇴</span>
                  </>
                )}
              </button>
            )}
          </motion.div>
        </motion.div>

        {/* 최종 확인 모달 */}
        <ConfirmModal
          isOpen={showFinalModal}
          onClose={() => setShowFinalModal(false)}
          message="정말 탈퇴하시겠습니까?"
          description="이 작업은 되돌릴 수 없습니다."
          confirmText="탈퇴하기"
          cancelText="취소"
          onConfirm={handleConfirmWithdraw}
          type="error"
          isLoading={isLoading}
        />

        {/* 성공 모달 */}
        <AlertModal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          message="탈퇴 완료"
          description="그동안 서비스를 이용해주셔서 감사했습니다."
          buttonText="확인"
          onConfirm={handleSuccessConfirm}
          type="success"
        />
      </div>
    </>
  );
} 
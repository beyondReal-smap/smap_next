'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiMail, FiSend, FiMessageSquare, FiCheck } from 'react-icons/fi';
import { AlertModal, ConfirmModal } from '@/components/ui';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';
import AnimatedHeader from '../../../components/common/AnimatedHeader';

const INQUIRY_CATEGORIES = [
  { value: 'general', label: '일반 문의', icon: '💬' },
  { value: 'technical', label: '기술 지원', icon: '🔧' },
  { value: 'account', label: '계정 문제', icon: '👤' },
  { value: 'billing', label: '결제 문의', icon: '💳' }
];

// 모바일 최적화된 CSS 애니메이션
const pageAnimations = `
html, body {
  width: 100%;
  overflow-x: hidden;
  position: relative;
}

@keyframes slideInFromRight {
  from {
    transform: translateX(30px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOutToRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-30px);
    opacity: 0;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slideInFromRight {
  animation: slideInFromRight 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.animate-slideOutToRight {
  animation: slideOutToRight 0.4s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.initial-hidden {
  opacity: 0;
  transform: translateX(100%);
  position: relative;
  width: 100%;
  overflow: hidden;
}

/* glass-effect 스타일 - setting 페이지와 동일 */
.glass-effect {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 9999 !important;
  background: rgba(255, 255, 255, 0.8) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08) !important;
  width: 100% !important;
  height: auto !important;
  transform: none !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  overflow: visible !important;
}

/* 혹시 부모 요소가 relative나 다른 포지션인 경우를 위한 추가 스타일 */
body, html {
  position: relative !important;
}

/* 헤더가 잘리지 않도록 보장 */
.glass-effect > * {
  position: relative !important;
}

.mobile-button {
  transition: all 0.2s ease;
  touch-action: manipulation;
  user-select: none;
}

.mobile-button:active {
  transform: scale(0.98);
}
`;

export default function InquiryPage() {
  const router = useRouter();
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [emailError, setEmailError] = useState('');

  // 페이지 마운트 시 스크롤 설정
  useEffect(() => {
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflowY = 'auto';
    return () => {
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
    };
  }, []);

  const handleBack = () => {
    // 🎮 뒤로가기 햅틱 피드백
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '1:1 문의 뒤로가기', { 
      component: 'inquiry', 
      action: 'back-navigation' 
    });
    router.push('/setting');
  };

  // 이메일 형식 검증 함수
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 이메일 입력 핸들러
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    
    if (value && !validateEmail(value)) {
      setEmailError('올바른 이메일 형식을 입력해주세요.');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async () => {
    if (!category || !subject || !message || !email) {
      setErrorMessage('모든 필수 필드를 입력해주세요.');
      setShowErrorModal(true);
      return;
    }

    if (!validateEmail(email)) {
      setErrorMessage('올바른 이메일 형식을 입력해주세요.');
      setShowErrorModal(true);
      return;
    }

    setIsSending(true);
    
    try {
      // 텔레그램으로 문의 내용 전송
      const telegramResult = await sendTelegram();
      
      if (!telegramResult.success) {
        throw new Error(telegramResult.message);
      }
      
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Error sending inquiry:', error);
      setErrorMessage(error.message || '문의 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      setShowErrorModal(true);
    } finally {
      setIsSending(false);
    }
  };

  // 서버 라우트를 통한 텔레그램 문의 전송
  const sendTelegram = async (): Promise<{success: boolean, message: string}> => {
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('smap_auth_token') || localStorage.getItem('auth_token') || localStorage.getItem('auth-token')
          : null;

      const response = await fetch('/api/inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          category,
          subject,
          message,
          email,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        return {
          success: false,
          message: result.message || '문의 전송에 실패했습니다. 잠시 후 다시 시도해주세요.',
        };
      }

      return { success: true, message: result.message || '메시지가 성공적으로 전송되었습니다.' };
    } catch (error: any) {
      console.error('Inquiry API error:', error);
      return {
        success: false,
        message: '문의 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      };
    }
  };

  const handleSuccessConfirm = () => {
    setShowSuccessModal(false);
    // 폼 초기화
    setCategory('');
    setSubject('');
    setMessage('');
    setEmail('');
  };

  const isFormValid = category && subject && message && email;

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div 
        className="fixed inset-0 overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 main-container"
        id="setting-inquiry-page-container"
        style={{
          paddingTop: '0px',
          marginTop: '0px',
          top: '0px'
        }}
      >
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
            left: '0px',
            right: '0px',
            width: '100vw',
            height: '56px',
            minHeight: '56px',
            maxHeight: '56px',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
            boxShadow: '0 2px 16px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            padding: '0',
            margin: '0',
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
            willChange: 'transform',
            visibility: 'visible',
            opacity: '1',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'manipulation',
            pointerEvents: 'auto'
          }}
        >
          <div className="flex items-center justify-between px-4" style={{ 
            paddingLeft: '0px', 
            paddingRight: '0px',
            height: '56px',
            minHeight: '56px',
            maxHeight: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
          <motion.div 
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex items-center space-x-3 motion-div"
          >
            <motion.button 
              onClick={handleBack}
              className="flex items-center justify-center w-10 h-10 hover:bg-gray-100 rounded-full transition-all duration-200"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                minWidth: '40px',
                minHeight: '40px',
                maxWidth: '40px',
                maxHeight: '40px'
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="w-5 h-5 text-gray-700" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                  style={{
                    width: '20px',
                    height: '20px',
                    minWidth: '20px',
                    minHeight: '20px',
                    maxWidth: '20px',
                    maxHeight: '20px',
                    display: 'block',
                    margin: '0',
                    padding: '0',
                    lineHeight: '1',
                    verticalAlign: 'middle'
                  }}
                >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
              <div className="flex flex-col justify-center" style={{ margin: '0', padding: '0' }}>
                <h1 className="text-lg font-bold text-gray-900 leading-tight" style={{ margin: '0', padding: '0', lineHeight: '1.2' }}>1:1 문의</h1>
                <p className="text-xs text-gray-500 leading-tight mt-1" style={{ margin: '0', padding: '0', lineHeight: '1.2', marginTop: '4px' }}>궁금한 점을 문의하세요</p>
              </div>
            </motion.div>
            
            <div className="flex items-center space-x-2">
              {/* 필요시 추가 버튼들을 여기에 배치 */}
            </div>
          </div>
        </AnimatedHeader>

        {/* 메인 컨텐츠 - 고정 위치 (setting/notice 페이지와 동일한 구조) */}
        <motion.div
          initial="initial"
          animate="in"
          exit="out"
          className="absolute inset-0 px-4 space-y-6 overflow-y-auto content-area safe-area-all"
          style={{
            top: '0px',
            bottom: '0px',
            left: '0',
            right: '0',
            paddingTop: '56px'
          }}
        >
          {/* 1:1 문의 정보 카드 - 주황색 테마 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="bg-[#F97315] rounded-3xl p-6 text-white shadow-xl">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <FiMessageSquare className="w-8 h-8" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h2 className="text-xl font-bold">1:1 문의</h2>
                    <div className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-full">
                      <FiMail className="w-3 h-3 text-orange-100" />
                      <span className="text-xs font-medium text-orange-100">빠른 답변</span>
                    </div>
                  </div>
                  <p className="text-orange-100 text-sm mb-1">궁금한 점을 문의하세요</p>
                  <p className="text-orange-200 text-xs">평일 09:00~18:00 답변 제공</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <FiMessageSquare className="w-4 h-4 text-orange-200" />
                      <span className="text-sm text-orange-100">문의 유형</span>
                    </div>
                    <p className="text-lg font-bold">{INQUIRY_CATEGORIES.length}가지</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <FiMail className="w-4 h-4 text-orange-200" />
                      <span className="text-sm text-orange-100">답변 방식</span>
                    </div>
                    <p className="text-lg font-bold">이메일</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 문의 양식 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
          >
            <div className="space-y-4">
              {/* 문의 유형 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">문의 유형</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {INQUIRY_CATEGORIES.map((cat) => (
                    <motion.button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`p-2 rounded-lg border-2 transition-all mobile-button ${
                        category === cat.value
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="text-sm mb-0.5">{cat.icon}</div>
                      <div className="text-xs font-medium text-gray-900 leading-tight">{cat.label}</div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  className={`w-full bg-gray-50 rounded-xl px-4 py-3 text-sm border transition-all ${
                    emailError 
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                  }`}
                  placeholder="답변받을 이메일을 입력하세요"
                />
                {emailError && (
                  <p className="text-xs text-red-500 mt-1">{emailError}</p>
                )}
              </div>

              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  placeholder="문의 제목을 입력하세요"
                />
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all resize-none"
                  placeholder="문의 내용을 자세히 작성해주세요"
                />
              </div>

              {/* 전송 버튼 */}
              <motion.button
                onClick={handleSubmit}
                disabled={!isFormValid || isSending}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 mobile-button"
                whileHover={{ scale: isFormValid ? 1.02 : 1 }}
                whileTap={{ scale: isFormValid ? 0.98 : 1 }}
              >
                {isSending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <FiSend className="w-4 h-4" />
                    <span>문의 전송</span>
                  </>
                )}
              </motion.button>  
            </div>
          </motion.div>

          {/* 문의 안내 - 컴팩트 버전 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4"
          >
            <div className="flex items-center space-x-3 mb-3">
              <h3 className="text-base font-bold text-gray-900">문의 안내</h3>
            </div>
            <ul className="space-y-1.5 text-xs text-gray-700">
              <li className="flex items-start space-x-2">
                <FiCheck className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>평일 09:00 ~ 18:00 내에 답변드립니다</span>
              </li>
              <li className="flex items-start space-x-2">
                <FiCheck className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>주말 및 공휴일은 답변이 지연될 수 있습니다</span>
              </li>
            </ul>
          </motion.div>
        </motion.div>

        {/* 성공 모달 */}
        <AlertModal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          message="문의 전송 완료"
          description="빠른 시일 내에 답변드리겠습니다."
          buttonText="확인"
          onConfirm={handleSuccessConfirm}
          type="success"
        />

        {/* 에러 모달 */}
        <AlertModal
          isOpen={showErrorModal}
          onClose={() => setShowErrorModal(false)}
          message="전송 실패"
          description={errorMessage}
          buttonText="확인"
          onConfirm={() => setShowErrorModal(false)}
          type="error"
        />
      </div>
    </>
  );
} 
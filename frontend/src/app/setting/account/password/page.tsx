'use client';
import React, { useState, useEffect } from 'react';
import { 
  FiEye, 
  FiEyeOff, 
  FiLock, 
  FiKey, 
  FiShield, 
  FiCheck, 
  FiX, 
  FiAlertTriangle,
  FiInfo,
  FiSave,
  FiHelpCircle
} from 'react-icons/fi';
import { HiCheckCircle, HiExclamationTriangle, HiInformationCircle, HiSparkles } from 'react-icons/hi2';
import { useRouter } from 'next/navigation';

// 모바일 최적화된 CSS 애니메이션
const mobileAnimations = `
html, body {
  width: 100%;
  overflow-x: hidden;
  position: relative;
}

@keyframes slideInFromBottom {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideInFromRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOutToBottom {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(100%);
    opacity: 0;
  }
}

@keyframes slideOutToRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
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

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes progressFill {
  from {
    width: 0%;
  }
  to {
    width: var(--progress-width);
  }
}

.animate-slideInFromBottom {
  animation: slideInFromBottom 0.3s ease-out forwards;
}

.animate-slideInFromRight {
  animation: slideInFromRight 0.3s ease-out forwards;
}

.animate-slideOutToBottom {
  animation: slideOutToBottom 0.3s ease-in forwards;
}

.animate-slideOutToRight {
  animation: slideOutToRight 0.3s ease-in forwards;
}

.animate-scaleIn {
  animation: scaleIn 0.2s ease-out forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.4s ease-out forwards;
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}

.animate-pulse {
  animation: pulse 2s infinite;
}

.mobile-button {
  transition: all 0.2s ease;
  touch-action: manipulation;
  user-select: none;
}

.mobile-button:active {
  transform: scale(0.98);
}

.modal-safe-area {
  padding-bottom: env(safe-area-inset-bottom);
}

.password-strength-bar {
  height: 6px;
  border-radius: 3px;
  transition: all 0.3s ease;
  animation: progressFill 0.5s ease-out;
}

.input-focus {
  transition: all 0.2s ease;
}

.input-focus:focus {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(99, 102, 241, 0.15);
}

.card-hover {
  transition: all 0.3s ease;
}

.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.initial-hidden {
  opacity: 0;
  transform: translateX(100%);
  position: relative;
  width: 100%;
  overflow: hidden;
}

.gradient-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.glass-effect {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.9);
}
`;

// 비밀번호 강도 체크 함수
const checkPasswordStrength = (password: string) => {
  if (!password) return { score: 0, text: '', color: 'gray', percentage: 0 };
  
  let score = 0;
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };
  
  Object.values(checks).forEach(check => check && score++);
  
  const percentage = (score / 5) * 100;
  
  if (score <= 2) return { score, text: '약함', color: 'red', percentage, checks };
  if (score <= 3) return { score, text: '보통', color: 'yellow', percentage, checks };
  if (score <= 4) return { score, text: '강함', color: 'green', percentage, checks };
  return { score, text: '매우 강함', color: 'emerald', percentage, checks };
};

export default function PasswordChangePage() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [nextCheck, setNextCheck] = useState('');
  const [error, setError] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showNextCheck, setShowNextCheck] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // 비밀번호 강도 체크
  const passwordStrength = checkPasswordStrength(next);
  
  // 실시간 비교
  const isMismatch = next && nextCheck && next !== nextCheck;
  const isFormValid = current && next && nextCheck && !isMismatch && passwordStrength.score >= 3;

  // 컴포넌트 마운트 감지
  useEffect(() => {
    setIsMounted(true);
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    
    return () => {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
    };
  }, []);

  // 에러 발생 시 shake 애니메이션
  useEffect(() => {
    if (error) {
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
    }
  }, [error]);

  // 페이지 진입 애니메이션
  useEffect(() => {
    if (!isMounted) return;
    
    const skipAnimation = sessionStorage.getItem('skipEnterAnimation') === 'true';
    
    if (skipAnimation) {
      sessionStorage.removeItem('skipEnterAnimation');
      setIsEntering(false);
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      const timer = setTimeout(() => {
        setIsEntering(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isMounted]);

  // 레이아웃 안정화
  useEffect(() => {
    if (isEntering === false) {
      const forceReflow = () => {
        document.body.style.height = 'auto';
        document.body.offsetHeight;
        window.scrollTo(0, 0);
      };
      requestAnimationFrame(forceReflow);
    }
  }, [isEntering]);

  const handleSave = async () => {
    if (!current || !next || !nextCheck) {
      setError('모든 항목을 입력해주세요.');
      return;
    }

    if (next !== nextCheck) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (passwordStrength.score < 3) {
      setError('비밀번호 강도가 너무 약합니다. 더 강한 비밀번호를 사용해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 모의 API 호출
      await new Promise(resolve => setTimeout(resolve, 1500));
      setShowSuccessModal(true);
    } catch (error) {
      setError('비밀번호 변경 중 오류가 발생했습니다. 다시 시도해주세요.');
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
    setShowSuccessModal(false);
    router.back();
  };

  const handleBackNavigation = () => {
    setIsExiting(true);
    sessionStorage.setItem('skipEnterAnimation', 'true');
    setTimeout(() => {
      router.back();
    }, 300);
  };

  // 비밀번호 강도 색상 매핑
  const getStrengthColor = (color: string) => {
    switch (color) {
      case 'red': return 'bg-red-500';
      case 'yellow': return 'bg-yellow-500';
      case 'green': return 'bg-green-500';
      case 'emerald': return 'bg-emerald-500';
      default: return 'bg-gray-300';
    }
  };

  const getStrengthTextColor = (color: string) => {
    switch (color) {
      case 'red': return 'text-red-600';
      case 'yellow': return 'text-yellow-600';
      case 'green': return 'text-green-600';
      case 'emerald': return 'text-emerald-600';
      default: return 'text-gray-500';
    }
  };

  return (
    <>
      <style jsx global>{mobileAnimations}</style>
      <div className={`bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen pb-10 ${
        isExiting ? 'animate-slideOutToRight' : 
        (shouldAnimate && isEntering) ? 'animate-slideInFromRight' : ''
      }`} style={{ 
        position: 'relative',
        width: '100%',
        overflow: shouldAnimate && isEntering ? 'hidden' : 'visible'
      }}>
        {/* 앱 헤더 */}
        <div className="sticky top-0 z-10 px-4 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleBackNavigation}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 mobile-button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center space-x-2">
                <FiKey className="w-5 h-5 text-indigo-600" />
                <span className="text-lg font-semibold text-gray-900">비밀번호 변경</span>
              </div>
            </div>
            <button
              onClick={() => setShowGuideModal(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 mobile-button"
            >
              <FiHelpCircle className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 보안 헤더 카드 */}
        <div className="px-4 pt-6 pb-4">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl p-6 text-white shadow-xl card-hover">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <FiShield className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h2 className="text-xl font-bold">계정 보안</h2>
                  <div className="flex items-center space-x-1 bg-yellow-400/20 px-2 py-1 rounded-full">
                    <HiSparkles className="w-3 h-3 text-yellow-300" />
                    <span className="text-xs font-medium text-yellow-100">보안</span>
                  </div>
                </div>
                <p className="text-blue-100 text-sm">안전한 비밀번호로 계정을 보호하세요</p>
              </div>
            </div>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="px-4 space-y-6 pb-20">
          {/* 현재 비밀번호 섹션 */}
          <div className="animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 px-2 flex items-center">
              <FiLock className="w-5 h-5 mr-2 text-gray-600" />
              <span>현재 비밀번호</span>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent ml-3"></div>
            </h3>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 card-hover">
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={current}
                  onChange={e => setCurrent(e.target.value)}
                  className="w-full bg-gray-50 rounded-xl px-4 py-4 pr-12 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 input-focus"
                  placeholder="현재 비밀번호를 입력하세요"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 mobile-button"
                >
                  {showCurrent ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* 새 비밀번호 섹션 */}
          <div className="animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 px-2 flex items-center">
              <FiKey className="w-5 h-5 mr-2 text-indigo-600" />
              <span>새 비밀번호</span>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent ml-3"></div>
            </h3>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 card-hover">
              <div className="space-y-4">
                {/* 새 비밀번호 입력 */}
                <div className="relative">
                  <input
                    type={showNext ? 'text' : 'password'}
                    value={next}
                    onChange={e => setNext(e.target.value)}
                    className="w-full bg-gray-50 rounded-xl px-4 py-4 pr-12 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 input-focus"
                    placeholder="새 비밀번호를 입력하세요"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNext(!showNext)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 mobile-button"
                  >
                    {showNext ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                  </button>
                </div>

                {/* 비밀번호 강도 표시 */}
                {next && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">비밀번호 강도</span>
                      <span className={`text-sm font-semibold ${getStrengthTextColor(passwordStrength.color)}`}>
                        {passwordStrength.text}
                      </span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`password-strength-bar ${getStrengthColor(passwordStrength.color)} rounded-full`}
                        style={{ 
                          width: `${passwordStrength.percentage}%`,
                          '--progress-width': `${passwordStrength.percentage}%`
                        } as React.CSSProperties}
                      ></div>
                    </div>

                    {/* 비밀번호 요구사항 체크리스트 */}
                    <div className="grid grid-cols-1 gap-2 mt-4">
                      {[
                        { key: 'length', text: '8자 이상' },
                        { key: 'lowercase', text: '소문자 포함' },
                        { key: 'uppercase', text: '대문자 포함' },
                        { key: 'number', text: '숫자 포함' },
                        { key: 'special', text: '특수문자 포함' }
                      ].map(requirement => (
                        <div key={requirement.key} className="flex items-center space-x-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            passwordStrength.checks?.[requirement.key as keyof typeof passwordStrength.checks] 
                              ? 'bg-green-500' 
                              : 'bg-gray-300'
                          }`}>
                            {passwordStrength.checks?.[requirement.key as keyof typeof passwordStrength.checks] && (
                              <FiCheck className="w-2.5 h-2.5 text-white" />
                            )}
                          </div>
                          <span className={`text-sm ${
                            passwordStrength.checks?.[requirement.key as keyof typeof passwordStrength.checks] 
                              ? 'text-green-600' 
                              : 'text-gray-500'
                          }`}>
                            {requirement.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 비밀번호 확인 섹션 */}
          <div className="animate-fadeIn" style={{ animationDelay: '0.3s' }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 px-2 flex items-center">
              <FiCheck className="w-5 h-5 mr-2 text-green-600" />
              <span>비밀번호 확인</span>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent ml-3"></div>
            </h3>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 card-hover">
              <div className="relative">
                <input
                  type={showNextCheck ? 'text' : 'password'}
                  value={nextCheck}
                  onChange={e => setNextCheck(e.target.value)}
                  className={`w-full bg-gray-50 rounded-xl px-4 py-4 pr-12 text-base border focus:outline-none focus:ring-2 input-focus ${
                    isMismatch 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-200 focus:ring-indigo-500 focus:border-indigo-500'
                  }`}
                  placeholder="새 비밀번호를 다시 입력하세요"
                />
                <button
                  type="button"
                  onClick={() => setShowNextCheck(!showNextCheck)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 mobile-button"
                >
                  {showNextCheck ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                </button>
              </div>
              
              {/* 비밀번호 일치 여부 표시 */}
              {nextCheck && (
                <div className={`mt-3 flex items-center space-x-2 ${isMismatch ? 'text-red-600' : 'text-green-600'}`}>
                  {isMismatch ? (
                    <>
                      <FiX className="w-4 h-4" />
                      <span className="text-sm">비밀번호가 일치하지 않습니다</span>
                    </>
                  ) : (
                    <>
                      <FiCheck className="w-4 h-4" />
                      <span className="text-sm">비밀번호가 일치합니다</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className={`bg-red-50 border border-red-200 rounded-2xl p-4 ${shakeError ? 'animate-shake' : ''}`}>
              <div className="flex items-center space-x-2">
                <FiAlertTriangle className="w-5 h-5 text-red-600" />
                <span className="text-red-700 font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* 저장 버튼 */}
          <div className="animate-fadeIn" style={{ animationDelay: '0.4s' }}>
            <button
              onClick={handleSave}
              disabled={!isFormValid || isLoading}
              className={`w-full py-4 rounded-2xl font-medium text-base mobile-button flex items-center justify-center space-x-2 ${
                isFormValid && !isLoading
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>변경 중...</span>
                </>
              ) : (
                <>
                  <FiSave className="w-5 h-5" />
                  <span>비밀번호 변경</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 성공 모달 */}
        {showSuccessModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => closeModal(setShowSuccessModal)}
          >
            <div 
              className={`bg-white rounded-3xl w-full max-w-sm mx-auto modal-safe-area ${
                isClosing ? 'animate-slideOutToBottom' : 'animate-slideInFromBottom'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 pb-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <HiCheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">변경 완료</h3>
                  <p className="text-gray-600">비밀번호가 성공적으로 변경되었습니다.</p>
                </div>
                
                <button
                  onClick={handleSuccessConfirm}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-medium mobile-button"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 가이드 모달 */}
        {showGuideModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50 p-4"
            onClick={() => closeModal(setShowGuideModal)}
          >
            <div 
              className={`bg-white rounded-t-3xl w-full max-w-md p-6 pb-8 shadow-2xl ${
                isClosing ? 'animate-slideOutToBottom' : 'animate-slideInFromBottom'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6"></div>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FiInfo className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">안전한 비밀번호 가이드</h3>
                <p className="text-gray-600 text-sm">보안을 위한 비밀번호 설정 방법</p>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiCheck className="w-3 h-3 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">8자 이상 사용</h4>
                    <p className="text-sm text-gray-600">길수록 더 안전합니다</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiKey className="w-3 h-3 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">다양한 문자 조합</h4>
                    <p className="text-sm text-gray-600">대소문자, 숫자, 특수문자 포함</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiShield className="w-3 h-3 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">개인정보 사용 금지</h4>
                    <p className="text-sm text-gray-600">이름, 생일, 전화번호 등 피하기</p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => closeModal(setShowGuideModal)}
                className="w-full py-4 rounded-2xl bg-gray-100 text-gray-700 font-medium mobile-button"
              >
                확인
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 
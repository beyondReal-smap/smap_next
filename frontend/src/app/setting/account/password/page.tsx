'use client';
import React, { useState, useEffect } from 'react';
import { FiEye, FiEyeOff, FiLock, FiKey, FiShield, FiCheck, FiX, FiAlertTriangle } from 'react-icons/fi';
import { HiCheckCircle, HiExclamationTriangle, HiInformationCircle } from 'react-icons/hi2';
import { useRouter } from 'next/navigation';

// 모바일 최적화된 CSS 애니메이션
const mobileAnimations = `
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

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
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
  height: 4px;
  border-radius: 2px;
  transition: all 0.3s ease;
}
`;

// 비밀번호 강도 체크 함수
const checkPasswordStrength = (password: string) => {
  if (!password) return { score: 0, text: '', color: 'gray' };
  
  let score = 0;
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };
  
  Object.values(checks).forEach(check => check && score++);
  
  if (score <= 2) return { score, text: '약함', color: 'red', checks };
  if (score <= 3) return { score, text: '보통', color: 'yellow', checks };
  if (score <= 4) return { score, text: '강함', color: 'green', checks };
  return { score, text: '매우 강함', color: 'green', checks };
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

  // 비밀번호 강도 체크
  const passwordStrength = checkPasswordStrength(next);
  
  // 실시간 비교
  const isMismatch = next && nextCheck && next !== nextCheck;
  const isFormValid = current && next && nextCheck && !isMismatch && passwordStrength.score >= 3;

  // 에러 발생 시 shake 애니메이션
  useEffect(() => {
    if (error) {
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
    }
  }, [error]);

  // 페이지 진입 애니메이션
  useEffect(() => {
    // 뒤로가기가 아닌 경우에만 애니메이션 활성화
    const skipAnimation = sessionStorage.getItem('skipEnterAnimation') === 'true';
    
    if (skipAnimation) {
      sessionStorage.removeItem('skipEnterAnimation');
      setIsEntering(false);
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      const timer = setTimeout(() => {
        setIsEntering(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []);

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
      setError('비밀번호가 너무 약합니다. 더 강한 비밀번호를 사용해주세요.');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      // 모의 API 호출
      await new Promise(resolve => setTimeout(resolve, 2000));
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

  // 뒤로가기 애니메이션 핸들러
  const handleBackNavigation = () => {
    setIsExiting(true);
    // 뒤로가기임을 표시
    sessionStorage.setItem('skipEnterAnimation', 'true');
    setTimeout(() => {
      router.back();
    }, 300);
  };

  return (
    <>
      <style jsx global>{mobileAnimations}</style>
      <div className={`bg-indigo-50 min-h-screen pb-10 ${
        isExiting ? 'animate-slideOutToRight' : 
        (shouldAnimate && isEntering) ? 'animate-slideInFromRight' : ''
      }`}>
        {/* 앱 헤더 - setting 페이지와 동일한 스타일 (고정) */}
        <div className="sticky top-0 z-10 px-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center space-x-2">
              <button 
                onClick={handleBackNavigation}
                className="px-2 py-2 hover:bg-gray-100 transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-lg font-normal text-gray-900">비밀번호 변경</span>
            </div>
            <button
              onClick={() => setShowGuideModal(true)}
              className="px-2 py-2 hover:bg-gray-100 transition-all duration-200"
            >
              <HiInformationCircle className="w-5 h-5 text-indigo-700" />
            </button>
          </div>
        </div>

        <div className="px-4 pt-6">
          {/* 보안 안내 카드 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-4 mb-6">
            <div className="flex items-center mb-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <FiShield className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="text-sm font-semibold text-blue-900">보안 안내</h3>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">
              안전한 계정 보호를 위해 정기적으로 비밀번호를 변경해주세요. <br />
              강력한 비밀번호를 사용하시기 바랍니다.
            </p>
          </div>

          {/* 비밀번호 변경 폼 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <FiLock className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">비밀번호 변경</h3>
            </div>

            <div className="space-y-6">
              {/* 현재 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  현재 비밀번호
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={current}
                    onChange={e => setCurrent(e.target.value)}
                    className="w-full bg-gray-50 rounded-xl px-4 py-4 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-12"
                    placeholder="현재 비밀번호를 입력하세요"
                  />
                  <button 
                    type="button" 
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowCurrent(!showCurrent)}
                  >
                    {showCurrent ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* 새 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  새 비밀번호
                </label>
                <div className="relative">
                  <input
                    type={showNext ? 'text' : 'password'}
                    value={next}
                    onChange={e => setNext(e.target.value)}
                    className={`w-full bg-gray-50 rounded-xl px-4 py-4 text-base border pr-12 focus:outline-none focus:ring-2 ${
                      next && passwordStrength.score < 3
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-200 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                    placeholder="새 비밀번호를 입력하세요"
                  />
                  <button 
                    type="button" 
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowNext(!showNext)}
                  >
                    {showNext ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                  </button>
                </div>
                
                {/* 비밀번호 강도 표시 */}
                {next && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-600">비밀번호 강도</span>
                      <span className={`text-xs font-medium ${
                        passwordStrength.color === 'red' ? 'text-red-600' :
                        passwordStrength.color === 'yellow' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {passwordStrength.text}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`password-strength-bar ${
                          passwordStrength.color === 'red' ? 'bg-red-500' :
                          passwordStrength.color === 'yellow' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    
                    {/* 비밀번호 요구사항 체크리스트 */}
                    <div className="mt-3 space-y-1">
                      {[
                        { key: 'length', text: '8자 이상' },
                        { key: 'lowercase', text: '소문자 포함' },
                        { key: 'uppercase', text: '대문자 포함' },
                        { key: 'number', text: '숫자 포함' },
                        { key: 'special', text: '특수문자 포함' }
                      ].map(({ key, text }) => (
                        <div key={key} className="flex items-center text-xs">
                          {passwordStrength.checks?.[key as keyof typeof passwordStrength.checks] ? (
                            <FiCheck className="w-3 h-3 text-green-500 mr-2" />
                          ) : (
                            <FiX className="w-3 h-3 text-gray-400 mr-2" />
                          )}
                          <span className={passwordStrength.checks?.[key as keyof typeof passwordStrength.checks] ? 'text-green-600' : 'text-gray-500'}>
                            {text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 새 비밀번호 확인 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  새 비밀번호 확인
                </label>
                <div className="relative">
                  <input
                    type={showNextCheck ? 'text' : 'password'}
                    value={nextCheck}
                    onChange={e => setNextCheck(e.target.value)}
                    className={`w-full bg-gray-50 rounded-xl px-4 py-4 text-base border pr-12 focus:outline-none focus:ring-2 ${
                      isMismatch
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-200 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                    placeholder="새 비밀번호를 다시 입력하세요"
                  />
                  <button 
                    type="button" 
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowNextCheck(!showNextCheck)}
                  >
                    {showNextCheck ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                  </button>
                </div>
                {isMismatch && (
                  <p className="text-red-500 text-xs mt-2 flex items-center">
                    <FiAlertTriangle className="w-3 h-3 mr-1" />
                    비밀번호가 일치하지 않습니다
                  </p>
                )}
                {nextCheck && !isMismatch && next && (
                  <p className="text-green-500 text-xs mt-2 flex items-center">
                    <FiCheck className="w-3 h-3 mr-1" />
                    비밀번호가 일치합니다
                  </p>
                )}
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className={`mt-4 p-3 bg-red-50 border border-red-200 rounded-xl ${shakeError ? 'animate-shake' : ''}`}>
                <p className="text-red-600 text-sm flex items-center">
                  <HiExclamationTriangle className="w-4 h-4 mr-2" />
                  {error}
                </p>
              </div>
            )}

            {/* 저장 버튼 */}
            <button
              onClick={handleSave}
              disabled={!isFormValid || isLoading}
              className={`w-full mt-6 py-4 rounded-xl font-medium text-base mobile-button flex items-center justify-center space-x-2 ${
                !isFormValid || isLoading
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>변경 중...</span>
                </>
              ) : (
                <>
                  <FiKey className="w-5 h-5" />
                  <span>비밀번호 변경</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 보안 가이드 모달 */}
        {showGuideModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => closeModal(setShowGuideModal)}
          >
            <div 
              className={`bg-white rounded-3xl w-full max-w-sm mx-auto modal-safe-area ${
                isClosing ? 'animate-slideOutToBottom' : 'animate-slideInFromBottom'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 pb-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiShield className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">보안 가이드</h3>
                  <p className="text-gray-600">안전한 비밀번호 만들기</p>
                </div>
                
                <div className="space-y-4 text-sm text-gray-700">
                  <div className="flex items-start">
                    <FiCheck className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>8자 이상의 길이로 설정하세요</span>
                  </div>
                  <div className="flex items-start">
                    <FiCheck className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>대문자, 소문자, 숫자, 특수문자를 조합하세요</span>
                  </div>
                  <div className="flex items-start">
                    <FiCheck className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>개인정보(이름, 생일 등)는 사용하지 마세요</span>
                  </div>
                  <div className="flex items-start">
                    <FiCheck className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>다른 사이트와 다른 비밀번호를 사용하세요</span>
                  </div>
                  <div className="flex items-start">
                    <FiCheck className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>정기적으로 비밀번호를 변경하세요</span>
                  </div>
                </div>
                
                <button
                  onClick={() => closeModal(setShowGuideModal)}
                  className="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-medium mobile-button"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 성공 모달 */}
        {showSuccessModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <div 
              className={`bg-white rounded-3xl w-full max-w-sm mx-auto modal-safe-area ${
                isClosing ? 'animate-slideOutToBottom' : 'animate-slideInFromBottom'
              }`}
            >
              <div className="p-6 pb-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <HiCheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">변경 완료</h3>
                  <p className="text-gray-600">비밀번호가 성공적으로 변경되었습니다</p>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                  <p className="text-green-700 text-sm text-center">
                    보안을 위해 다른 기기에서 자동으로 로그아웃됩니다
                  </p>
                </div>
                
                <button
                  onClick={handleSuccessConfirm}
                  className="w-full py-4 bg-green-600 text-white rounded-2xl font-medium mobile-button"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 
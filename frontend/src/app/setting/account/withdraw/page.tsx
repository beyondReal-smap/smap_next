"use client";
import React, { useState, useEffect } from 'react';
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
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

@keyframes slideLeft {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideRight {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
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

.animate-slideLeft {
  animation: slideLeft 0.3s ease-out forwards;
}

.animate-slideRight {
  animation: slideRight 0.3s ease-out forwards;
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

.step-indicator {
  transition: all 0.3s ease;
}

.step-indicator.active {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
}

.step-indicator.completed {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
}

.input-focus {
  transition: all 0.2s ease;
}

.input-focus:focus {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(239, 68, 68, 0.15);
}

.card-hover {
  transition: all 0.3s ease;
}

.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.reason-card {
  transition: all 0.2s ease;
}

.reason-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.reason-card.selected {
  background: linear-gradient(135deg, #fef2f2, #fee2e2);
  border-color: #ef4444;
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2);
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

export default function WithdrawPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1); // 1: 비밀번호 확인, 2: 탈퇴 사유, 3: 최종 확인
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [etcReason, setEtcReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState('');
  const [shakeError, setShakeError] = useState(false);
  const [agreement, setAgreement] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');

  const DB_PASSWORD = '1111'; // 실제로는 API로 검증

  const reasonList = [
    { id: 'complex', text: '서비스가 복잡해요', icon: '🤔' },
    { id: 'features', text: '필요한 기능이 없어요', icon: '⚙️' },
    { id: 'alternative', text: '다른 서비스를 이용할래요', icon: '🔄' },
    { id: 'privacy', text: '개인정보 보호 우려', icon: '🔒' },
    { id: 'frequency', text: '사용 빈도가 낮아요', icon: '📊' },
    { id: 'etc', text: '기타 이유', icon: '💭' }
  ];

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

  // 뒤로가기 애니메이션 핸들러
  const handleBackNavigation = () => {
    if (currentStep > 1) {
      setStepDirection('backward');
      setCurrentStep(currentStep - 1);
    } else {
      setIsExiting(true);
      sessionStorage.setItem('skipEnterAnimation', 'true');
      setTimeout(() => {
        router.back();
      }, 300);
    }
  };

  // 에러 발생 시 shake 애니메이션
  useEffect(() => {
    if (error) {
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
    }
  }, [error]);

  const handlePasswordNext = () => {
    if (!password) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    
    if (password !== DB_PASSWORD) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    setError('');
    setStepDirection('forward');
    setCurrentStep(2);
  };

  const handleReasonChange = (reason: string) => {
    if (reasons.includes(reason)) {
      setReasons(reasons.filter(r => r !== reason));
    } else {
      setReasons([...reasons, reason]);
    }
  };

  const handleReasonNext = () => {
    if (reasons.length === 0) {
      setError('탈퇴 사유를 하나 이상 선택해주세요.');
      return;
    }
    
    if (reasons.includes('기타 이유') && !etcReason.trim()) {
      setError('기타 사유를 입력해주세요.');
      return;
    }
    
    setError('');
    setStepDirection('forward');
    setCurrentStep(3);
  };

  const handleFinalWithdraw = async () => {
    if (!agreement) {
      setError('탈퇴 안내사항에 동의해주세요.');
      return;
    }

    setShowFinalModal(true);
  };

  const handleConfirmWithdraw = async () => {
    setIsLoading(true);
    setShowFinalModal(false);
    
    try {
      // 모의 API 호출
      await new Promise(resolve => setTimeout(resolve, 2000));
      setShowSuccessModal(true);
    } catch (error) {
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
    router.push('/login');
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-4 mb-8">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold step-indicator ${
              step < currentStep ? 'completed' : step === currentStep ? 'active' : 'bg-gray-200 text-gray-500'
            }`}
          >
            {step < currentStep ? <FiCheck className="w-5 h-5" /> : step}
          </div>
          {step < 3 && (
            <div className={`w-8 h-1 mx-2 rounded-full ${
              step < currentStep ? 'bg-green-500' : 'bg-gray-200'
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
      <style jsx global>{mobileAnimations}</style>
      <div className={`bg-gradient-to-br from-red-50 via-white to-orange-50 min-h-screen pb-10 ${
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
                <FiArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div className="flex items-center space-x-2">
                <FiTrash2 className="w-5 h-5 text-red-600" />
                <span className="text-lg font-semibold text-gray-900">회원탈퇴</span>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {currentStep}/3
            </div>
          </div>
        </div>

        {/* 경고 헤더 카드 */}
        <div className="px-4 pt-6 pb-4">
          <div className="bg-gradient-to-r from-red-500 to-orange-600 rounded-3xl p-6 text-white shadow-xl card-hover">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <FiAlertTriangle className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h2 className="text-xl font-bold">회원탈퇴</h2>
                  <div className="flex items-center space-x-1 bg-yellow-400/20 px-2 py-1 rounded-full">
                    <HiSparkles className="w-3 h-3 text-yellow-300" />
                    <span className="text-xs font-medium text-yellow-100">주의</span>
                  </div>
                </div>
                <p className="text-red-100 text-sm">신중하게 결정해주세요</p>
              </div>
            </div>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="px-4 space-y-6 pb-20">
          {/* 단계 표시기 */}
          <div className="animate-fadeIn">
            {renderStepIndicator()}
          </div>

          {/* 단계별 제목 */}
          <div className="text-center animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{getStepTitle()}</h2>
            <p className="text-gray-600">{getStepDescription()}</p>
          </div>

          {/* 단계별 컨텐츠 */}
          <div className={`${stepDirection === 'forward' ? 'animate-slideLeft' : 'animate-slideRight'}`}>
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* 비밀번호 입력 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 card-hover">
                  <div className="flex items-center mb-4">
                    <FiLock className="w-5 h-5 mr-2 text-red-600" />
                    <h3 className="text-lg font-semibold text-gray-900">비밀번호 확인</h3>
                  </div>
                  
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-gray-50 rounded-xl px-4 py-4 pr-12 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 input-focus"
                      placeholder="현재 비밀번호를 입력하세요"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 mobile-button"
                    >
                      {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* 보안 안내 */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <div className="flex items-start space-x-3">
                    <FiShield className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">보안 확인</h4>
                      <p className="text-sm text-blue-700">계정 보안을 위해 본인 확인이 필요합니다.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                {/* 탈퇴 사유 선택 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 card-hover">
                  <div className="flex items-center mb-4">
                    <FiInfo className="w-5 h-5 mr-2 text-orange-600" />
                    <h3 className="text-lg font-semibold text-gray-900">탈퇴 사유</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {reasonList.map((reason) => (
                      <button
                        key={reason.id}
                        onClick={() => handleReasonChange(reason.text)}
                        className={`reason-card p-4 rounded-xl border-2 text-left mobile-button ${
                          reasons.includes(reason.text) ? 'selected' : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-xl">{reason.icon}</span>
                          <span className="font-medium text-gray-900">{reason.text}</span>
                          {reasons.includes(reason.text) && (
                            <FiCheck className="w-5 h-5 text-red-600 ml-auto" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* 기타 사유 입력 */}
                  {reasons.includes('기타 이유') && (
                    <div className="mt-4">
                      <textarea
                        value={etcReason}
                        onChange={e => setEtcReason(e.target.value)}
                        className="w-full bg-gray-50 rounded-xl px-4 py-4 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 input-focus resize-none"
                        placeholder="기타 사유를 자세히 알려주세요"
                        rows={3}
                      />
                    </div>
                  )}
                </div>

                {/* 개선 제안 */}
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <div className="flex items-start space-x-3">
                    <FiHeart className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-900 mb-1">소중한 의견 감사합니다</h4>
                      <p className="text-sm text-green-700">더 나은 서비스를 위해 노력하겠습니다.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                {/* 탈퇴 안내사항 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 card-hover">
                  <div className="flex items-center mb-4">
                    <FiAlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                    <h3 className="text-lg font-semibold text-gray-900">탈퇴 안내사항</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiX className="w-3 h-3 text-red-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">계정 정보 삭제</h4>
                        <p className="text-sm text-gray-600">모든 개인정보와 이용 기록이 영구 삭제됩니다.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiX className="w-3 h-3 text-red-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">데이터 복구 불가</h4>
                        <p className="text-sm text-gray-600">탈퇴 후에는 어떠한 방법으로도 복구할 수 없습니다.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiX className="w-3 h-3 text-red-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">서비스 이용 제한</h4>
                        <p className="text-sm text-gray-600">탈퇴 후 30일간 동일한 정보로 재가입이 제한됩니다.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 동의 체크박스 */}
                <div className="bg-gray-50 rounded-2xl p-4">
                  <label className="flex items-start space-x-3 cursor-pointer mobile-button">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={agreement}
                        onChange={e => setAgreement(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        agreement ? 'bg-red-500 border-red-500' : 'border-gray-300'
                      }`}>
                        {agreement && <FiCheck className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <span className="text-sm text-gray-700 leading-relaxed">
                      위 안내사항을 모두 확인했으며, 회원탈퇴에 동의합니다.
                    </span>
                  </label>
                </div>
              </div>
            )}
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

          {/* 액션 버튼 */}
          <div className="animate-fadeIn" style={{ animationDelay: '0.4s' }}>
            {currentStep < 3 ? (
              <button
                onClick={currentStep === 1 ? handlePasswordNext : handleReasonNext}
                disabled={
                  (currentStep === 1 && !password) ||
                  (currentStep === 2 && reasons.length === 0) ||
                  (currentStep === 2 && reasons.includes('기타 이유') && !etcReason.trim())
                }
                className={`w-full py-4 rounded-2xl font-medium text-base mobile-button flex items-center justify-center space-x-2 ${
                  (currentStep === 1 && password) ||
                  (currentStep === 2 && reasons.length > 0 && (!reasons.includes('기타 이유') || etcReason.trim()))
                    ? 'bg-gradient-to-r from-red-500 to-orange-600 text-white shadow-lg hover:shadow-xl'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <span>다음 단계</span>
                <FiArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleFinalWithdraw}
                disabled={!agreement || isLoading}
                className={`w-full py-4 rounded-2xl font-medium text-base mobile-button flex items-center justify-center space-x-2 ${
                  agreement && !isLoading
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg hover:shadow-xl animate-pulse'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>처리 중...</span>
                  </>
                ) : (
                  <>
                    <FiTrash2 className="w-5 h-5" />
                    <span>회원탈퇴</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 최종 확인 모달 */}
        {showFinalModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => closeModal(setShowFinalModal)}
          >
            <div 
              className={`bg-white rounded-3xl w-full max-w-sm mx-auto modal-safe-area ${
                isClosing ? 'animate-slideOutToBottom' : 'animate-slideInFromBottom'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 pb-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiAlertTriangle className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">정말 탈퇴하시겠습니까?</h3>
                  <p className="text-gray-600">이 작업은 되돌릴 수 없습니다.</p>
                </div>
                
                <div className="space-y-3">
                  <button
                    onClick={handleConfirmWithdraw}
                    className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl font-medium mobile-button"
                  >
                    탈퇴하기
                  </button>
                  <button
                    onClick={() => closeModal(setShowFinalModal)}
                    className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-medium mobile-button"
                  >
                    취소
                  </button>
                </div>
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
                  <h3 className="text-xl font-bold text-gray-900 mb-2">탈퇴 완료</h3>
                  <p className="text-gray-600">그동안 서비스를 이용해주셔서 감사했습니다.</p>
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
      </div>
    </>
  );
} 
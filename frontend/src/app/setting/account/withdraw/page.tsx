"use client";
import React, { useState, useEffect } from 'react';
import { FiEye, FiEyeOff, FiAlertTriangle, FiShield, FiTrash2, FiCheck, FiX, FiUser, FiHeart } from 'react-icons/fi';
import { HiExclamationTriangle, HiCheckCircle, HiInformationCircle } from 'react-icons/hi2';
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

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
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

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out forwards;
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
}

.step-indicator.completed {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
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

  const DB_PASSWORD = '1111'; // 실제로는 API로 검증

  const reasonList = [
    '서비스가 복잡해요',
    '필요한 기능이 없어요',
    '다른 서비스를 이용할래요',
    '개인정보 보호 우려',
    '사용 빈도가 낮아요',
    '기타 이유'
  ];

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

  // 뒤로가기 애니메이션 핸들러
  const handleBackNavigation = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      setIsExiting(true);
      // 뒤로가기임을 표시
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

  const handlePasswordVerify = () => {
    if (!password) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    if (password !== DB_PASSWORD) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setError('');
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
    if (reasons.length === 0 && !etcReason.trim()) {
      setError('탈퇴 사유를 하나 이상 선택하거나 기타 사유를 입력해주세요.');
      return;
    }
    setError('');
    setCurrentStep(3);
  };

  const handleFinalWithdraw = async () => {
    if (!agreement) {
      setError('탈퇴 안내사항에 동의해주세요.');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      // 모의 API 호출
      await new Promise(resolve => setTimeout(resolve, 3000));
      setShowFinalModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      setError('회원탈퇴 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
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
    router.push('/login');
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((step, index) => (
        <React.Fragment key={step}>
          <div className={`step-indicator w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step < currentStep ? 'completed' : 
            step === currentStep ? 'active' : 
            'bg-gray-200 text-gray-500'
          }`}>
            {step < currentStep ? <FiCheck className="w-4 h-4" /> : step}
          </div>
          {index < 2 && (
            <div className={`w-8 h-0.5 mx-2 ${
              step < currentStep ? 'bg-green-500' : 'bg-gray-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

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
              <span className="text-lg font-normal text-gray-900">회원탈퇴</span>
            </div>
          </div>
        </div>

        <div className="px-4 pt-6">
          {/* 단계 표시기 */}
          {renderStepIndicator()}

          {/* 경고 안내 카드 */}
          <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl border border-red-200 p-4 mb-6">
            <div className="flex items-center mb-2">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <HiExclamationTriangle className="w-4 h-4 text-red-600" />
              </div>
              <h3 className="text-sm font-semibold text-red-900">중요 안내</h3>
            </div>
            <p className="text-xs text-red-700 leading-relaxed">
              회원탈퇴 시 모든 데이터가 영구 삭제되며 복구가 불가능합니다. <br />
              신중하게 결정해주세요.
            </p>
          </div>

          {/* Step 1: 비밀번호 확인 */}
          {currentStep === 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 animate-fadeIn">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <FiShield className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">본인 확인</h3>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 text-base leading-relaxed mb-4">
                  본인 확인을 위해 현재 사용 중인 <br /> 비밀번호를 입력해주세요.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비밀번호
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-gray-50 rounded-xl px-4 py-4 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-12"
                      placeholder="현재 비밀번호를 입력하세요"
                    />
                    <button 
                      type="button" 
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                    </button>
                  </div>
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

              <button
                onClick={handlePasswordVerify}
                disabled={!password}
                className={`w-full mt-6 py-4 rounded-xl font-medium text-base mobile-button flex items-center justify-center space-x-2 ${
                  !password
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
                }`}
              >
                <FiCheck className="w-5 h-5" />
                <span>비밀번호 확인</span>
              </button>
            </div>
          )}

          {/* Step 2: 탈퇴 사유 */}
          {currentStep === 2 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 animate-fadeIn">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                  <HiInformationCircle className="w-5 h-5 text-yellow-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">탈퇴 사유</h3>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 text-base leading-relaxed mb-4">
                  서비스 개선을 위해 탈퇴 사유를 알려주세요. (선택사항)
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    탈퇴 사유 (복수 선택 가능)
                  </label>
                  <div className="space-y-3">
                    {reasonList.map((reason) => (
                      <label key={reason} className="flex items-center p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reasons.includes(reason)}
                          onChange={() => handleReasonChange(reason)}
                          className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-3"
                        />
                        <span className="text-gray-700 text-sm">{reason}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    기타 의견 (선택사항)
                  </label>
                  <textarea
                    value={etcReason}
                    onChange={e => setEtcReason(e.target.value)}
                    className="w-full bg-gray-50 rounded-xl px-4 py-4 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    placeholder="추가로 전달하고 싶은 의견이 있다면 자유롭게 작성해주세요"
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 mt-1 text-right">{etcReason.length}/500</p>
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className={`mb-4 p-3 bg-red-50 border border-red-200 rounded-xl ${shakeError ? 'animate-shake' : ''}`}>
                  <p className="text-red-600 text-sm flex items-center">
                    <HiExclamationTriangle className="w-4 h-4 mr-2" />
                    {error}
                  </p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 py-4 rounded-xl bg-gray-100 text-gray-700 font-medium mobile-button"
                >
                  이전
                </button>
                <button
                  onClick={handleReasonNext}
                  className="flex-1 py-4 rounded-xl bg-indigo-600 text-white font-medium mobile-button shadow-lg"
                >
                  다음
                </button>
              </div>
            </div>
          )}

          {/* Step 3: 최종 확인 */}
          {currentStep === 3 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 animate-fadeIn">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <FiTrash2 className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">최종 확인</h3>
              </div>

              {/* 탈퇴 안내사항 */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <div className="flex items-center mb-3">
                  <HiExclamationTriangle className="w-5 h-5 text-red-600 mr-2" />
                  <h4 className="font-semibold text-red-900">탈퇴 시 삭제되는 정보</h4>
                </div>
                <ul className="text-sm text-red-700 space-y-2">
                  <li className="flex items-start">
                    <FiX className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                    <span>계정 정보 및 프로필 데이터</span>
                  </li>
                  <li className="flex items-start">
                    <FiX className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                    <span>그룹 참여 기록 및 일정 데이터</span>
                  </li>
                  <li className="flex items-start">
                    <FiX className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                    <span>위치 정보 및 활동 기록</span>
                  </li>
                  <li className="flex items-start">
                    <FiX className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                    <span>설정 및 개인화 정보</span>
                  </li>
                </ul>
              </div>

              {/* 동의 체크박스 */}
              <div className="mb-6">
                <label className="flex items-start p-4 bg-gray-50 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreement}
                    onChange={e => setAgreement(e.target.checked)}
                    className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 mr-3 mt-0.5"
                  />
                  <span className="text-sm text-gray-700 leading-relaxed">
                    위 안내사항을 모두 확인했으며, 회원탈퇴로 인한 데이터 삭제에 동의합니다. 
                    탈퇴 후에는 데이터 복구가 불가능함을 이해합니다.
                  </span>
                </label>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className={`mb-4 p-3 bg-red-50 border border-red-200 rounded-xl ${shakeError ? 'animate-shake' : ''}`}>
                  <p className="text-red-600 text-sm flex items-center">
                    <HiExclamationTriangle className="w-4 h-4 mr-2" />
                    {error}
                  </p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 py-4 rounded-xl bg-gray-100 text-gray-700 font-medium mobile-button"
                >
                  이전
                </button>
                <button
                  onClick={() => setShowFinalModal(true)}
                  disabled={!agreement}
                  className={`flex-1 py-4 rounded-xl font-medium mobile-button flex items-center justify-center space-x-2 ${
                    !agreement
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700 shadow-lg'
                  }`}
                >
                  <FiTrash2 className="w-5 h-5" />
                  <span>회원탈퇴</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 최종 확인 모달 */}
        {showFinalModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !isLoading && closeModal(setShowFinalModal)}
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
                    <FiTrash2 className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">정말 탈퇴하시겠습니까?</h3>
                  <p className="text-gray-600">이 작업은 되돌릴 수 없습니다</p>
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                  <p className="text-red-700 text-sm text-center font-medium">
                    탈퇴 후 모든 데이터가 영구 삭제됩니다
                  </p>
                </div>
                
                <div className="space-y-3">
                  <button
                    onClick={handleFinalWithdraw}
                    disabled={isLoading}
                    className={`w-full py-4 rounded-2xl font-medium mobile-button flex items-center justify-center space-x-2 ${
                      isLoading
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>탈퇴 처리 중...</span>
                      </>
                    ) : (
                      <>
                        <FiTrash2 className="w-5 h-5" />
                        <span>네, 탈퇴합니다</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => !isLoading && closeModal(setShowFinalModal)}
                    disabled={isLoading}
                    className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-medium mobile-button"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 탈퇴 완료 모달 */}
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
                  <p className="text-gray-600">회원탈퇴가 완료되었습니다</p>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-center mb-2">
                    <FiHeart className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="text-blue-900 font-medium text-sm">감사합니다</span>
                  </div>
                  <p className="text-blue-700 text-sm text-center">
                    그동안 SMAP을 이용해주셔서 감사했습니다. 
                    언제든 다시 돌아오세요!
                  </p>
                </div>
                
                <button
                  onClick={handleSuccessConfirm}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-medium mobile-button"
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
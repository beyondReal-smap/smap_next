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

  // 페이지 마운트 시 스크롤 설정
  useEffect(() => {
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflowY = 'auto';
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
    router.back();
  };

  const handleBackNavigation = () => {
    if (currentStep > 1) {
      setStepDirection('backward');
      setCurrentStep(currentStep - 1);
      setError('');
    } else {
      router.back();
    }
  };

  const handlePasswordNext = async () => {
    if (!password) {
      setError('비밀번호를 입력해주세요');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // JWT 토큰 확인
      const token = localStorage.getItem('auth-token');
      console.log('[WITHDRAW] JWT 토큰 확인:', token);
      
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
    <div className="flex items-center justify-center space-x-4 mb-2">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
              step < currentStep 
                ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg' 
                : step === currentStep 
                ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg' 
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {step < currentStep ? <FiCheck className="w-5 h-5" /> : step}
          </div>
          {step < 3 && (
            <div className={`w-8 h-1 mx-2 rounded-full transition-all duration-300 ${
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
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
      {/* 헤더 - password 페이지와 동일한 애니메이션 */}
      <motion.header 
        initial={{ y: -100, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ 
          delay: 0.2, 
          duration: 0.8, 
          ease: [0.25, 0.46, 0.45, 0.94],
          opacity: { duration: 0.6 },
          scale: { duration: 0.6 }
        }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-sm"
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          width: '100%'
        }}
      >
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex items-center justify-between h-16 px-4"
        >
          <div className="flex items-center space-x-3">
            <motion.button 
              onClick={handleBackNavigation}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="flex items-center space-x-3"
            >
              <div>
                <h1 className="text-lg font-bold text-gray-900">회원탈퇴</h1>
                <p className="text-xs text-gray-500">신중하게 결정해주세요</p>
              </div>
            </motion.div>
          </div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="text-sm text-gray-500"
          >
            {currentStep}/3
          </motion.div>
        </motion.div>
      </motion.header>

      {/* 스크롤 가능한 메인 컨텐츠 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="px-4 pt-20 space-y-4 pb-20"
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
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                 style={{ backgroundColor: '#FEE2E2' }}>
              <FiAlertTriangle className="w-3 h-3" style={{ color: '#DC2626' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: '#7F1D1D' }}>탈퇴 주의사항</h3>
              <ul className="text-xs space-y-0.5" style={{ color: '#B91C1C' }}>
                <li>• 계정 정보 영구 삭제</li>
                <li>• 데이터 복구 불가능</li>
                <li>• 30일간 재가입 제한</li>
              </ul>
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
                        className={`block w-full pl-9 pr-10 py-3 border ${
                          error && !password ? 'border-red-300' : 'border-gray-300'
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
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                       style={{ backgroundColor: '#FED7AA' }}>
                    <FiShield className="w-3 h-3" style={{ color: '#F97315' }} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1" style={{ color: '#9A3412' }}>보안 확인</h4>
                    <p className="text-xs" style={{ color: '#C2410C' }}>계정 보안을 위해 본인 확인이 필요합니다.</p>
                  </div>
                </div>
              </div>
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
                      className={`p-3 rounded-lg border-2 text-left transition-all duration-200 ${
                        reasons.includes(reason.text) 
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
                      <h4 className="text-sm font-medium text-gray-900 mb-0.5">계정 정보 삭제</h4>
                      <p className="text-xs text-gray-600">모든 개인정보와 이용 기록이 영구 삭제됩니다.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FiX className="w-2.5 h-2.5 text-red-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-0.5">데이터 복구 불가</h4>
                      <p className="text-xs text-gray-600">탈퇴 후에는 어떠한 방법으로도 복구할 수 없습니다.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FiX className="w-2.5 h-2.5 text-red-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-0.5">서비스 이용 제한</h4>
                      <p className="text-xs text-gray-600">탈퇴 후 30일간 동일한 정보로 재가입이 제한됩니다.</p>
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
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                      agreement ? 'bg-red-500 border-red-500' : 'border-gray-300'
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
                 (currentStep === 1 && !password) ||
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
      {showFinalModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl w-full max-w-xs mx-auto"
          >
            <div className="p-4">
              <div className="text-center mb-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <FiAlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">정말 탈퇴하시겠습니까?</h3>
                <p className="text-xs text-gray-600">
                  이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
              
              <div className="space-y-2">
                <button
                  onClick={handleConfirmWithdraw}
                  className="w-full py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  탈퇴하기
                </button>
                <button
                  onClick={() => setShowFinalModal(false)}
                  className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 성공 모달 */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl w-full max-w-xs mx-auto"
          >
            <div className="p-4">
              <div className="text-center mb-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <HiCheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">탈퇴 완료</h3>
                <p className="text-xs text-gray-600">
                  그동안 서비스를 이용해주셔서 감사했습니다.
                </p>
              </div>
              
              <button
                onClick={handleSuccessConfirm}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                확인
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
} 
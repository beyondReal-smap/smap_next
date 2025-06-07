'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUser, 
  FiPhone, 
  FiMail, 
  FiLock, 
  FiCalendar,
  FiMapPin,
  FiCheck,
  FiArrowLeft,
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiShield,
  FiFileText,
  FiHeart
} from 'react-icons/fi';

// 회원가입 단계 정의
const REGISTER_STEPS = {
  TERMS: 'terms',
  PHONE: 'phone',
  VERIFICATION: 'verification',
  BASIC_INFO: 'basic_info',
  PROFILE: 'profile',
  LOCATION: 'location',
  COMPLETE: 'complete'
};

// 약관 데이터
const TERMS_DATA = [
  {
    id: 'mt_agree1',
    title: '서비스 이용약관',
    required: true,
    content: 'SMAP 서비스 이용에 관한 기본 약관입니다.'
  },
  {
    id: 'mt_agree2', 
    title: '개인정보 처리방침',
    required: true,
    content: '개인정보 수집, 이용, 보관에 관한 정책입니다.'
  },
  {
    id: 'mt_agree3',
    title: '위치기반서비스 이용약관',
    required: true,
    content: '위치정보 수집 및 이용에 관한 약관입니다.'
  },
  {
    id: 'mt_agree4',
    title: '개인정보 제3자 제공 동의',
    required: false,
    content: '서비스 향상을 위한 개인정보 제3자 제공 동의입니다.'
  },
  {
    id: 'mt_agree5',
    title: '마케팅 정보 수신 동의',
    required: false,
    content: '이벤트, 혜택 등 마케팅 정보 수신 동의입니다.'
  }
];

interface RegisterData {
  // 약관 동의
  mt_agree1: boolean;
  mt_agree2: boolean;
  mt_agree3: boolean;
  mt_agree4: boolean;
  mt_agree5: boolean;
  
  // 기본 정보
  mt_id: string; // 전화번호
  mt_pwd: string;
  mt_name: string;
  mt_nickname: string;
  mt_email: string;
  mt_birth: string;
  mt_gender: number | null;
  
  // 위치 정보
  mt_lat: number | null;
  mt_long: number | null;
  
  // 기타
  mt_push1: boolean;
  verification_code: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(REGISTER_STEPS.TERMS);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationTimer, setVerificationTimer] = useState(0);
  
  const [registerData, setRegisterData] = useState<RegisterData>({
    mt_agree1: false,
    mt_agree2: false,
    mt_agree3: false,
    mt_agree4: false,
    mt_agree5: false,
    mt_id: '',
    mt_pwd: '',
    mt_name: '',
    mt_nickname: '',
    mt_email: '',
    mt_birth: '',
    mt_gender: null,
    mt_lat: null,
    mt_long: null,
    mt_push1: true,
    verification_code: ''
  });

  // 인증번호 타이머
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (verificationTimer > 0) {
      interval = setInterval(() => {
        setVerificationTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [verificationTimer]);

  // 뒤로가기
  const handleBack = () => {
    if (currentStep === REGISTER_STEPS.TERMS) {
      router.back();
    } else {
      const steps = Object.values(REGISTER_STEPS);
      const currentIndex = steps.indexOf(currentStep);
      if (currentIndex > 0) {
        setCurrentStep(steps[currentIndex - 1]);
      }
    }
  };

  // 다음 단계
  const handleNext = () => {
    const steps = Object.values(REGISTER_STEPS);
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  // 약관 전체 동의
  const handleAllAgree = (checked: boolean) => {
    setRegisterData(prev => ({
      ...prev,
      mt_agree1: checked,
      mt_agree2: checked,
      mt_agree3: checked,
      mt_agree4: checked,
      mt_agree5: checked
    }));
  };

  // 개별 약관 동의
  const handleTermAgree = (termId: string, checked: boolean) => {
    setRegisterData(prev => ({
      ...prev,
      [termId]: checked
    }));
  };

  // 필수 약관 동의 확인
  const isRequiredTermsAgreed = () => {
    return registerData.mt_agree1 && registerData.mt_agree2 && registerData.mt_agree3;
  };

  // 전화번호 인증 요청
  const handleSendVerification = async () => {
    if (!registerData.mt_id) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send_verification',
          phone: registerData.mt_id
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setVerificationSent(true);
        setVerificationTimer(180); // 3분
      } else {
        throw new Error(data.error || '인증번호 발송에 실패했습니다.');
      }
    } catch (error) {
      console.error('인증번호 발송 실패:', error);
      alert(error instanceof Error ? error.message : '인증번호 발송에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 인증번호 확인
  const handleVerifyCode = async () => {
    if (!registerData.verification_code) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'verify_code',
          phone: registerData.mt_id,
          code: registerData.verification_code
        }),
      });

      const data = await response.json();
      if (response.ok) {
        handleNext();
      } else {
        throw new Error(data.error || '인증번호가 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('인증번호 확인 실패:', error);
      alert(error instanceof Error ? error.message : '인증번호 확인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 위치 정보 가져오기
  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setRegisterData(prev => ({
            ...prev,
            mt_lat: position.coords.latitude,
            mt_long: position.coords.longitude
          }));
        },
        (error) => {
          console.error('위치 정보 가져오기 실패:', error);
        }
      );
    }
  };

  // 회원가입 완료
  const handleRegister = async () => {
    setIsLoading(true);
    try {
      // API 호출
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...registerData,
          mt_type: 1, // 일반 회원
          mt_level: 2, // 일반(무료)
          mt_status: 1, // 정상
          mt_onboarding: 'N',
          mt_show: 'Y'
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setCurrentStep(REGISTER_STEPS.COMPLETE);
      } else {
        throw new Error(data.error || '회원가입에 실패했습니다.');
      }
    } catch (error) {
      console.error('회원가입 실패:', error);
      alert(error instanceof Error ? error.message : '회원가입에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 단계별 유효성 검사
  const isStepValid = () => {
    switch (currentStep) {
      case REGISTER_STEPS.TERMS:
        return isRequiredTermsAgreed();
      case REGISTER_STEPS.PHONE:
        return registerData.mt_id.length >= 10;
      case REGISTER_STEPS.VERIFICATION:
        return registerData.verification_code.length === 6;
      case REGISTER_STEPS.BASIC_INFO:
        return registerData.mt_pwd && 
               registerData.mt_name && 
               registerData.mt_nickname &&
               passwordConfirm === registerData.mt_pwd;
      case REGISTER_STEPS.PROFILE:
        return registerData.mt_birth && registerData.mt_gender !== null;
      case REGISTER_STEPS.LOCATION:
        return true; // 선택사항
      default:
        return false;
    }
  };

  // 진행률 계산
  const getProgress = () => {
    const steps = Object.values(REGISTER_STEPS);
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / (steps.length - 1)) * 100; // COMPLETE 제외
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* 헤더 */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100"
      >
        <div className="flex items-center justify-between h-16 px-4">
          <motion.button 
            onClick={handleBack}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-700" />
          </motion.button>
          
          <div className="text-center">
            <h1 className="text-lg font-bold text-gray-900">회원가입</h1>
            {currentStep !== REGISTER_STEPS.COMPLETE && (
              <p className="text-xs text-gray-500">
                {Object.values(REGISTER_STEPS).indexOf(currentStep) + 1} / {Object.values(REGISTER_STEPS).length - 1}
              </p>
            )}
          </div>
          
          <div className="w-9" /> {/* 균형을 위한 빈 공간 */}
        </div>
        
        {/* 진행률 바 */}
        {currentStep !== REGISTER_STEPS.COMPLETE && (
          <div className="h-1 bg-gray-200">
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${getProgress()}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}
      </motion.header>

      {/* 메인 콘텐츠 */}
      <div className="pt-16 pb-20 px-4">
        <AnimatePresence mode="wait">
          {/* 약관 동의 단계 */}
          {currentStep === REGISTER_STEPS.TERMS && (
            <motion.div
              key="terms"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-md mx-auto pt-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiFileText className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">서비스 이용약관</h2>
                <p className="text-gray-600">SMAP 서비스 이용을 위해 약관에 동의해주세요</p>
              </div>

              <div className="space-y-4">
                {/* 전체 동의 */}
                <div className="bg-white rounded-2xl p-4 border-2 border-indigo-100">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean)}
                        onChange={(e) => handleAllAgree(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${
                        TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean)
                          ? 'bg-indigo-500 border-indigo-500' 
                          : 'border-gray-300'
                      }`}>
                        {TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean) && (
                          <FiCheck className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-gray-900">전체 동의</span>
                  </label>
                </div>

                {/* 개별 약관 */}
                {TERMS_DATA.map((term) => (
                  <div key={term.id} className="bg-white rounded-xl p-4 border border-gray-100">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={registerData[term.id as keyof RegisterData] as boolean}
                            onChange={(e) => handleTermAgree(term.id, e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            registerData[term.id as keyof RegisterData]
                              ? 'bg-indigo-500 border-indigo-500' 
                              : 'border-gray-300'
                          }`}>
                            {registerData[term.id as keyof RegisterData] && (
                              <FiCheck className="w-3 h-3 text-white" />
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">{term.title}</span>
                            {term.required && (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">필수</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{term.content}</p>
                        </div>
                      </div>
                      <FiArrowRight className="w-4 h-4 text-gray-400" />
                    </label>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 전화번호 입력 단계 */}
          {currentStep === REGISTER_STEPS.PHONE && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-md mx-auto pt-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiPhone className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">전화번호 인증</h2>
                <p className="text-gray-600">본인 확인을 위해 전화번호를 입력해주세요</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    전화번호
                  </label>
                  <div className="relative">
                    <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      value={registerData.mt_id}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, mt_id: e.target.value }))}
                      placeholder="010-1234-5678"
                      className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <motion.button
                  onClick={handleSendVerification}
                  disabled={!registerData.mt_id || isLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '발송 중...' : '인증번호 발송'}
                </motion.button>

                {verificationSent && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-50 border border-green-200 rounded-xl p-4"
                  >
                    <div className="flex items-center space-x-2">
                      <FiCheck className="w-5 h-5 text-green-500" />
                      <span className="text-green-700 font-medium">인증번호가 발송되었습니다</span>
                    </div>
                    <p className="text-green-600 text-sm mt-1">
                      {registerData.mt_id}로 인증번호를 발송했습니다
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* 인증번호 확인 단계 */}
          {currentStep === REGISTER_STEPS.VERIFICATION && (
            <motion.div
              key="verification"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-md mx-auto pt-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiShield className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">인증번호 입력</h2>
                <p className="text-gray-600">
                  {registerData.mt_id}로 발송된<br />
                  인증번호 6자리를 입력해주세요
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    인증번호
                  </label>
                  <input
                    type="text"
                    value={registerData.verification_code}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, verification_code: e.target.value }))}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
                  />
                  {verificationTimer > 0 && (
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      {Math.floor(verificationTimer / 60)}:{(verificationTimer % 60).toString().padStart(2, '0')} 후 만료
                    </p>
                  )}
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleSendVerification}
                    disabled={isLoading}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                  >
                    재발송
                  </button>
                  <motion.button
                    onClick={handleVerifyCode}
                    disabled={!registerData.verification_code || isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold disabled:opacity-50"
                  >
                    {isLoading ? '확인 중...' : '확인'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* 기본 정보 입력 단계 */}
          {currentStep === REGISTER_STEPS.BASIC_INFO && (
            <motion.div
              key="basic_info"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-md mx-auto pt-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiUser className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">기본 정보</h2>
                <p className="text-gray-600">서비스 이용을 위한 기본 정보를 입력해주세요</p>
              </div>

              <div className="space-y-4">
                {/* 비밀번호 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비밀번호
                  </label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={registerData.mt_pwd}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, mt_pwd: e.target.value }))}
                      placeholder="8자 이상 입력해주세요"
                      className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* 비밀번호 확인 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비밀번호 확인
                  </label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type={showPasswordConfirm ? 'text' : 'password'}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="비밀번호를 다시 입력해주세요"
                      className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    >
                      {showPasswordConfirm ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                    </button>
                  </div>
                  {passwordConfirm && passwordConfirm !== registerData.mt_pwd && (
                    <p className="text-red-500 text-sm mt-1">비밀번호가 일치하지 않습니다</p>
                  )}
                </div>

                {/* 이름 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이름
                  </label>
                  <input
                    type="text"
                    value={registerData.mt_name}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, mt_name: e.target.value }))}
                    placeholder="실명을 입력해주세요"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* 닉네임 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    닉네임
                  </label>
                  <input
                    type="text"
                    value={registerData.mt_nickname}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, mt_nickname: e.target.value }))}
                    placeholder="다른 사용자에게 표시될 닉네임"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* 이메일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이메일 (선택)
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      value={registerData.mt_email}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, mt_email: e.target.value }))}
                      placeholder="example@email.com"
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 프로필 정보 단계 */}
          {currentStep === REGISTER_STEPS.PROFILE && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-md mx-auto pt-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiHeart className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">프로필 정보</h2>
                <p className="text-gray-600">추가 정보를 입력해주세요</p>
              </div>

              <div className="space-y-6">
                {/* 생년월일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    생년월일
                  </label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="date"
                      value={registerData.mt_birth}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, mt_birth: e.target.value }))}
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* 성별 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    성별
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRegisterData(prev => ({ ...prev, mt_gender: 1 }))}
                      className={`py-3 rounded-xl border-2 font-medium transition-all ${
                        registerData.mt_gender === 1
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      남성
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterData(prev => ({ ...prev, mt_gender: 2 }))}
                      className={`py-3 rounded-xl border-2 font-medium transition-all ${
                        registerData.mt_gender === 2
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      여성
                    </button>
                  </div>
                </div>

                {/* 푸시 알림 동의 */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={registerData.mt_push1}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, mt_push1: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        registerData.mt_push1
                          ? 'bg-orange-500 border-orange-500' 
                          : 'border-gray-300'
                      }`}>
                        {registerData.mt_push1 && (
                          <FiCheck className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-900">푸시 알림 수신 동의</span>
                      <p className="text-xs text-gray-500">그룹 활동, 일정 알림 등을 받을 수 있습니다</p>
                    </div>
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {/* 위치 정보 단계 */}
          {currentStep === REGISTER_STEPS.LOCATION && (
            <motion.div
              key="location"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-md mx-auto pt-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiMapPin className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">위치 정보</h2>
                <p className="text-gray-600">
                  위치 기반 서비스 이용을 위해<br />
                  현재 위치를 설정해주세요
                </p>
              </div>

              <div className="space-y-6">
                {registerData.mt_lat && registerData.mt_long ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <FiCheck className="w-5 h-5 text-green-500" />
                      <span className="text-green-700 font-medium">위치 정보가 설정되었습니다</span>
                    </div>
                    <p className="text-green-600 text-sm">
                      위도: {registerData.mt_lat.toFixed(6)}<br />
                      경도: {registerData.mt_long.toFixed(6)}
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <FiMapPin className="w-5 h-5 text-blue-500" />
                      <span className="text-blue-700 font-medium">위치 정보 설정</span>
                    </div>
                    <p className="text-blue-600 text-sm mb-4">
                      그룹 멤버들과의 위치 공유, 주변 정보 제공 등을 위해 위치 정보가 필요합니다.
                    </p>
                    <motion.button
                      onClick={handleGetLocation}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium"
                    >
                      현재 위치 가져오기
                    </motion.button>
                  </div>
                )}

                <div className="text-center">
                  <button
                    onClick={handleNext}
                    className="text-gray-500 text-sm underline"
                  >
                    나중에 설정하기
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* 완료 단계 */}
          {currentStep === REGISTER_STEPS.COMPLETE && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto pt-16 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <FiCheck className="w-12 h-12 text-white" />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-4">회원가입 완료!</h2>
                <p className="text-gray-600 mb-8">
                  SMAP에 오신 것을 환영합니다.<br />
                  이제 그룹을 만들고 친구들과 함께 활동해보세요!
                </p>
                
                <motion.button
                  onClick={() => router.push('/signin')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold text-lg"
                >
                  로그인하러 가기
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 하단 버튼 */}
      {currentStep !== REGISTER_STEPS.COMPLETE && currentStep !== REGISTER_STEPS.VERIFICATION && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100"
        >
          <motion.button
            onClick={currentStep === REGISTER_STEPS.LOCATION ? handleRegister : handleNext}
            disabled={!isStepValid() || isLoading}
            whileHover={{ scale: isStepValid() ? 1.02 : 1 }}
            whileTap={{ scale: isStepValid() ? 0.98 : 1 }}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
              isStepValid()
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? '처리 중...' : 
             currentStep === REGISTER_STEPS.LOCATION ? '회원가입 완료' : '다음'}
          </motion.button>
        </motion.div>
      )}
    </div>
  );
} 
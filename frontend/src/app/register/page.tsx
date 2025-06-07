'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUser, 
  FiPhone, 
  FiLock, 
  FiMail, 
  FiCalendar, 
  FiMapPin, 
  FiCheck, 
  FiArrowLeft, 
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiShield,
  FiHeart,
  FiUserPlus
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

// 회원가입 단계 정의
type RegisterStep = 'terms' | 'phone' | 'verification' | 'password' | 'profile' | 'location' | 'complete';

interface RegisterData {
  // 필수 정보
  mt_id: string; // 전화번호
  mt_pwd: string;
  mt_name: string;
  mt_nickname: string;
  mt_email: string;
  mt_birth: string;
  mt_gender: number | null; // 1: 남성, 2: 여성
  
  // 약관 동의
  mt_agree1: 'Y' | 'N'; // 서비스이용약관
  mt_agree2: 'Y' | 'N'; // 개인정보 처리방침
  mt_agree3: 'Y' | 'N'; // 위치기반서비스
  mt_agree4: 'Y' | 'N'; // 개인정보 제3자 제공
  mt_agree5: 'Y' | 'N'; // 마케팅 정보 수집
  
  // 위치 정보
  mt_lat: number | null;
  mt_long: number | null;
  
  // 인증 관련
  verificationCode: string;
  isPhoneVerified: boolean;
}

const TERMS_LIST = [
  {
    id: 'mt_agree1',
    title: '서비스 이용약관',
    required: true,
    description: 'SMAP 서비스 이용에 필요한 기본 약관입니다.'
  },
  {
    id: 'mt_agree2', 
    title: '개인정보 처리방침',
    required: true,
    description: '개인정보 수집 및 이용에 대한 동의입니다.'
  },
  {
    id: 'mt_agree3',
    title: '위치기반서비스 이용약관',
    required: true,
    description: '위치 정보 수집 및 이용에 대한 동의입니다.'
  },
  {
    id: 'mt_agree4',
    title: '개인정보 제3자 제공',
    required: false,
    description: '서비스 개선을 위한 개인정보 제3자 제공 동의입니다.'
  },
  {
    id: 'mt_agree5',
    title: '마케팅 정보 수집 및 이용',
    required: false,
    description: '이벤트, 혜택 정보 제공을 위한 마케팅 동의입니다.'
  }
];

export default function RegisterPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<RegisterStep>('terms');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [registerData, setRegisterData] = useState<RegisterData>({
    mt_id: '',
    mt_pwd: '',
    mt_name: '',
    mt_nickname: '',
    mt_email: '',
    mt_birth: '',
    mt_gender: null,
    mt_agree1: 'N',
    mt_agree2: 'N', 
    mt_agree3: 'N',
    mt_agree4: 'N',
    mt_agree5: 'N',
    mt_lat: null,
    mt_long: null,
    verificationCode: '',
    isPhoneVerified: false
  });

  // 단계별 진행률 계산
  const getProgress = () => {
    const steps = ['terms', 'phone', 'verification', 'password', 'profile', 'location', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  // 뒤로가기
  const handleBack = () => {
    const stepOrder: RegisterStep[] = ['terms', 'phone', 'verification', 'password', 'profile', 'location', 'complete'];
    const currentIndex = stepOrder.indexOf(currentStep);
    
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    } else {
      router.back();
    }
  };

  // 다음 단계로
  const handleNext = () => {
    if (validateCurrentStep()) {
      const stepOrder: RegisterStep[] = ['terms', 'phone', 'verification', 'password', 'profile', 'location', 'complete'];
      const currentIndex = stepOrder.indexOf(currentStep);
      
      if (currentIndex < stepOrder.length - 1) {
        setCurrentStep(stepOrder[currentIndex + 1]);
      }
    }
  };

  // 현재 단계 유효성 검사
  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 'terms':
        if (registerData.mt_agree1 !== 'Y') {
          newErrors.terms = '서비스 이용약관에 동의해주세요.';
        }
        if (registerData.mt_agree2 !== 'Y') {
          newErrors.terms = '개인정보 처리방침에 동의해주세요.';
        }
        if (registerData.mt_agree3 !== 'Y') {
          newErrors.terms = '위치기반서비스 이용약관에 동의해주세요.';
        }
        break;

      case 'phone':
        if (!registerData.mt_id || registerData.mt_id.length < 10) {
          newErrors.phone = '올바른 전화번호를 입력해주세요.';
        }
        break;

      case 'verification':
        if (!registerData.isPhoneVerified) {
          newErrors.verification = '전화번호 인증을 완료해주세요.';
        }
        break;

      case 'password':
        if (!registerData.mt_pwd || registerData.mt_pwd.length < 8) {
          newErrors.password = '비밀번호는 8자 이상이어야 합니다.';
        }
        if (registerData.mt_pwd !== passwordConfirm) {
          newErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.';
        }
        break;

      case 'profile':
        if (!registerData.mt_name.trim()) {
          newErrors.name = '이름을 입력해주세요.';
        }
        if (!registerData.mt_nickname.trim()) {
          newErrors.nickname = '닉네임을 입력해주세요.';
        }
        if (!registerData.mt_email.trim() || !registerData.mt_email.includes('@')) {
          newErrors.email = '올바른 이메일을 입력해주세요.';
        }
        if (!registerData.mt_birth) {
          newErrors.birth = '생년월일을 입력해주세요.';
        }
        if (registerData.mt_gender === null) {
          newErrors.gender = '성별을 선택해주세요.';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 전화번호 인증 요청
  const handleSendVerification = async () => {
    setIsLoading(true);
    try {
      // TODO: 실제 SMS 인증 API 호출
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('인증번호가 발송되었습니다.');
    } catch (error) {
      alert('인증번호 발송에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 인증번호 확인
  const handleVerifyCode = async () => {
    setIsLoading(true);
    try {
      // TODO: 실제 인증번호 확인 API 호출
      await new Promise(resolve => setTimeout(resolve, 1000));
      setRegisterData(prev => ({ ...prev, isPhoneVerified: true }));
      alert('인증이 완료되었습니다.');
    } catch (error) {
      alert('인증번호가 올바르지 않습니다.');
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
          console.error('위치 정보를 가져올 수 없습니다:', error);
        }
      );
    }
  };

  // 회원가입 완료
  const handleRegister = async () => {
    setIsLoading(true);
    try {
      // TODO: 실제 회원가입 API 호출
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mt_type: 1,
          mt_level: 2,
          mt_status: 1,
          mt_id: registerData.mt_id,
          mt_pwd: registerData.mt_pwd,
          mt_name: registerData.mt_name,
          mt_nickname: registerData.mt_nickname,
          mt_email: registerData.mt_email,
          mt_birth: registerData.mt_birth,
          mt_gender: registerData.mt_gender,
          mt_onboarding: 'N',
          mt_show: 'Y',
          mt_agree1: registerData.mt_agree1,
          mt_agree2: registerData.mt_agree2,
          mt_agree3: registerData.mt_agree3,
          mt_agree4: registerData.mt_agree4,
          mt_agree5: registerData.mt_agree5,
          mt_push1: 'Y',
          mt_lat: registerData.mt_lat,
          mt_long: registerData.mt_long,
        }),
      });

      if (response.ok) {
        setCurrentStep('complete');
      } else {
        throw new Error('회원가입에 실패했습니다.');
      }
    } catch (error) {
      alert('회원가입에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 약관 동의 토글
  const toggleAgreement = (agreementId: keyof RegisterData) => {
    setRegisterData(prev => ({
      ...prev,
      [agreementId]: prev[agreementId] === 'Y' ? 'N' : 'Y'
    }));
  };

  // 전체 동의
  const handleAllAgree = () => {
    const allAgreed = TERMS_LIST.every(term => registerData[term.id as keyof RegisterData] === 'Y');
    const newValue = allAgreed ? 'N' : 'Y';
    
    setRegisterData(prev => ({
      ...prev,
      mt_agree1: newValue,
      mt_agree2: newValue,
      mt_agree3: newValue,
      mt_agree4: newValue,
      mt_agree5: newValue
    }));
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
          
          <div className="flex items-center space-x-3">
            <motion.div
              initial={{ rotate: -180, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="p-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl"
            >
              <FiUserPlus className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">회원가입</h1>
              <p className="text-xs text-gray-500">SMAP과 함께하세요</p>
            </div>
          </div>
          
          <div className="w-9" /> {/* 균형을 위한 빈 공간 */}
        </div>
        
        {/* 진행률 바 */}
        <div className="px-4 pb-2">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <motion.div 
              className="bg-gradient-to-r from-indigo-600 to-purple-600 h-1 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${getProgress()}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.header>

      {/* 메인 콘텐츠 */}
      <div className="pt-20 pb-10 px-4">
        <AnimatePresence mode="wait">
          {/* 약관 동의 단계 */}
          {currentStep === 'terms' && (
            <motion.div
              key="terms"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-md mx-auto"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <FiShield className="w-10 h-10 text-white" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">서비스 이용약관</h2>
                <p className="text-gray-600">SMAP 서비스 이용을 위해 약관에 동의해주세요</p>
              </div>

              <div className="space-y-4 mb-6">
                {/* 전체 동의 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100"
                >
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={TERMS_LIST.every(term => registerData[term.id as keyof RegisterData] === 'Y')}
                        onChange={handleAllAgree}
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        TERMS_LIST.every(term => registerData[term.id as keyof RegisterData] === 'Y')
                          ? 'bg-indigo-600 border-indigo-600' 
                          : 'border-gray-300'
                      }`}>
                        {TERMS_LIST.every(term => registerData[term.id as keyof RegisterData] === 'Y') && (
                          <FiCheck className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-gray-900">전체 동의</span>
                  </label>
                </motion.div>

                {/* 개별 약관 */}
                {TERMS_LIST.map((term, index) => (
                  <motion.div
                    key={term.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="bg-white rounded-2xl p-4 border border-gray-100"
                  >
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <div className="relative mt-1">
                        <input
                          type="checkbox"
                          checked={registerData[term.id as keyof RegisterData] === 'Y'}
                          onChange={() => toggleAgreement(term.id as keyof RegisterData)}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          registerData[term.id as keyof RegisterData] === 'Y'
                            ? 'bg-indigo-600 border-indigo-600' 
                            : 'border-gray-300'
                        }`}>
                          {registerData[term.id as keyof RegisterData] === 'Y' && (
                            <FiCheck className="w-3 h-3 text-white" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{term.title}</span>
                          {term.required && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">필수</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{term.description}</p>
                      </div>
                    </label>
                  </motion.div>
                ))}
              </div>

              {errors.terms && (
                <p className="text-red-500 text-sm mb-4">{errors.terms}</p>
              )}

              <motion.button
                onClick={handleNext}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-2xl font-semibold"
              >
                다음 단계
              </motion.button>
            </motion.div>
          )}

          {/* 전화번호 입력 단계 */}
          {currentStep === 'phone' && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-md mx-auto"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <FiPhone className="w-10 h-10 text-white" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">전화번호 입력</h2>
                <p className="text-gray-600">본인 확인을 위해 전화번호를 입력해주세요</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    전화번호
                  </label>
                  <input
                    type="tel"
                    value={registerData.mt_id}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, mt_id: e.target.value }))}
                    placeholder="010-1234-5678"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
                  )}
                </div>

                <motion.button
                  onClick={handleNext}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 rounded-2xl font-semibold"
                >
                  인증번호 받기
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* 인증번호 확인 단계 */}
          {currentStep === 'verification' && (
            <motion.div
              key="verification"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-md mx-auto"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <FiShield className="w-10 h-10 text-white" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">인증번호 확인</h2>
                <p className="text-gray-600">
                  {registerData.mt_id}로 발송된<br />
                  인증번호를 입력해주세요
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    인증번호
                  </label>
                  <input
                    type="text"
                    value={registerData.verificationCode}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, verificationCode: e.target.value }))}
                    placeholder="6자리 인증번호"
                    maxLength={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                  />
                  {errors.verification && (
                    <p className="text-red-500 text-sm mt-1">{errors.verification}</p>
                  )}
                </div>

                <div className="flex space-x-3">
                  <motion.button
                    onClick={handleSendVerification}
                    disabled={isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-medium disabled:opacity-50"
                  >
                    재발송
                  </motion.button>
                  <motion.button
                    onClick={handleVerifyCode}
                    disabled={isLoading || !registerData.verificationCode}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
                  >
                    {isLoading ? '확인 중...' : '확인'}
                  </motion.button>
                </div>

                {registerData.isPhoneVerified && (
                  <motion.button
                    onClick={handleNext}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-4 rounded-2xl font-semibold"
                  >
                    다음 단계
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}

          {/* 비밀번호 설정 단계 */}
          {currentStep === 'password' && (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-md mx-auto"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-20 h-20 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <FiLock className="w-10 h-10 text-white" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">비밀번호 설정</h2>
                <p className="text-gray-600">안전한 비밀번호를 설정해주세요</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비밀번호
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={registerData.mt_pwd}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, mt_pwd: e.target.value }))}
                      placeholder="8자 이상 입력해주세요"
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비밀번호 확인
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordConfirm ? 'text' : 'password'}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="비밀번호를 다시 입력해주세요"
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    >
                      {showPasswordConfirm ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.passwordConfirm && (
                    <p className="text-red-500 text-sm mt-1">{errors.passwordConfirm}</p>
                  )}
                </div>

                <motion.button
                  onClick={handleNext}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-4 rounded-2xl font-semibold"
                >
                  다음 단계
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* 프로필 정보 입력 단계 */}
          {currentStep === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-md mx-auto"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-20 h-20 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <FiUser className="w-10 h-10 text-white" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">프로필 정보</h2>
                <p className="text-gray-600">기본 정보를 입력해주세요</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이름
                  </label>
                  <input
                    type="text"
                    value={registerData.mt_name}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, mt_name: e.target.value }))}
                    placeholder="실명을 입력해주세요"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    닉네임
                  </label>
                  <input
                    type="text"
                    value={registerData.mt_nickname}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, mt_nickname: e.target.value }))}
                    placeholder="다른 사용자에게 보여질 이름"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {errors.nickname && (
                    <p className="text-red-500 text-sm mt-1">{errors.nickname}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={registerData.mt_email}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, mt_email: e.target.value }))}
                    placeholder="example@email.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    생년월일
                  </label>
                  <input
                    type="date"
                    value={registerData.mt_birth}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, mt_birth: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {errors.birth && (
                    <p className="text-red-500 text-sm mt-1">{errors.birth}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    성별
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRegisterData(prev => ({ ...prev, mt_gender: 1 }))}
                      className={`py-3 rounded-xl border-2 font-medium transition-all ${
                        registerData.mt_gender === 1
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-300 text-gray-700'
                      }`}
                    >
                      남성
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterData(prev => ({ ...prev, mt_gender: 2 }))}
                      className={`py-3 rounded-xl border-2 font-medium transition-all ${
                        registerData.mt_gender === 2
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-300 text-gray-700'
                      }`}
                    >
                      여성
                    </button>
                  </div>
                  {errors.gender && (
                    <p className="text-red-500 text-sm mt-1">{errors.gender}</p>
                  )}
                </div>

                <motion.button
                  onClick={handleNext}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white py-4 rounded-2xl font-semibold"
                >
                  다음 단계
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* 위치 정보 단계 */}
          {currentStep === 'location' && (
            <motion.div
              key="location"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-md mx-auto"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-20 h-20 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <FiMapPin className="w-10 h-10 text-white" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">위치 정보</h2>
                <p className="text-gray-600">
                  더 나은 서비스 제공을 위해<br />
                  위치 정보를 허용해주세요
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
                  <div className="flex items-start space-x-3">
                    <FiMapPin className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-orange-900 mb-1">위치 정보 사용 목적</h3>
                      <ul className="text-sm text-orange-700 space-y-1">
                        <li>• 그룹 멤버들과의 위치 공유</li>
                        <li>• 주변 추천 장소 제공</li>
                        <li>• 날씨 정보 제공</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {registerData.mt_lat && registerData.mt_long ? (
                  <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
                    <div className="flex items-center space-x-3">
                      <FiCheck className="w-5 h-5 text-green-600" />
                      <span className="text-green-700 font-medium">위치 정보가 설정되었습니다</span>
                    </div>
                  </div>
                ) : (
                  <motion.button
                    onClick={handleGetLocation}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-2xl font-semibold"
                  >
                    위치 정보 허용
                  </motion.button>
                )}

                <motion.button
                  onClick={handleRegister}
                  disabled={isLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-50"
                >
                  {isLoading ? '가입 중...' : '회원가입 완료'}
                </motion.button>

                <button
                  onClick={() => setCurrentStep('complete')}
                  className="w-full text-gray-500 py-2 text-sm"
                >
                  나중에 설정하기
                </button>
              </div>
            </motion.div>
          )}

          {/* 가입 완료 단계 */}
          {currentStep === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="max-w-md mx-auto text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <HiSparkles className="w-12 h-12 text-white" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-3xl font-bold text-gray-900 mb-4"
              >
                가입 완료!
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-gray-600 mb-8"
              >
                {registerData.mt_name}님, SMAP에 오신 것을 환영합니다!<br />
                이제 친구들과 함께 특별한 순간을 공유해보세요.
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                onClick={() => router.push('/signin')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 rounded-2xl font-semibold"
              >
                로그인하러 가기
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
} 
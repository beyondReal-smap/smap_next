'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';

dayjs.locale('ko');
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
  FiHeart,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import groupService from '@/services/groupService';
import { REGISTER_STEPS, useRegisterContext } from '../RegisterContext';

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

// 소셜 로그인 데이터 타입
interface SocialLoginData {
  provider: string;
  email: string;
  name: string;
  nickname: string;
  profile_image?: string;
  google_id?: string;
  kakao_id?: string;
}

interface RegisterData {
  // 약관 동의
  mt_agree1: boolean;
  mt_agree2: boolean;
  mt_agree3: boolean;
  mt_agree4: boolean;
  mt_agree5: boolean;
  
  // 기본 정보
  mt_id: string; // 전화번호 또는 이메일 (소셜 로그인 시)
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
  
  // 소셜 로그인 관련
  isSocialLogin?: boolean;
  socialProvider?: string;
  socialId?: string;
}

export default function NewRegisterPage() {
  // AuthGuard 우회를 위한 플래그 설정
  useEffect(() => {
    // 새로운 register 페이지임을 표시
    sessionStorage.setItem('isNewRegisterPage', 'true');
    
    return () => {
      sessionStorage.removeItem('isNewRegisterPage');
    };
  }, []);

  const router = useRouter();
  const { 
    currentStep, 
    setCurrentStep,
    birthModalOpen,
    setBirthModalOpen 
  } = useRegisterContext();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationTimer, setVerificationTimer] = useState(0);
  const [lastSentTime, setLastSentTime] = useState<number | null>(null);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string; isCountdown: boolean; style?: any }>({ isOpen: false, title: '', message: '', isCountdown: false });
  const [countdownTime, setCountdownTime] = useState(0);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false
  });
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [calendarCurrentMonth, setCalendarCurrentMonth] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  
  // 포커스 상태 관리
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  // 위치 정보 관련 상태
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  
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
    verification_code: '',
    isSocialLogin: false,
    socialProvider: '',
    socialId: ''
  });

  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [isOpeningApp, setIsOpeningApp] = useState(false);

  // 진행률 계산
  const getProgress = () => {
    const steps = Object.values(REGISTER_STEPS);
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / (steps.length - 1)) * 100; // COMPLETE 제외
  };

  // 전화번호 포맷팅 함수
  const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const numericValue = value.replace(/[^0-9]/g, '');
    const length = numericValue.length;

    if (length < 4) return numericValue;
    if (length < 7) {
      return `${numericValue.slice(0, 3)}-${numericValue.slice(3)}`;
    }
    if (length < 11) {
      return `${numericValue.slice(0, 3)}-${numericValue.slice(3, 6)}-${numericValue.slice(6)}`;
    }
    return `${numericValue.slice(0, 3)}-${numericValue.slice(3, 7)}-${numericValue.slice(7, 11)}`;
  };

  // 이메일 유효성 검사 함수
  const validateEmail = (email: string) => {
    if (!email) {
      setEmailError('');
      return true; // 선택사항이므로 빈 값은 유효
    }
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const isValid = emailRegex.test(email);
    
    if (!isValid) {
      setEmailError('올바른 이메일 형식을 입력해주세요');
      return false;
    }
    
    setEmailError('');
    return true;
  };

  // 비밀번호 유효성 검사 함수
  const validatePassword = (password: string) => {
    const strength = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    
    setPasswordStrength(strength);
    
    const allValid = Object.values(strength).every(Boolean);
    
    if (!password) {
      setPasswordError('');
      return false;
    }
    
    if (!allValid) {
      const missingRequirements = [];
      if (!strength.minLength) missingRequirements.push('8자 이상');
      if (!strength.hasUppercase) missingRequirements.push('대문자');
      if (!strength.hasLowercase) missingRequirements.push('소문자');
      if (!strength.hasNumber) missingRequirements.push('숫자');
      if (!strength.hasSpecialChar) missingRequirements.push('특수문자');
      
      setPasswordError(`다음 조건이 필요합니다: ${missingRequirements.join(', ')}`);
      return false;
    }
    
    setPasswordError('');
    return true;
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

  // 뒤로가기
  const handleBack = () => {
    if (currentStep === REGISTER_STEPS.TERMS) {
      router.push('/signin');
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
        const isEmailValid = !registerData.mt_email || 
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(registerData.mt_email);
        const isPasswordStrong = Object.values(passwordStrength).every(Boolean);
        
        return registerData.mt_pwd && 
               registerData.mt_name && 
               registerData.mt_nickname &&
               passwordConfirm === registerData.mt_pwd &&
               !passwordError &&
               isPasswordStrong &&
               !emailError &&
               isEmailValid;
      case REGISTER_STEPS.PROFILE:
        return registerData.mt_birth && registerData.mt_gender !== null;
      case REGISTER_STEPS.LOCATION:
        return true; // 선택사항
      default:
        return false;
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* 진행률 바 */}
      {currentStep !== REGISTER_STEPS.COMPLETE && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-40">
          <motion.div 
            className="h-full"
            style={{backgroundColor: '#0113A3'}}
            initial={{ width: 0 }}
            animate={{ width: `${getProgress()}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto pt-6 pb-32">
          <div className="p-6">
            {/* 단계별 콘텐츠 */}
            <AnimatePresence mode="wait">
              {/* 약관 동의 단계 */}
              {currentStep === REGISTER_STEPS.TERMS && (
                <motion.div
                  key="terms"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="space-y-3"
                >
                  <div className="text-center mb-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2" style={{backgroundColor: '#0113A3'}}>
                      <FiFileText className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">서비스 이용약관</h2>
                    <p className="text-xs text-gray-600">SMAP 서비스 이용을 위해 약관에 동의해주세요</p>
                  </div>

                  {/* 전체 동의 */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean)}
                        onChange={(e) => handleAllAgree(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="font-medium text-gray-900 text-sm">전체 동의</span>
                    </label>
                  </div>

                  {/* 개별 약관 */}
                  <div className="space-y-2">
                    {TERMS_DATA.map((term) => (
                      <div key={term.id} className="bg-white border border-gray-200 rounded-lg p-3">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={registerData[term.id as keyof RegisterData] as boolean}
                            onChange={(e) => handleTermAgree(term.id, e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900 truncate">{term.title}</span>
                              {term.required && (
                                <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex-shrink-0">필수</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{term.content}</p>
                          </div>
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
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2" style={{backgroundColor: '#0113A3'}}>
                      <FiPhone className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">전화번호 인증</h2>
                    <p className="text-sm text-gray-600">본인 확인을 위해 전화번호를 입력해주세요</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      전화번호
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <FiPhone className="w-4 h-4 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        value={registerData.mt_id}
                        onChange={(e) => {
                          const formatted = formatPhoneNumber(e.target.value);
                          setRegisterData(prev => ({ ...prev, mt_id: formatted }));
                        }}
                        placeholder="010-1234-5678"
                        maxLength={13}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
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
                  className="space-y-4"
                >
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2" style={{backgroundColor: '#0113A3'}}>
                      <FiUser className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">기본 정보</h2>
                    <p className="text-sm text-gray-600">서비스 이용을 위한 기본 정보를 입력해주세요</p>
                  </div>

                  {/* 비밀번호 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      비밀번호
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <FiLock className="w-4 h-4 text-gray-400" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={registerData.mt_pwd}
                        onChange={(e) => {
                          const password = e.target.value;
                          setRegisterData(prev => ({ ...prev, mt_pwd: password }));
                          validatePassword(password);
                        }}
                        placeholder="8자 이상, 대소문자, 숫자, 특수문자 포함"
                        className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordError && (
                      <p className="text-red-500 text-sm mt-1">{passwordError}</p>
                    )}
                  </div>

                  {/* 비밀번호 확인 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      비밀번호 확인
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <FiLock className="w-4 h-4 text-gray-400" />
                      </div>
                      <input
                        type={showPasswordConfirm ? 'text' : 'password'}
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder="비밀번호를 다시 입력해주세요"
                        className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswordConfirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* 이메일 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      이메일 (선택)
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <FiMail className="w-4 h-4 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        value={registerData.mt_email}
                        onChange={(e) => {
                          const email = e.target.value;
                          setRegisterData(prev => ({ ...prev, mt_email: email }));
                          validateEmail(email);
                        }}
                        placeholder="example@email.com"
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    {emailError && (
                      <p className="text-red-500 text-sm mt-1">{emailError}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 하단 버튼 - 화면 하단에 고정 */}
      {currentStep !== REGISTER_STEPS.COMPLETE && (
        <div 
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200"
          style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            zIndex: 50
          }}
        >
          <div className="max-w-md mx-auto p-4">
            <button
              onClick={handleNext}
              disabled={!isStepValid()}
              className={`w-full py-3 rounded-xl font-semibold transition-all ${
                isStepValid()
                  ? 'text-white shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              style={isStepValid() ? {backgroundColor: '#0113A3'} : {}}
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 
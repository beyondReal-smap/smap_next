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
  // 모바일 키보드 대응을 위한 스타일
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media (max-height: 600px) {
        .register-content {
          padding-top: 0.5rem !important;
          padding-bottom: 0.5rem !important;
        }
        .register-header {
          margin-bottom: 1rem !important;
        }
        .register-form {
          gap: 0.75rem !important;
        }
        .register-main {
          padding-bottom: 6rem !important; /* 하단 버튼 공간 확보 */
        }
      }
      
      @media (max-height: 500px) {
        .register-header h2 {
          font-size: 1.25rem !important;
        }
        .register-header p {
          font-size: 0.875rem !important;
        }
        .register-form {
          gap: 0.5rem !important;
        }
      }
      
      /* iOS Safari 대응 */
      @supports (-webkit-touch-callout: none) {
        .register-main {
          min-height: -webkit-fill-available;
        }
      }
      
      /* 키보드 올라올 때 스크롤 보장 */
      .register-scroll {
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
      }
      
      /* 모바일 입력 필드 최적화 */
      @media (max-width: 480px) {
        .register-input {
          font-size: 16px !important; /* iOS 줌 방지 */
        }
        .register-button {
          min-height: 44px !important; /* 터치 친화적 크기 */
        }
      }
      
      /* placeholder 텍스트 크기 조정 */
      .register-input::placeholder {
        font-size: 0.875rem; /* 14px */
        color: #9CA3AF; /* gray-400 */
      }
      
      /* 입력 필드 테두리 최적화 */
      .register-input {
        box-sizing: border-box;
        margin: 3px; /* 포커스 링을 위한 여백 증가 */
      }
      
      .register-form > div {
        padding: 4px; /* 각 입력 필드 컨테이너에 여백 증가 */
        margin: 0 -2px; /* 좌우 마진으로 공간 확보 */
      }
      
      .register-form {
        padding: 0 6px; /* 폼 전체에 좌우 패딩 추가 */
      }
      
      /* 입력 필드 컨테이너 추가 여백 */
      .register-input-container {
        padding: 0 4px; /* 입력 필드 주변 추가 여백 */
        margin: 0 -2px; /* 컨테이너 마진으로 공간 확보 */
      }
      
      /* 포커스 링이 잘리지 않도록 추가 처리 */
      .register-input:focus {
        transform: scale(0.998); /* 아주 약간 축소하여 여백 확보 */
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(REGISTER_STEPS.TERMS);
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
  const [birthModalOpen, setBirthModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [calendarCurrentMonth, setCalendarCurrentMonth] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  
  // 포커스 상태 관리
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
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

  // 전화번호 입력 핸들러
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatPhoneNumber(rawValue);
    
    // 전화번호가 변경되면 쿨다운 리셋
    if (formatted !== registerData.mt_id) {
      setLastSentTime(null);
      setVerificationSent(false);
      setVerificationTimer(0);
    }
    
    setRegisterData(prev => ({ ...prev, mt_id: formatted }));
  };

  // 전화번호 입력 필드 포커스 핸들러 (모바일 키보드 대응)
  const handlePhoneInputFocus = () => {
    // 모바일에서 키보드가 올라올 때 하단 버튼이 보이도록 스크롤
    setTimeout(() => {
      const bottomButton = document.querySelector('[data-bottom-button]');
      if (bottomButton) {
        bottomButton.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end',
          inline: 'nearest'
        });
      }
    }, 300); // 키보드 애니메이션 후 실행
  };

  // 생년월일 모달 열기
  const handleBirthModalOpen = () => {
    // 기존 생년월일이 있다면 파싱하여 캘린더 설정
    if (registerData.mt_birth) {
      const birthDate = dayjs(registerData.mt_birth);
      setSelectedDate(birthDate);
      setCalendarCurrentMonth(birthDate);
      } else {
      // 기본값: 현재 년도에서 30년 전
      const defaultDate = dayjs().subtract(30, 'year');
      setSelectedDate(null);
      setCalendarCurrentMonth(defaultDate);
    }
    setBirthModalOpen(true);
  };

  // 생년월일 확인
  const handleBirthConfirm = () => {
    if (selectedDate) {
      const birthDate = selectedDate.format('YYYY-MM-DD');
      setRegisterData(prev => ({ ...prev, mt_birth: birthDate }));
    }
    setBirthModalOpen(false);
  };

  // 캘린더 날짜 선택
  const handleCalendarDateSelect = (date: Dayjs) => {
    setSelectedDate(date);
  };

  // 캘린더 이전 월
  const handleCalendarPrevMonth = () => {
    setCalendarCurrentMonth(prev => prev.subtract(1, 'month'));
  };

  // 캘린더 다음 월
  const handleCalendarNextMonth = () => {
    setCalendarCurrentMonth(prev => prev.add(1, 'month'));
  };

  // 캘린더 오늘로 이동
  const handleCalendarToday = () => {
    const today = dayjs();
    setCalendarCurrentMonth(today);
    setSelectedDate(today);
  };

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

  // 카운트다운 타이머 (재발송 제한 모달용)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdownTime > 0 && errorModal.isOpen && errorModal.isCountdown) {
      interval = setInterval(() => {
        setCountdownTime(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            // 카운트다운 완료 시 모달 닫기
            setErrorModal({ isOpen: false, title: '', message: '', isCountdown: false });
            return 0;
          }
          
          // 모달 메시지 업데이트
          const minutes = Math.floor(newTime / 60);
          const seconds = newTime % 60;
          setErrorModal(prev => ({
            ...prev,
            message: `같은 번호로는 ${minutes}분 ${seconds}초 후에 재발송이 가능합니다.`
          }));
          
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [countdownTime, errorModal.isOpen, errorModal.isCountdown]);

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
      const now = Date.now();
      const cleanPhone = registerData.mt_id.replace(/-/g, '');
      
      // 테스트용 전화번호 처리
      if (cleanPhone === '01011111111') {
        setVerificationSent(true);
        setVerificationTimer(180); // 3분
        setLastSentTime(now);
        // 테스트 번호는 실제 SMS 발송 없이 바로 다음 단계로 이동
        handleNext();
        return;
      }
    
      const response = await fetch('/api/auth/register', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send_verification',
          phone: cleanPhone
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setVerificationSent(true);
        setVerificationTimer(180); // 3분
        setLastSentTime(now);
        // 인증번호 발송 성공 시 자동으로 다음 단계로 이동
        handleNext();
      } else {
        throw new Error(data.error || '인증번호 발송에 실패했습니다.');
      }
    } catch (error) {
      console.error('인증번호 발송 실패:', error);
              setErrorModal({
          isOpen: true,
          title: '발송 실패',
          message: error instanceof Error ? error.message : '인증번호 발송에 실패했습니다.',
          isCountdown: false
        });
    } finally {
      setIsLoading(false);
    }
  };

  // 인증번호 확인
  const handleVerifyCode = async () => {
    if (!registerData.verification_code) return;
    
    // 인증번호 발송 여부 확인
    if (!verificationSent) {
      setErrorModal({
        isOpen: true,
        title: '인증번호 미발송',
        message: '먼저 인증번호를 요청해주세요.',
        isCountdown: false
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const cleanPhone = registerData.mt_id.replace(/-/g, '');
      
      // 테스트용 전화번호 처리
      if (cleanPhone === '01011111111') {
        if (registerData.verification_code === '111111') {
          handleNext();
          return;
        } else {
          setErrorModal({
            isOpen: true,
            title: '인증 실패',
            message: '테스트 번호의 인증번호는 111111입니다.',
            isCountdown: false
          });
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch('/api/auth/register', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'verify_code',
          phone: cleanPhone,
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
      setErrorModal({
        isOpen: true,
        title: '인증 실패',
        message: error instanceof Error ? error.message : '인증번호 확인에 실패했습니다.',
        isCountdown: false
      });
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
          mt_id: registerData.mt_id.replace(/-/g, ''), // 전화번호에서 하이픈 제거
          mt_type: 1, // 일반 회원
          mt_level: 2, // 일반(무료)
          mt_status: 1, // 정상
          mt_onboarding: 'N',
          mt_show: 'Y'
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        console.log('회원가입 성공:', data);
        setCurrentStep(REGISTER_STEPS.COMPLETE);
      } else {
        throw new Error(data.error || data.message || '회원가입에 실패했습니다.');
      }
    } catch (error) {
      console.error('회원가입 실패:', error);
      setErrorModal({
        isOpen: true,
        title: '회원가입 실패',
        message: error instanceof Error ? error.message : '회원가입에 실패했습니다.',
        isCountdown: false
      });
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
        // 이메일 유효성 검사 (상태 업데이트 없이)
        const isEmailValid = !registerData.mt_email || 
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(registerData.mt_email);
        
        // 비밀번호 강도 검사
        const isPasswordStrong = Object.values(passwordStrength).every(Boolean);
        
        return registerData.mt_pwd && 
               registerData.mt_name && 
               registerData.mt_nickname &&
               passwordConfirm === registerData.mt_pwd &&
               !passwordError && // 비밀번호 에러가 없어야 함
               isPasswordStrong && // 모든 비밀번호 조건 만족
               !emailError && // 이메일 에러가 없어야 함
               isEmailValid; // 빈 값이거나 유효한 이메일
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col relative">
      {/* 헤더 */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-lg border-b border-gray-100/50 shadow-sm"
        style={{
          backdropFilter: 'blur(10px)',
          background: 'rgba(255, 255, 255, 0.7)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 2px 16px rgba(0, 0, 0, 0.08)'
        }}
      >
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center space-x-3">
            <motion.button 
              onClick={handleBack}
              className="p-2 transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
            <div className="flex items-center space-x-3">
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-gray-900 whitespace-nowrap">회원가입</h1>
                {currentStep !== REGISTER_STEPS.COMPLETE && (
                  <p className="text-xs text-gray-500 whitespace-nowrap">
                    {Object.values(REGISTER_STEPS).indexOf(currentStep) + 1} / {Object.values(REGISTER_STEPS).length - 1}
                  </p>
                )}
              </div>
            </div>
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
      <div className="flex-1 flex flex-col pt-16 pb-24 px-6 overflow-y-auto register-main register-scroll">
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="w-full max-w-md mx-auto py-4 register-content">
            <AnimatePresence mode="wait">
          {/* 약관 동의 단계 */}
          {currentStep === REGISTER_STEPS.TERMS && (
            <motion.div
              key="terms"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full h-full flex flex-col"
            >
              <div className="text-center mb-8 register-header">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiFileText className="w-8 h-8 text-white" />
            </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">서비스 이용약관</h2>
                <p className="text-gray-600" style={{ wordBreak: 'keep-all' }}>SMAP 서비스 이용을 위해 약관에 동의해주세요</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pb-4 register-form">
                {/* 전체 동의 */}
                <div className="bg-white rounded-xl p-6 border-2 border-indigo-100">
                  <label className="flex items-center space-x-4 cursor-pointer">
                    <div className="w-1"></div> {/* 왼쪽 공백 */}
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean)}
                        onChange={(e) => handleAllAgree(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean)
                          ? 'bg-indigo-500 border-indigo-500' 
                          : 'border-gray-300'
                      }`}>
                        {TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean) && (
                          <FiCheck className="w-3 h-3 text-white" />
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
                      <div className="flex items-center space-x-4">
                        <div className="w-1"></div> {/* 왼쪽 공백 */}
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
                          <p className="text-xs text-gray-500 mt-1" style={{ wordBreak: 'keep-all' }}>{term.content}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <FiArrowRight className="w-4 h-4 text-gray-400" />
                        <div className="w-2"></div> {/* 오른쪽 공백 */}
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
              className="w-full h-full flex flex-col justify-center"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiPhone className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">전화번호 인증</h2>
                <p className="text-gray-600" style={{ wordBreak: 'keep-all' }}>본인 확인을 위해 전화번호를 입력해주세요</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    전화번호
                  </label>
                  <div className="relative register-input-container">
                    <FiPhone className={`absolute left-5 top-1/2 transform -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
                      focusedField === 'phone' || registerData.mt_id ? 'text-indigo-500' : 'text-gray-400'
                    }`} />
              <input
                      type="tel"
                      value={registerData.mt_id}
                      onChange={handlePhoneNumberChange}
                      onFocus={() => {
                        setFocusedField('phone');
                        handlePhoneInputFocus();
                      }}
                      onBlur={() => setFocusedField(null)}
                      placeholder="010-1234-5678"
                      maxLength={13}
                      className="w-full pl-10 pr-6 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent register-input"
                    />
                  </div>
                </div>

                {verificationSent && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-indigo-50 border border-indigo-200 rounded-xl p-4"
                  >
                    <div className="flex items-center space-x-2">
                      <FiCheck className="w-5 h-5 text-indigo-500" />
                      <span className="text-indigo-700 font-medium">인증번호가 발송되었습니다</span>
                    </div>
                    <p className="text-indigo-600 text-sm mt-1" style={{ wordBreak: 'keep-all' }}>
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
              className="w-full h-full flex flex-col justify-center"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiShield className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">인증번호 입력</h2>
                <p className="text-gray-600" style={{ wordBreak: 'keep-all' }}>
                  {registerData.mt_id}로 발송된<br />
                  인증번호 6자리를 입력해주세요
                </p>
              </div>

              <div className="space-y-6">
                {/* 인증번호 미발송 상태 안내 */}
                {!verificationSent && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="text-orange-700 font-medium">인증번호가 발송되지 않았습니다</span>
                    </div>
                    <p className="text-orange-600 text-sm" style={{ wordBreak: 'keep-all' }}>
                      먼저 이전 단계에서 인증번호를 요청해주세요.
                    </p>
                  </div>
                )}

            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    인증번호
              </label>
              <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={registerData.verification_code}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, ''); // 숫자만 허용
                      setRegisterData(prev => ({ ...prev, verification_code: value }));
                    }}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-offset-0 focus:ring-indigo-500 focus:border-transparent text-center text-2xl font-mono tracking-widest register-input"
                    style={{ outline: 'none' }}
                  />
                  {verificationTimer > 0 && (
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      {Math.floor(verificationTimer / 60)}:{(verificationTimer % 60).toString().padStart(2, '0')} 후 만료
                    </p>
              )}
            </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      // 인증번호가 발송되지 않은 경우 이전 단계로 이동
                      if (!verificationSent) {
                        setCurrentStep(REGISTER_STEPS.PHONE);
                        setRegisterData(prev => ({ ...prev, verification_code: '' }));
                        return;
                      }
                      
                      // 3분 쿨다운 체크
                      const now = Date.now();
                      if (lastSentTime && (now - lastSentTime) < 180000) {
                        const remainingTime = Math.ceil((180000 - (now - lastSentTime)) / 1000);
                        const minutes = Math.floor(remainingTime / 60);
                        const seconds = remainingTime % 60;
                        setErrorModal({
                          isOpen: true,
                          title: '재발송 제한',
                          message: `같은 번호로는 ${minutes}분 ${seconds}초 후에 재발송이 가능합니다.`,
                          isCountdown: true,
                          style: { wordBreak: 'keep-all' }
                        });
                        setCountdownTime(remainingTime);
                        return;
                      }
                      
                      // 인증번호 재발송
                      handleSendVerification();
                    }}
                    disabled={isLoading}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    {!verificationSent ? '이전 단계로' : '재발송'}
                  </button>
                  <motion.button
                    onClick={handleVerifyCode}
                    disabled={!registerData.verification_code || isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold disabled:opacity-50"
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
              className="w-full h-full flex flex-col"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiUser className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">기본 정보</h2>
                <p className="text-gray-600" style={{ wordBreak: 'keep-all' }}>서비스 이용을 위한 기본 정보를 입력해주세요</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pb-4 register-form">
                {/* 비밀번호 */}
            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비밀번호
              </label>
                  <div className="relative register-input-container">
                    <FiLock className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
                      passwordError ? 'text-red-400' : 
                      registerData.mt_pwd && !passwordError ? 'text-green-500' : 
                      focusedField === 'password' || registerData.mt_pwd ? 'text-indigo-500' : 'text-gray-400'
                    }`} />
              <input
                      type={showPassword ? 'text' : 'password'}
                      value={registerData.mt_pwd}
                      onChange={(e) => {
                        const password = e.target.value;
                        setRegisterData(prev => ({ ...prev, mt_pwd: password }));
                        validatePassword(password);
                      }}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="8자 이상, 대소문자, 숫자, 특수문자 포함"
                      className={`w-full pl-8 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent register-input ${
                        passwordError ? 'border-red-300 focus:ring-red-500' :
                        registerData.mt_pwd && !passwordError ? 'border-green-300 focus:ring-green-500' :
                        'border-gray-200 focus:ring-indigo-500'
                      }`}
                      style={{ outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {/* 비밀번호 강도 표시기 */}
                  {registerData.mt_pwd && (
                    <div className="mt-3 space-y-2">
                      <div className="flex space-x-1">
                        {Object.values(passwordStrength).map((isValid, index) => (
                          <div
                            key={index}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              isValid ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {[
                          { key: 'minLength', label: '8자+', valid: passwordStrength.minLength },
                          { key: 'hasUppercase', label: '대문자', valid: passwordStrength.hasUppercase },
                          { key: 'hasLowercase', label: '소문자', valid: passwordStrength.hasLowercase },
                          { key: 'hasNumber', label: '숫자', valid: passwordStrength.hasNumber },
                          { key: 'hasSpecialChar', label: '특수문자', valid: passwordStrength.hasSpecialChar }
                        ].map(({ key, label, valid }) => (
                          <div key={key} className={`flex items-center space-x-1 ${valid ? 'text-green-600' : 'text-gray-500'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${valid ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {passwordError && (
                    <p className="text-red-500 text-sm mt-2" style={{ wordBreak: 'keep-all' }}>{passwordError}</p>
              )}
            </div>

                {/* 비밀번호 확인 */}
            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비밀번호 확인
              </label>
                  <div className="relative register-input-container">
                    <FiLock className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
                      passwordConfirm && passwordConfirm !== registerData.mt_pwd ? 'text-red-400' :
                      passwordConfirm && passwordConfirm === registerData.mt_pwd && registerData.mt_pwd ? 'text-green-500' :
                      focusedField === 'passwordConfirm' || passwordConfirm ? 'text-indigo-500' : 'text-gray-400'
                    }`} />
              <input
                      type={showPasswordConfirm ? 'text' : 'password'}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      onFocus={() => setFocusedField('passwordConfirm')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="비밀번호를 다시 입력해주세요"
                      className="w-full pl-8 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-offset-0 focus:ring-indigo-500 focus:border-transparent register-input"
                      style={{ outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    >
                      {showPasswordConfirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordConfirm && passwordConfirm !== registerData.mt_pwd && (
                    <p className="text-red-500 text-sm mt-1" style={{ wordBreak: 'keep-all' }}>비밀번호가 일치하지 않습니다</p>
                  )}
                  {passwordConfirm && passwordConfirm === registerData.mt_pwd && registerData.mt_pwd && (
                    <p className="text-green-500 text-sm mt-1 flex items-center" style={{ wordBreak: 'keep-all' }}>
                      <FiCheck className="w-4 h-4 mr-1" />
                      비밀번호가 일치합니다
                    </p>
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-offset-0 focus:ring-indigo-500 focus:border-transparent register-input"
                    style={{ outline: 'none' }}
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-offset-0 focus:ring-indigo-500 focus:border-transparent register-input"
                    style={{ outline: 'none' }}
                  />
                </div>

                {/* 이메일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이메일 (선택)
                  </label>
                  <div className="relative register-input-container">
                    <FiMail className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
                      emailError 
                        ? 'text-red-400' 
                        : registerData.mt_email && !emailError 
                          ? 'text-green-500' 
                          : focusedField === 'email' || registerData.mt_email
                            ? 'text-indigo-500'
                            : 'text-gray-400'
                    }`} />
                    <input
                      type="email"
                      value={registerData.mt_email}
                      onChange={(e) => {
                        const email = e.target.value;
                        setRegisterData(prev => ({ ...prev, mt_email: email }));
                        validateEmail(email);
                      }}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="example@email.com"
                      className={`w-full pl-8 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent register-input ${
                        emailError 
                          ? 'border-red-300 focus:ring-red-500' 
                          : registerData.mt_email && !emailError
                            ? 'border-green-300 focus:ring-green-500'
                            : 'border-gray-200 focus:ring-indigo-500'
                      }`}
                      style={{ outline: 'none' }}
                    />
                    {registerData.mt_email && !emailError && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {emailError && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
            </div>
                    )}
                  </div>
                  {emailError && (
                    <p className="text-red-500 text-sm mt-1" style={{ wordBreak: 'keep-all' }}>{emailError}</p>
                  )}
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
              className="w-full h-full flex flex-col justify-center"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiHeart className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">프로필 정보</h2>
                <p className="text-gray-600" style={{ wordBreak: 'keep-all' }}>추가 정보를 입력해주세요</p>
              </div>

              <div className="space-y-6">
                {/* 생년월일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    생년월일
                  </label>
                  <button
                    type="button"
                    onClick={handleBirthModalOpen}
                    className="w-full flex items-center px-4 py-3 border border-gray-200 rounded-xl hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-left"
                  >
                    <FiCalendar className="w-5 h-5 text-indigo-500 mr-3" />
                    <span className={registerData.mt_birth ? 'text-gray-900' : 'text-gray-500'}>
                      {registerData.mt_birth 
                        ? dayjs(registerData.mt_birth).format('YYYY년 MM월 DD일')
                        : '생년월일을 선택해주세요'
                      }
                    </span>
                    <FiChevronDown className="w-5 h-5 text-gray-400 ml-auto" />
                  </button>
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
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
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
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
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
                          ? 'bg-indigo-500 border-indigo-500' 
                          : 'border-gray-300'
                      }`}>
                        {registerData.mt_push1 && (
                          <FiCheck className="w-3 h-3 text-white" />
                        )}
              </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-900">푸시 알림 수신 동의</span>
                      <p className="text-xs text-gray-500" style={{ wordBreak: 'keep-all' }}>그룹 활동, 일정 알림 등을 받을 수 있습니다</p>
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
              className="w-full h-full flex flex-col justify-center"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiMapPin className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">위치 정보</h2>
                <p className="text-gray-600" style={{ wordBreak: 'keep-all' }}>
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
                    <p className="text-green-600 text-sm" style={{ wordBreak: 'keep-all' }}>
                      위도: {registerData.mt_lat.toFixed(6)}<br />
                      경도: {registerData.mt_long.toFixed(6)}
                    </p>
                  </div>
                ) : (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <FiMapPin className="w-5 h-5 text-indigo-500" />
                      <span className="text-indigo-700 font-medium">위치 정보 설정</span>
                    </div>
                    <p className="text-indigo-600 text-sm mb-4" style={{ wordBreak: 'keep-all' }}>
                      그룹 멤버들과의 위치 공유, 주변 정보 제공 등을 위해 위치 정보가 필요합니다.
                    </p>
                    <motion.button
                      onClick={handleGetLocation}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold shadow-lg"
                    >
                      현재 위치 가져오기
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* 완료 단계 */}
          {currentStep === REGISTER_STEPS.COMPLETE && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full h-full flex flex-col justify-center text-center"
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
                <p className="text-gray-600 mb-8" style={{ wordBreak: 'keep-all' }}>
                  SMAP에 오신 것을 환영합니다.<br />
                  이제 그룹을 만들고 친구들과 함께 활동해보세요!
                </p>
                
                <motion.button
                  onClick={() => {
                    // 사용자 입력 정보를 localStorage에 저장
                    const userInfo = {
                      phone: registerData.mt_id,
                      name: registerData.mt_name,
                      nickname: registerData.mt_nickname,
                      email: registerData.mt_email,
                      birth: registerData.mt_birth,
                      gender: registerData.mt_gender,
                      registeredAt: new Date().toISOString()
                    };
                    
                    try {
                      localStorage.setItem('recentUserInfo', JSON.stringify(userInfo));
                      // 로그인 페이지에서 사용할 전화번호도 별도 저장
                      localStorage.setItem('lastRegisteredPhone', registerData.mt_id);
                    } catch (error) {
                      console.error('사용자 정보 저장 실패:', error);
                    }
                    
                    router.push('/signin');
                  }}
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
        </div>
      </div>

      {/* 하단 버튼 */}
      {currentStep !== REGISTER_STEPS.COMPLETE && currentStep !== REGISTER_STEPS.VERIFICATION && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 safe-area-bottom"
          data-bottom-button
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <motion.button
            onClick={currentStep === REGISTER_STEPS.PHONE ? handleSendVerification : 
                     currentStep === REGISTER_STEPS.LOCATION ? handleRegister : handleNext}
            disabled={!isStepValid() || isLoading}
            whileHover={{ scale: isStepValid() ? 1.02 : 1 }}
            whileTap={{ scale: isStepValid() ? 0.98 : 1 }}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all register-button ${
              isStepValid()
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? '처리 중...' : 
             currentStep === REGISTER_STEPS.PHONE ? '인증번호 발송' :
             currentStep === REGISTER_STEPS.LOCATION ? '회원가입 완료' : '다음'}
          </motion.button>
        </motion.div>
      )}

      {/* 오류 모달 */}
      {errorModal.isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setErrorModal({ isOpen: false, title: '', message: '', isCountdown: false })}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-sm mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{errorModal.title}</h3>
                <p className="text-gray-600 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                  {errorModal.message}
                </p>
              </div>
              
              <motion.button
                onClick={() => setErrorModal({ isOpen: false, title: '', message: '', isCountdown: false })}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 bg-red-500 text-white rounded-2xl font-medium hover:bg-red-600 transition-colors"
              >
                확인
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 생년월일 캘린더 모달 */}
      <AnimatePresence>
        {birthModalOpen && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" 
            onClick={() => setBirthModalOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div 
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl mx-4"
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="p-6">
                {/* 헤더 */}
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FiCalendar className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">생년월일 선택</h3>
                  <p className="text-gray-600" style={{ wordBreak: 'keep-all' }}>생년월일을 선택해주세요</p>
                </div>

                {/* 캘린더 헤더 */}
                <div className="flex items-center justify-between mb-6">
                  <motion.button
                    onClick={handleCalendarPrevMonth}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <FiChevronLeft className="w-5 h-5 text-gray-600" />
                  </motion.button>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-0 mb-2">
                      <select
                        value={calendarCurrentMonth.year()}
                        onChange={(e) => setCalendarCurrentMonth(calendarCurrentMonth.year(parseInt(e.target.value)))}
                        className="text-lg font-bold bg-transparent border-none focus:outline-none text-gray-900 cursor-pointer min-w-[110px]"
                      >
                        {Array.from({ length: 75 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return (
                            <option key={year} value={year}>
                              {year}년
                            </option>
                          );
                        })}
                      </select>
                      <select
                        value={calendarCurrentMonth.month() + 1}
                        onChange={(e) => setCalendarCurrentMonth(calendarCurrentMonth.month(parseInt(e.target.value) - 1))}
                        className="text-lg font-bold bg-transparent border-none focus:outline-none text-gray-900 cursor-pointer min-w-[75px] pr-6"
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}월
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleCalendarToday}
                      className="text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      오늘로 이동
              </button>
            </div>
                  
                  <motion.button
                    onClick={handleCalendarNextMonth}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <FiChevronRight className="w-5 h-5 text-gray-600" />
                  </motion.button>
                </div>

                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
                    <div key={day} className={`h-8 flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
                    }`}>
                      {day}
                    </div>
                  ))}
                </div>

                {/* 캘린더 그리드 */}
                <div className="grid grid-cols-7 gap-1 mb-6">
                  {(() => {
                    const days = [];
                    const daysInMonth = calendarCurrentMonth.daysInMonth();
                    const firstDayOfMonth = calendarCurrentMonth.startOf('month').day();
                    const today = dayjs();
                    
                    // 빈 칸 추가 (이전 달 마지막 날들)
                    for (let i = 0; i < firstDayOfMonth; i++) {
                      days.push(<div key={`empty-${i}`} className="h-10"></div>);
                    }
                    
                    // 현재 달의 날짜들
                    for (let day = 1; day <= daysInMonth; day++) {
                      const currentDate = calendarCurrentMonth.date(day);
                      const isSelected = selectedDate?.isSame(currentDate, 'day');
                      const isToday = today.isSame(currentDate, 'day');
                      const isFuture = currentDate.isAfter(today, 'day');
                      
                      days.push(
                        <button
                          key={day}
                          onClick={() => handleCalendarDateSelect(currentDate)}
                          disabled={isFuture}
                          className={`
                            h-10 w-full rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-200
                            ${isSelected ? 'bg-indigo-600 text-white font-semibold shadow-lg' : ''}
                            ${isToday && !isSelected ? 'bg-indigo-100 text-indigo-800 font-semibold' : ''}
                            ${!isSelected && !isToday && !isFuture ? 'hover:bg-gray-100 text-gray-800' : ''}
                            ${isFuture ? 'text-gray-300 cursor-not-allowed' : ''}
                          `}
                        >
                          {day}
                        </button>
                      );
                    }
                    
                    return days;
                  })()}
                </div>

                {/* 선택된 날짜 표시 */}
                {selectedDate && (
                  <div className="text-center mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <p className="text-sm text-gray-600">선택된 날짜</p>
                    <p className="text-lg font-bold text-indigo-700" style={{ wordBreak: 'keep-all' }}>
                      {selectedDate.format('YYYY년 MM월 DD일 (ddd)')}
            </p>
          </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => setBirthModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleBirthConfirm}
                    disabled={!selectedDate}
                    className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                      selectedDate
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    확인
                  </button>
        </div>
      </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 